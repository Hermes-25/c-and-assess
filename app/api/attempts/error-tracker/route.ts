import { env } from 'cloudflare:workers';
import { getRequestSession } from '../../../../lib/auth';
import { ensureResultSchema } from '../../../../lib/result-store';
import { protectMutation } from '../../../../lib/request-security';

const allowedTags = new Set(['Concept gap', 'Misread question', 'Calculation error', 'Time pressure', 'Guessed', 'Did not know approach']);

export async function POST(request: Request) {
  const blocked=protectMutation(request,{scope:'error-tracker',limit:30});if(blocked)return blocked;
  const session = await getRequestSession(request);
  if (!session) return Response.json({ error: 'Candidate sign-in required.' }, { status: 401 });
  const body = await request.json() as { attemptId?: string; questionId?: string; tag?: string; note?: string };
  if (!body.attemptId || !body.questionId || !body.tag || !allowedTags.has(body.tag)) {
    return Response.json({ error: 'Invalid error-tracker entry.' }, { status: 400 });
  }
  await ensureResultSchema();
  const attempt=await env.DB.prepare("SELECT id FROM attempts WHERE id=? AND user_id=? AND status IN ('submitted','evaluated')").bind(body.attemptId,session.sub).first();
  if(!attempt)return Response.json({error:'Submitted attempt not found.'},{status:404});
  const question=await env.DB.prepare('SELECT q.id FROM questions q JOIN attempts a ON a.assessment_id=q.assessment_id WHERE a.id=? AND q.id=?').bind(body.attemptId,body.questionId).first();
  if(!question)return Response.json({error:'Question not found in this attempt.'},{status:404});
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO attempt_error_tags (attempt_id, question_id, tag, note, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(attempt_id, question_id) DO UPDATE SET
      tag = excluded.tag, note = excluded.note, updated_at = excluded.updated_at
  `).bind(body.attemptId, body.questionId, body.tag, body.note?.trim().slice(0,500) ?? '', now).run();
  return Response.json({ saved: true, at: now });
}
