import { env } from 'cloudflare:workers';
import { requireOrganizerRequest } from '../../../lib/auth';
import { defaultAssessmentSettings, ensureAssessmentSchema, getAssessment, listAssessments, publicAssessment } from '../../../lib/assessment-store';
import { protectMutation } from '../../../lib/request-security';

type AssessmentPayload = {
  id?: string; expectedVersion?: number; title?: string; slug?: string; description?: string; durationMinutes?: number;
  startsAt?: string; endsAt?: string; registrationStartsAt?: string; registrationEndsAt?: string;
  shuffleQuestions?: boolean; shuffleOptions?: boolean; allowEditing?: boolean; maxTabSwitches?: number;
  startPolicy?: 'full_duration' | 'common_deadline'; solutionVisibility?: 'with_results' | 'separate_release';
  audience?: 'open' | 'domains'; allowedDomains?: string[] | string; registrationCapacity?: number | null;
};

const epoch = (value?: string) => value ? Math.floor(new Date(value).getTime() / 1000) : null;
const makeSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || `assessment-${Date.now()}`;

export async function GET(request: Request) {
  if (!await requireOrganizerRequest(request)) return Response.json({ error: 'Organizer sign-in required.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const assessment = await getAssessment(id);
    return assessment ? Response.json({ assessment: publicAssessment(assessment) }) : Response.json({ error: 'Assessment not found.' }, { status: 404 });
  }
  const assessments = await listAssessments();
  return Response.json({ assessments: assessments.map(publicAssessment) });
}
export async function POST(request: Request) {
  const blocked=protectMutation(request,{scope:'assessment-write',limit:30});if(blocked)return blocked;
  const organizer = await requireOrganizerRequest(request);
  if (!organizer) return Response.json({ error: 'Organizer sign-in required.' }, { status: 401 });
  const body = await request.json() as AssessmentPayload;
  await ensureAssessmentSchema();
  const requestedId = body.id?.trim() || '';
  const existing = requestedId ? await env.DB.prepare(`SELECT a.*,
    (SELECT COUNT(*) FROM attempts t WHERE t.assessment_id=a.id AND t.status IN ('started','submitted','evaluated')) AS started_count
    FROM assessments a WHERE a.id=?`).bind(requestedId).first<Record<string,unknown>>() : null;
  const existingSettings = existing ? JSON.parse(String(existing.settings_json || '{}')) as Record<string,unknown> : {};
  const paperLocked = Boolean(existing && (Number(existing.started_count || 0) > 0 || ['live','ended','results_processing','results_ready','results_released','archived'].includes(String(existing.status))));
  const fullyLocked = Boolean(existing && ['results_processing','results_ready','results_released','archived'].includes(String(existing.status)));
  if (fullyLocked) return Response.json({ error: 'Results are already being processed or released, so this assessment can no longer be changed.' }, { status: 409 });
  const title = paperLocked ? String(existing?.title || '') : body.title?.trim() || '';
  const durationMinutes = paperLocked ? Number(existing?.duration_seconds || 0) / 60 : Number(body.durationMinutes);
  const startsAt = epoch(body.startsAt); const endsAt = epoch(body.endsAt);
  const registrationStartsAt = epoch(body.registrationStartsAt) ?? Math.floor(Date.now() / 1000);
  const registrationEndsAt = epoch(body.registrationEndsAt) ?? startsAt;
  if (!title || !Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 300 || !startsAt || !endsAt) {
    return Response.json({ error: 'Name, valid dates and a 5–300 minute duration are required.' }, { status: 400 });
  }
  if (endsAt <= startsAt) return Response.json({ error: 'Test end must be after test start.' }, { status: 400 });
  if (!registrationEndsAt || registrationEndsAt <= registrationStartsAt) return Response.json({ error: 'Registration close must be after registration open.' }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  const id = requestedId || crypto.randomUUID();
  if (existing && body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(existing.version)) {
    return Response.json({ error: 'Someone else updated this assessment. Refresh before saving again.' }, { status: 409 });
  }
  const previousSettings = existingSettings;
  const previousDomains = Array.isArray(previousSettings.allowedDomains) ? previousSettings.allowedDomains.map(String) : [];
  const domainInput = Array.isArray(body.allowedDomains) ? body.allowedDomains.join(',') : String(body.allowedDomains || previousDomains.join(',') || '');
  const allowedDomains = [...new Set(domainInput.split(',').map((value) => value.trim().toLowerCase().replace(/^@/, '')).filter(Boolean))].slice(0, 30);
  const rawCapacity = body.registrationCapacity === null || body.registrationCapacity === undefined || body.registrationCapacity === 0 ? null : Number(body.registrationCapacity);
  const requestedSettings = {
    ...defaultAssessmentSettings, ...previousSettings,
    shuffleQuestions: body.shuffleQuestions ?? previousSettings.shuffleQuestions ?? true,
    shuffleOptions: body.shuffleOptions ?? previousSettings.shuffleOptions ?? true,
    allowEditing: body.allowEditing ?? previousSettings.allowEditing ?? true,
    maxTabSwitches: Math.max(0, Math.min(20, Number(body.maxTabSwitches ?? previousSettings.maxTabSwitches ?? 3))),
    startPolicy: body.startPolicy ?? previousSettings.startPolicy ?? 'common_deadline',
    solutionVisibility: body.solutionVisibility ?? previousSettings.solutionVisibility ?? 'separate_release',
    audience: body.audience === 'domains' ? 'domains' : 'open',
    allowedDomains,
    registrationCapacity: rawCapacity && Number.isFinite(rawCapacity) ? Math.max(1, Math.min(100000, Math.floor(rawCapacity))) : null,
  };
  const settings = paperLocked ? { ...defaultAssessmentSettings, ...previousSettings } : requestedSettings;
  const baseSlug = makeSlug(paperLocked ? String(existing?.slug || title) : body.slug?.trim() || title);
  let slug = baseSlug;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const conflict = await env.DB.prepare('SELECT id FROM assessments WHERE slug = ? AND id != ?').bind(slug, id).first();
    if (!conflict) break;
    slug = `${baseSlug.slice(0, 75)}-${suffix}`;
  }
  const nextVersion = Number(existing?.version || 0) + 1;
  const nextStatus = existing?.status === 'ended' && endsAt > now ? (startsAt <= now ? 'live' : 'scheduled') : String(existing?.status || 'draft');
  const description = paperLocked ? String(existing?.description || '') : body.description?.trim() || '';
  await env.DB.prepare(`INSERT INTO assessments (
    id, slug, title, description, status, duration_seconds, registration_starts_at, registration_ends_at,
    starts_at, ends_at, settings_json, version, paper_version, question_count, total_marks,
    created_by, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, description=excluded.description, status=?,
    duration_seconds=excluded.duration_seconds, registration_starts_at=excluded.registration_starts_at,
    registration_ends_at=excluded.registration_ends_at, starts_at=excluded.starts_at, ends_at=excluded.ends_at,
    settings_json=excluded.settings_json, version=excluded.version, updated_at=excluded.updated_at`)
    .bind(id, slug, title, description, Math.round(durationMinutes * 60), registrationStartsAt,
      registrationEndsAt, startsAt, endsAt, JSON.stringify(settings), nextVersion, organizer.email,
      Number(existing?.created_at || now), now, nextStatus).run();
  const snapshot = { id, slug, title, description, durationSeconds: Math.round(durationMinutes * 60), registrationStartsAt, registrationEndsAt, startsAt, endsAt, settings };
  await env.DB.batch([
    env.DB.prepare('INSERT INTO assessment_versions (id, assessment_id, version, kind, snapshot_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, nextVersion, existing ? (paperLocked ? 'window.updated' : 'settings.updated') : 'assessment.created', JSON.stringify(snapshot), organizer.email, now),
    env.DB.prepare('INSERT INTO organizer_audit_log (id, assessment_id, actor_email, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, organizer.email, existing ? (paperLocked ? 'assessment.window_updated' : 'assessment.updated') : 'assessment.created', JSON.stringify({ version: nextVersion, title }), now),
  ]);
  return Response.json({ saved: true, id, slug, version: nextVersion });
}
