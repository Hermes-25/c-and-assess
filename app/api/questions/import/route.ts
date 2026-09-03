import { env } from 'cloudflare:workers';
import { requireOrganizerRequest } from '../../../../lib/auth';
import { ensureAssessmentSchema } from '../../../../lib/assessment-store';
import { normalizeQuestionRows, type RawQuestionRow } from '../../../../lib/question-import';
import { protectMutation } from '../../../../lib/request-security';

const lockedStatuses = new Set(['live','ended','results_processing','results_ready','results_released','archived']);

async function editableAssessment(assessmentId: string) {
  return env.DB.prepare('SELECT id, title, status, version, paper_version FROM assessments WHERE id = ?').bind(assessmentId).first<{ id:string; title:string; status:string; version:number; paper_version:number }>();
}
export async function GET(request: Request) {
  if (!await requireOrganizerRequest(request)) return Response.json({ error: 'Organizer sign-in required.' }, { status: 401 });
  await ensureAssessmentSchema();
  const url = new URL(request.url); const assessmentId = url.searchParams.get('assessmentId');
  if (!assessmentId) return Response.json({ error: 'Assessment is required.' }, { status: 400 });
  const assessment = await editableAssessment(assessmentId);
  if (!assessment) return Response.json({ error: 'Assessment not found.' }, { status: 404 });
  const questions = await env.DB.prepare(`SELECT id, position, type, prompt, passage, options_json, answers_json, solution, marks, negative_marks, topic, subtopic, difficulty, image_key
    FROM questions WHERE assessment_id = ? AND is_active = 1 ORDER BY position LIMIT 250`).bind(assessmentId).all();
  const latestImport = await env.DB.prepare(`SELECT id, source_filename, status, expected_rows, staged_rows, created_at, committed_at
    FROM question_imports WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1`).bind(assessmentId).first();
  return Response.json({ assessment, questions: questions.results, latestImport });
}

