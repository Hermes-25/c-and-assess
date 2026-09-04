import { env } from 'cloudflare:workers';
import { requireOrganizerRequest } from '../../../../lib/auth';
import { ensureAssessmentSchema } from '../../../../lib/assessment-store';
import { protectMutation } from '../../../../lib/request-security';

export async function POST(request: Request) {
  const blocked=protectMutation(request,{scope:'question-image-manage',limit:15});if(blocked)return blocked;
  const organizer = await requireOrganizerRequest(request);
  if (!organizer) return Response.json({ error:'Organizer sign-in required.' },{ status:401 });
  await ensureAssessmentSchema();
  const form = await request.formData();
  const questionId = String(form.get('questionId')||'');
  const remove = String(form.get('remove')||'') === 'true';
  const imageEntry = form.get('image');
  const image = imageEntry instanceof File && imageEntry.size ? imageEntry : null;
  if (!questionId || (!remove && !image)) return Response.json({ error:'Choose a replacement image or remove the current one.' },{ status:400 });
  const row = await env.DB.prepare(`SELECT q.*,a.status,a.version,a.paper_version,
    (SELECT COUNT(*) FROM attempts t WHERE t.assessment_id=a.id AND t.status IN ('started','submitted','evaluated')) AS started_count
    FROM questions q JOIN assessments a ON a.id=q.assessment_id WHERE q.id=? AND q.is_active=1`).bind(questionId).first<Record<string,unknown>>();
  if (!row) return Response.json({ error:'Question not found.' },{ status:404 });
  if (Number(row.started_count||0)>0 || ['live','ended','results_processing','results_ready','results_released','archived'].includes(String(row.status))) {
    return Response.json({ error:'The question image is locked because candidate activity has started.' },{ status:409 });
  }
  let imageKey: string|null = null;
  if (!remove && image) {
    if (!env.FILES) return Response.json({ error:'Image storage is not enabled on this deployment. Text-only papers remain available; private R2 storage can be enabled later.' },{ status:503 });
    if (image.size > 2*1024*1024 || !['image/png','image/jpeg'].includes(image.type) || !/\.(png|jpe?g)$/i.test(image.name)) {
      return Response.json({ error:'Use a PNG or JPEG image no larger than 2 MB.' },{ status:400 });
    }
    const extension = image.type === 'image/png' ? 'png' : 'jpg';
    imageKey = `assessments/${String(row.assessment_id)}/question-edits/${questionId}-${Date.now()}.${extension}`;
    await env.FILES.put(imageKey,image.stream(),{ httpMetadata:{ contentType:image.type,contentDisposition:'inline' } });
  }
  const now=Math.floor(Date.now()/1000),nextVersion=Number(row.version||0)+1,nextPaperVersion=Number(row.paper_version||0)+1;
  const snapshot={type:row.type,prompt:row.prompt,passage:row.passage,options:row.options_json,answers:row.answers_json,solution:row.solution,marks:row.marks,negativeMarks:row.negative_marks,imageKey:row.image_key,topic:row.topic,subtopic:row.subtopic,difficulty:row.difficulty};
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO question_versions (id,assessment_id,paper_version,question_id,position,payload_json,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),row.assessment_id,Number(row.paper_version||0),row.id,row.position,JSON.stringify(snapshot),now),
    env.DB.prepare('UPDATE questions SET image_key=?,updated_at=? WHERE id=?').bind(imageKey,now,questionId),
    env.DB.prepare('UPDATE assessments SET paper_version=?,version=?,updated_at=? WHERE id=?').bind(nextPaperVersion,nextVersion,now,row.assessment_id),
    env.DB.prepare(`INSERT INTO assessment_versions (id,assessment_id,version,kind,snapshot_json,created_by,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),row.assessment_id,nextVersion,'paper.question_image_updated',JSON.stringify({questionId,rowPosition:row.position,paperVersion:nextPaperVersion,removed:remove}),organizer.email,now),
    env.DB.prepare(`INSERT INTO organizer_audit_log (id,assessment_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),row.assessment_id,organizer.email,'paper.question_image_updated',JSON.stringify({questionId,rowPosition:row.position,paperVersion:nextPaperVersion,removed:remove}),now),
  ]);
  return Response.json({ saved:true,imageKey,paperVersion:nextPaperVersion,version:nextVersion });
}
