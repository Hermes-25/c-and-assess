import { env } from 'cloudflare:workers';
import { requireOrganizerRequest } from '../../../../lib/auth';
import { ensureAssessmentSchema, getAssessment, publicAssessment, type AssessmentStatus } from '../../../../lib/assessment-store';
import { startResultJob } from '../../../../lib/result-store';
import { protectMutation } from '../../../../lib/request-security';

const transitions: Record<string, { from: AssessmentStatus[]; to: AssessmentStatus }> = {
  open_registrations: { from: ['draft','registration_closed'], to: 'registration_open' },
  close_registrations: { from: ['registration_open'], to: 'registration_closed' },
  schedule_test: { from: ['draft','registration_open','registration_closed'], to: 'scheduled' },
  start_test: { from: ['scheduled','registration_closed'], to: 'live' },
  end_test: { from: ['live'], to: 'ended' },
  begin_result_processing: { from: ['ended'], to: 'results_processing' },
  mark_results_ready: { from: ['results_processing'], to: 'results_ready' },
  publish_results: { from: ['results_processing','results_ready'], to: 'results_released' },
  archive: { from: ['draft','registration_closed','ended','results_released'], to: 'archived' },
};

function preflight(assessment: Record<string, unknown>) {
  const errors: string[] = [];
  if (!String(assessment.title || '').trim()) errors.push('Add an assessment name.');
  if (Number(assessment.question_count || 0) < 1) errors.push('Upload at least one valid question.');
  if (Number(assessment.total_marks || 0) <= 0) errors.push('The paper must have positive total marks.');
  if (!assessment.starts_at || !assessment.ends_at || Number(assessment.ends_at) <= Number(assessment.starts_at)) errors.push('Set a valid test window.');
  if (!assessment.registration_starts_at || !assessment.registration_ends_at || Number(assessment.registration_ends_at) <= Number(assessment.registration_starts_at)) errors.push('Set a valid registration window.');
  return errors;
}
export async function POST(request: Request) {
  const blocked=protectMutation(request,{scope:'assessment-lifecycle',limit:30});if(blocked)return blocked;
  const organizer = await requireOrganizerRequest(request);
  if (!organizer) return Response.json({ error: 'Organizer sign-in required.' }, { status: 401 });
  const body = await request.json() as { assessmentId?: string; action?: string };
  if (!body.assessmentId || !body.action) return Response.json({ error: 'Invalid lifecycle action.' }, { status: 400 });
  await ensureAssessmentSchema();
  const assessment = await getAssessment(body.assessmentId);
  if (!assessment) return Response.json({ error: 'Assessment not found.' }, { status: 404 });
  if(body.action==='release_solutions'){
    if(assessment.status!=='results_released')return Response.json({error:'Release results before releasing solutions.'},{status:409});
    const settings={...(assessment.settings as Record<string,unknown>),solutionsReleased:true};const now=Math.floor(Date.now()/1000);const nextVersion=Number(assessment.version||1)+1;
    await env.DB.batch([
      env.DB.prepare('UPDATE assessments SET settings_json=?,version=?,updated_at=? WHERE id=?').bind(JSON.stringify(settings),nextVersion,now,body.assessmentId),
      env.DB.prepare('INSERT INTO organizer_audit_log (id,assessment_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),body.assessmentId,organizer.email,'results.solutions_released','{}',now),
    ]);
    return Response.json({saved:true,status:'results_released',solutionsReleased:true,version:nextVersion});
  }
  const transition = transitions[body.action];
  if(!transition)return Response.json({error:'Invalid lifecycle action.'},{status:400});
  const current = String(assessment.status) as AssessmentStatus;
  if (!transition.from.includes(current)) return Response.json({ error: `Cannot ${body.action.replaceAll('_',' ')} while the test is ${current.replaceAll('_',' ')}.` }, { status: 409 });
  if (['open_registrations','schedule_test','start_test'].includes(body.action)) {
    const errors = preflight(assessment);
    if (errors.length) return Response.json({ error: errors[0], errors }, { status: 422 });
  }
  let resultJob:null|Awaited<ReturnType<typeof startResultJob>>=null;
  if(body.action==='begin_result_processing'){
    const submitted=await env.DB.prepare("SELECT COUNT(*) AS total FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NULL").bind(body.assessmentId).first<{total:number}>();
    if(Number(submitted?.total||0)<1)return Response.json({error:'No eligible submitted attempts are available to process.'},{status:422});
    resultJob=await startResultJob(body.assessmentId,organizer.email);
  }
  if(body.action==='publish_results'){
    const latest=await env.DB.prepare("SELECT status FROM result_jobs WHERE assessment_id=? ORDER BY created_at DESC LIMIT 1").bind(body.assessmentId).first<{status:string}>();
    if(latest?.status!=='complete')return Response.json({error:'Finish the current analytics job before publishing results.'},{status:409});
  }
  const now = Math.floor(Date.now() / 1000);
  const nextVersion = Number(assessment.version || 1) + 1;
  const snapshot = { ...publicAssessment(assessment), status: transition.to, capturedAt: now };
  await env.DB.batch([
    env.DB.prepare("UPDATE assessments SET status = ?, version = ?, published_at = CASE WHEN ? = 'results_released' THEN ? ELSE published_at END, updated_at = ? WHERE id = ? AND status = ?")
      .bind(transition.to, nextVersion, transition.to, now, now, body.assessmentId, current),
    env.DB.prepare('INSERT INTO assessment_versions (id, assessment_id, version, kind, snapshot_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), body.assessmentId, nextVersion, `lifecycle.${body.action}`, JSON.stringify(snapshot), organizer.email, now),
    env.DB.prepare('INSERT INTO organizer_audit_log (id, assessment_id, actor_email, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), body.assessmentId, organizer.email, `lifecycle.${body.action}`, JSON.stringify({ from: current, to: transition.to, version: nextVersion }), now),
  ]);
  return Response.json({ saved: true, status: transition.to, version: nextVersion, job: resultJob });
}