export async function POST(request: Request) {
  const blocked=protectMutation(request,{scope:'question-import',limit:15});if(blocked)return blocked;
  const organizer = await requireOrganizerRequest(request);
  if (!organizer) return Response.json({ error: 'Organizer sign-in required.' }, { status: 401 });
  await ensureAssessmentSchema();
  const body = await request.json() as {
    action?: 'start' | 'chunk' | 'commit' | 'cancel'; assessmentId?: string; importId?: string;
    sourceFilename?: string; expectedRows?: number; imageNames?: string[]; offset?: number; rows?: RawQuestionRow[];
  };
  if (!body.action || !body.assessmentId) return Response.json({ error: 'Invalid import request.' }, { status: 400 });
  const assessment = await editableAssessment(body.assessmentId);
  if (!assessment) return Response.json({ error: 'Assessment not found.' }, { status: 404 });
  if (lockedStatuses.has(assessment.status)) return Response.json({ error: 'The question paper is locked for this assessment state.' }, { status: 409 });
  const now = Math.floor(Date.now() / 1000);

  if (body.action === 'start') {
    const expectedRows = Number(body.expectedRows);
    const imageNames = Array.isArray(body.imageNames) ? [...new Set(body.imageNames.map((name) => name.trim()).filter(Boolean))] : [];
    if (!Number.isInteger(expectedRows) || expectedRows < 1 || expectedRows > 1000 || !body.sourceFilename?.toLowerCase().endsWith('.csv')) {
      return Response.json({ error: 'Choose a CSV containing 1–1,000 question rows.' }, { status: 400 });
    }
    if (imageNames.some((name) => !/^[^\\/]+\.(png|jpe?g)$/i.test(name))) return Response.json({ error: 'Image names must be safe PNG or JPEG filenames.' }, { status: 400 });
    const importId = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO question_imports (id, assessment_id, source_filename, status, expected_rows, staged_rows, error_json,
      image_manifest_json, uploaded_images_json, created_by, created_at) VALUES (?, ?, ?, 'staging', ?, 0, '[]', ?, '[]', ?, ?)`)
      .bind(importId, body.assessmentId, body.sourceFilename.slice(0, 180), expectedRows, JSON.stringify(imageNames), organizer.email, now).run();
    return Response.json({ importId, chunkSize: 40 });
  }

  if (!body.importId) return Response.json({ error: 'Import session is required.' }, { status: 400 });
  const currentImport = await env.DB.prepare('SELECT * FROM question_imports WHERE id = ? AND assessment_id = ? AND created_by = ?')
    .bind(body.importId, body.assessmentId, organizer.email).first<Record<string, unknown>>();
  if (!currentImport) return Response.json({ error: 'Import session not found.' }, { status: 404 });

  if (body.action === 'cancel') {
    await env.DB.batch([
      env.DB.prepare("UPDATE question_imports SET status = 'cancelled' WHERE id = ? AND status = 'staging'").bind(body.importId),
      env.DB.prepare('DELETE FROM question_import_rows WHERE import_id = ?').bind(body.importId),
    ]);
    return Response.json({ cancelled: true });
  }

  if (String(currentImport.status) !== 'staging') return Response.json({ error: `This import is already ${currentImport.status}.` }, { status: 409 });

  if (body.action === 'chunk') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const offset = Number(body.offset);
    if (!Number.isInteger(offset) || offset < 0 || rows.length < 1 || rows.length > 40 || offset + rows.length > Number(currentImport.expected_rows)) {
      return Response.json({ error: 'Invalid import chunk.' }, { status: 400 });
    }
    const validation = normalizeQuestionRows(rows, offset + 1);
    const errors = validation.issues.filter((issue) => issue.level === 'error');
    if (errors.length) {
      await env.DB.prepare("UPDATE question_imports SET status = 'failed', error_json = ? WHERE id = ?").bind(JSON.stringify(validation.issues), body.importId).run();
      return Response.json({ error: errors[0].message, issues: validation.issues }, { status: 422 });
    }
    const statements = validation.normalized.map((row) => env.DB.prepare(`INSERT INTO question_import_rows (
      import_id, position, prompt_fingerprint, type, prompt, passage, options_json, answers_json, solution, marks, negative_marks,
      answer_keywords_json, keyword_marks, image_name, duration_seconds, section_name, topic, subtopic, difficulty, source,
      accepted_variants_json, tita_tolerance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(import_id, position) DO UPDATE SET prompt_fingerprint=excluded.prompt_fingerprint, type=excluded.type,
      prompt=excluded.prompt, passage=excluded.passage, options_json=excluded.options_json, answers_json=excluded.answers_json,
      solution=excluded.solution, marks=excluded.marks, negative_marks=excluded.negative_marks,
      answer_keywords_json=excluded.answer_keywords_json, keyword_marks=excluded.keyword_marks, image_name=excluded.image_name,
      duration_seconds=excluded.duration_seconds, section_name=excluded.section_name, topic=excluded.topic,
      subtopic=excluded.subtopic, difficulty=excluded.difficulty, source=excluded.source,
      accepted_variants_json=excluded.accepted_variants_json, tita_tolerance=excluded.tita_tolerance`)
      .bind(body.importId, row.position, row.fingerprint, row.type, row.prompt, row.passage, JSON.stringify(row.choices), JSON.stringify(row.answers),
        row.solution, row.marks, row.negativeMarks, JSON.stringify(row.answerKeywords), row.keywordMarks, row.imageName, row.durationSeconds,
        row.sectionName, row.topic, row.subtopic, row.difficulty, row.source, JSON.stringify(row.acceptedVariants), row.titaTolerance));
    statements.push(env.DB.prepare('UPDATE question_imports SET staged_rows = (SELECT COUNT(*) FROM question_import_rows WHERE import_id = ?) WHERE id = ?').bind(body.importId, body.importId));
    try { await env.DB.batch(statements); }
    catch {
      await env.DB.prepare("UPDATE question_imports SET status = 'failed', error_json = ? WHERE id = ?").bind(JSON.stringify([{ level:'error', message:'Duplicate questions or invalid rows were detected across upload chunks.' }]), body.importId).run();
      return Response.json({ error: 'Duplicate questions or invalid rows were detected.' }, { status: 422 });
    }
    const staged = await env.DB.prepare('SELECT staged_rows FROM question_imports WHERE id = ?').bind(body.importId).first<{ staged_rows:number }>();
    return Response.json({ staged: staged?.staged_rows || 0, warnings: validation.issues.filter((issue) => issue.level === 'warning') });
  }

  if (body.action === 'commit') {
    const refreshed = await env.DB.prepare('SELECT expected_rows, staged_rows, image_manifest_json, uploaded_images_json FROM question_imports WHERE id = ?').bind(body.importId)
      .first<{ expected_rows:number; staged_rows:number; image_manifest_json:string; uploaded_images_json:string }>();
    if (!refreshed || refreshed.staged_rows !== refreshed.expected_rows) return Response.json({ error: `Only ${refreshed?.staged_rows || 0} of ${refreshed?.expected_rows || 0} rows were staged.` }, { status: 409 });
    const needed = JSON.parse(refreshed.image_manifest_json || '[]') as string[];
    const uploaded = new Set(JSON.parse(refreshed.uploaded_images_json || '[]') as string[]);
    const missing = needed.filter((name) => !uploaded.has(name));
    if (missing.length) return Response.json({ error: `Upload the matching image ZIP. Missing: ${missing.slice(0, 3).join(', ')}` }, { status: 422 });
    const nextVersion = Number(assessment.version || 1) + 1; const paperVersion = Number(assessment.paper_version || 0) + 1;
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO question_versions (id, assessment_id, paper_version, question_id, position, payload_json, created_at)
        SELECT lower(hex(randomblob(16))), assessment_id, ?, id, position,
          json_object('type',type,'prompt',prompt,'sectionId',section_id,'passage',passage,'options',options_json,'answers',answers_json,
            'solution',solution,'marks',marks,'negativeMarks',negative_marks,'keywords',answer_keywords_json,'keywordMarks',keyword_marks,
            'imageKey',image_key,'durationSeconds',duration_seconds,'tag',tag,'topic',topic,'subtopic',subtopic,'source',source,
            'acceptedVariants',accepted_variants_json,'titaTolerance',tita_tolerance,'difficulty',difficulty), ?
        FROM questions WHERE assessment_id = ?`).bind(Number(assessment.paper_version || 0), now, body.assessmentId),
      env.DB.prepare('DELETE FROM questions WHERE assessment_id = ?').bind(body.assessmentId),
      env.DB.prepare('DELETE FROM assessment_sections WHERE assessment_id = ?').bind(body.assessmentId),
      env.DB.prepare(`INSERT INTO assessment_sections (id, assessment_id, name, position, duration_seconds, instructions, created_at, updated_at)
        SELECT lower(hex(randomblob(16))), ?, section_name, MIN(position), NULL, '', ?, ? FROM question_import_rows WHERE import_id = ? GROUP BY section_name ORDER BY MIN(position)`)
        .bind(body.assessmentId, now, now, body.importId),
      env.DB.prepare(`INSERT INTO questions (id, assessment_id, position, type, prompt, section_id, passage, options_json, answers_json, solution,
        marks, negative_marks, answer_keywords_json, keyword_marks, image_key, duration_seconds, tag, topic, subtopic, source,
        accepted_variants_json, tita_tolerance, difficulty, is_active, created_at, updated_at)
        SELECT lower(hex(randomblob(16))), ?, r.position, r.type, r.prompt,
          (SELECT s.id FROM assessment_sections s WHERE s.assessment_id = ? AND s.name = r.section_name LIMIT 1),
          r.passage, r.options_json, r.answers_json, r.solution, r.marks, r.negative_marks, r.answer_keywords_json,
          r.keyword_marks, CASE WHEN r.image_name IS NULL THEN NULL ELSE 'assessments/' || ? || '/' || r.image_name END,
          r.duration_seconds, r.topic, r.topic, r.subtopic, r.source, r.accepted_variants_json, r.tita_tolerance,
          r.difficulty, 1, ?, ? FROM question_import_rows r WHERE r.import_id = ? ORDER BY r.position`)
        .bind(body.assessmentId, body.assessmentId, body.assessmentId, now, now, body.importId),
      env.DB.prepare(`UPDATE assessments SET question_count = ?, total_marks = (SELECT COALESCE(SUM(marks),0) FROM question_import_rows WHERE import_id = ?),
        paper_version = ?, version = ?, updated_at = ? WHERE id = ?`)
        .bind(refreshed.expected_rows, body.importId, paperVersion, nextVersion, now, body.assessmentId),
      env.DB.prepare("UPDATE question_imports SET status = 'committed', committed_at = ? WHERE id = ?").bind(now, body.importId),
      env.DB.prepare('INSERT INTO assessment_versions (id, assessment_id, version, kind, snapshot_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), body.assessmentId, nextVersion, 'paper.imported', JSON.stringify({ paperVersion, questionCount: refreshed.expected_rows, sourceFilename: currentImport.source_filename }), organizer.email, now),
      env.DB.prepare('INSERT INTO organizer_audit_log (id, assessment_id, actor_email, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), body.assessmentId, organizer.email, 'paper.imported', JSON.stringify({ importId: body.importId, paperVersion, questionCount: refreshed.expected_rows }), now),
      env.DB.prepare('DELETE FROM question_import_rows WHERE import_id = ?').bind(body.importId),
    ]);
    return Response.json({ imported: refreshed.expected_rows, paperVersion, version: nextVersion });
  }

  return Response.json({ error: 'Unsupported import action.' }, { status: 400 });
}
