import { env } from 'cloudflare:workers';import { getRequestSession } from '../../../../lib/auth';import { ensureCandidateSchema, shuffle } from '../../../../lib/candidate-store';import { parseSettings } from '../../../../lib/assessment-store';import { protectMutation } from '../../../../lib/request-security';
export async function POST(request:Request){
  const blocked=protectMutation(request,{scope:'attempt-start',limit:10});if(blocked)return blocked;
  const user=await getRequestSession(request);if(!user)return Response.json({error:'Sign in required.'},{status:401});await ensureCandidateSchema();
  const {assessmentId}=await request.json() as {assessmentId?:string};if(!assessmentId)return Response.json({error:'Assessment is required.'},{status:400});
  const existing=await env.DB.prepare('SELECT id,status FROM attempts WHERE assessment_id=? AND user_id=?').bind(assessmentId,user.sub).first<{id:string;status:string}>();if(existing)return Response.json({attemptId:existing.id,status:existing.status});
  const row=await env.DB.prepare(`SELECT a.*,r.status AS registration_status FROM assessments a JOIN registrations r ON r.assessment_id=a.id AND r.user_id=? WHERE a.id=?`).bind(user.sub,assessmentId).first<Record<string,unknown>>();
  if(!row)return Response.json({error:'Register before starting this test.'},{status:403});if(row.registration_status!=='registered')return Response.json({error:'Your registration is not eligible to start.'},{status:403});
  const now=Math.floor(Date.now()/1000);const starts=Number(row.starts_at||0),ends=Number(row.ends_at||0);if(!starts||!ends||now<starts||now>ends)return Response.json({error:now<starts?'The test window has not opened yet.':'The test window has closed.'},{status:409});
  if(!Number(row.paper_version)||!Number(row.question_count))return Response.json({error:'The question paper is not published yet.'},{status:409});
  const questions=await env.DB.prepare('SELECT id FROM questions WHERE assessment_id=? AND is_active=1 ORDER BY position').bind(assessmentId).all<{id:string}>();
  const settings=parseSettings(String(row.settings_json||'{}'));const order=settings.shuffleQuestions?shuffle(questions.results.map((q)=>q.id)):questions.results.map((q)=>q.id);
  const seed=Array.from(crypto.getRandomValues(new Uint8Array(16)),(value)=>value.toString(16).padStart(2,'0')).join('');const full=now+Number(row.duration_seconds);const expires=settings.startPolicy==='common_deadline'?Math.min(full,ends):full;const id=crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO attempts (id,assessment_id,user_id,status,paper_version,shuffle_seed,question_order_json,started_at,expires_at,updated_at) VALUES (?,?,?,'started',?,?,?,?,?,?)`).bind(id,assessmentId,user.sub,Number(row.paper_version),seed,JSON.stringify(order),now,expires,now),
    env.DB.prepare("UPDATE registrations SET status='started',updated_at=? WHERE assessment_id=? AND user_id=?").bind(now,assessmentId,user.sub),
    env.DB.prepare("UPDATE assessments SET status='live',updated_at=? WHERE id=? AND status='scheduled'").bind(now,assessmentId),
  ]);
  return Response.json({attemptId:id,status:'started'});
}
