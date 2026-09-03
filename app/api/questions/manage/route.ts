import { env } from 'cloudflare:workers';
import { requireOrganizerRequest } from '../../../../lib/auth';
import { ensureAssessmentSchema } from '../../../../lib/assessment-store';
import { protectMutation } from '../../../../lib/request-security';

type Body={questionId?:string;prompt?:string;passage?:string;options?:string[];answers?:string[];solution?:string;marks?:number;negativeMarks?:number;topic?:string;subtopic?:string;difficulty?:string};
const text=(value:unknown,limit:number)=>String(value||'').trim().slice(0,limit);

export async function PATCH(request:Request){
  const blocked=protectMutation(request,{scope:'question-manage',limit:30});if(blocked)return blocked;
  const organizer=await requireOrganizerRequest(request);if(!organizer)return Response.json({error:'Organizer sign-in required.'},{status:401});
  await ensureAssessmentSchema();const body=await request.json() as Body;if(!body.questionId)return Response.json({error:'Question is required.'},{status:400});
  const row=await env.DB.prepare(`SELECT q.*,a.status,a.version,a.paper_version,
    (SELECT COUNT(*) FROM attempts t WHERE t.assessment_id=a.id AND t.status IN ('started','submitted','evaluated')) AS started_count
    FROM questions q JOIN assessments a ON a.id=q.assessment_id WHERE q.id=? AND q.is_active=1`).bind(body.questionId).first<Record<string,unknown>>();
  if(!row)return Response.json({error:'Question not found.'},{status:404});
  if(Number(row.started_count||0)>0||['live','ended','results_processing','results_ready','results_released','archived'].includes(String(row.status)))return Response.json({error:'This paper is locked because a candidate has already started or results work has begun.'},{status:409});
  const prompt=text(body.prompt,12000),passage=text(body.passage,24000),solution=text(body.solution,24000),topic=text(body.topic,120)||'General',subtopic=text(body.subtopic,120),difficulty=['easy','medium','hard'].includes(String(body.difficulty))?String(body.difficulty):'medium';
  const options=(body.options||[]).map((item)=>text(item,4000)).filter(Boolean).slice(0,12),answers=[...new Set((body.answers||[]).map((item)=>text(item,4000)).filter(Boolean))];
  const marks=Number(body.marks),negativeMarks=Number(body.negativeMarks||0),type=String(row.type);
  if(!prompt||!Number.isFinite(marks)||marks<=0||marks>1000||!Number.isFinite(negativeMarks)||negativeMarks<0||negativeMarks>marks)return Response.json({error:'Add a question, positive marks and valid negative marks.'},{status:400});
  if(['mcq','multi','comprehension'].includes(type)&&(options.length<2||!answers.length||answers.some((answer)=>!options.includes(answer))))return Response.json({error:'MCQ answers must exactly match one of at least two visible options.'},{status:400});
  if(type==='mcq'&&answers.length!==1)return Response.json({error:'A single-correct MCQ needs exactly one answer.'},{status:400});
  if(type==='tita'&&!answers.length)return Response.json({error:'TITA needs at least one accepted answer.'},{status:400});
  const now=Math.floor(Date.now()/1000),nextVersion=Number(row.version||0)+1,nextPaperVersion=Number(row.paper_version||0)+1;
  const snapshot={type:row.type,prompt:row.prompt,passage:row.passage,options:row.options_json,answers:row.answers_json,solution:row.solution,marks:row.marks,negativeMarks:row.negative_marks,topic:row.topic,subtopic:row.subtopic,difficulty:row.difficulty};
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO question_versions (id,assessment_id,paper_version,question_id,position,payload_json,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),row.assessment_id,Number(row.paper_version||0),row.id,row.position,JSON.stringify(snapshot),now),
    env.DB.prepare(`UPDATE questions SET prompt=?,passage=?,options_json=?,answers_json=?,solution=?,marks=?,negative_marks=?,topic=?,tag=?,subtopic=?,difficulty=?,updated_at=? WHERE id=?`).bind(prompt,passage,JSON.stringify(options),JSON.stringify(answers),solution,marks,negativeMarks,topic,topic,subtopic,difficulty,now,row.id),
    env.DB.prepare(`UPDATE assessments SET paper_version=?,version=?,total_marks=(SELECT COALESCE(SUM(marks),0) FROM questions WHERE assessment_id=? AND is_active=1),updated_at=? WHERE id=?`).bind(nextPaperVersion,nextVersion,row.assessment_id,now,row.assessment_id),
    env.DB.prepare(`INSERT INTO assessment_versions (id,assessment_id,version,kind,snapshot_json,created_by,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),row.assessment_id,nextVersion,'paper.question_updated',JSON.stringify({questionId:row.id,position:row.position,paperVersion:nextPaperVersion}),organizer.email,now),
    env.DB.prepare(`INSERT INTO organizer_audit_log (id,assessment_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),row.assessment_id,organizer.email,'paper.question_updated',JSON.stringify({questionId:row.id,position:row.position,paperVersion:nextPaperVersion}),now),
  ]);
  return Response.json({saved:true,question:{...row,prompt,passage,options_json:JSON.stringify(options),answers_json:JSON.stringify(answers),solution,marks,negative_marks:negativeMarks,topic,subtopic,difficulty},paperVersion:nextPaperVersion,version:nextVersion});
}
