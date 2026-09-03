import { env } from 'cloudflare:workers';
import { requireOrganizerRequest } from '../../../../lib/auth';
import { ensureResultSchema, processResultJob, startResultJob } from '../../../../lib/result-store';
import { jsonAnswers, jsonNumberMap } from '../../../../lib/candidate-store';
import { scoreAttempt, type ScoreQuestion } from '../../../../lib/scoring';
import { getAssessment } from '../../../../lib/assessment-store';
import { protectMutation } from '../../../../lib/request-security';

export async function GET(request:Request){
  const organizer=await requireOrganizerRequest(request);if(!organizer)return Response.json({error:'Organizer sign-in required.'},{status:401});
  const assessmentId=new URL(request.url).searchParams.get('assessmentId');if(!assessmentId)return Response.json({error:'Choose an assessment.'},{status:400});await ensureResultSchema();
  const assessment=await getAssessment(assessmentId);if(!assessment)return Response.json({error:'Assessment not found.'},{status:404});
  const [summary,run,metrics,candidates,excluded]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS eligible,COALESCE(MAX(score),0) AS highest,COALESCE(AVG(score),0) AS average,COALESCE(AVG(CASE WHEN max_score>0 THEN score*100.0/max_score END),0) AS average_percentage FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NULL`).bind(assessmentId).first<Record<string,unknown>>(),
    env.DB.prepare('SELECT * FROM result_runs WHERE assessment_id=? ORDER BY created_at DESC LIMIT 1').bind(assessmentId).first<Record<string,unknown>>(),
    env.DB.prepare(`SELECT q.id,q.position,q.prompt,q.topic,q.subtopic,q.difficulty,q.marks,m.attempts_count,m.correct_count,m.incorrect_count,m.skipped_count,m.average_awarded,m.average_time_seconds FROM questions q LEFT JOIN question_metrics m ON m.question_id=q.id AND m.assessment_id=q.assessment_id WHERE q.assessment_id=? AND q.is_active=1 ORDER BY q.position`).bind(assessmentId).all<Record<string,unknown>>(),
    env.DB.prepare(`SELECT t.id,t.status,t.score,t.max_score,t.rank,t.percentile,t.correct_count,t.incorrect_count,t.unattempted_count,t.tab_switches,t.excluded_at,t.excluded_reason,t.evaluation_version,t.submitted_at,r.name,r.email,r.college FROM attempts t LEFT JOIN registrations r ON r.assessment_id=t.assessment_id AND r.user_id=t.user_id WHERE t.assessment_id=? AND t.status IN ('submitted','evaluated') ORDER BY CASE WHEN t.rank IS NULL THEN 1 ELSE 0 END,t.rank,t.submitted_at`).bind(assessmentId).all<Record<string,unknown>>(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NOT NULL`).bind(assessmentId).first<{total:number}>(),
  ]);
  return Response.json({assessment,summary:{eligible:Number(summary?.eligible||0),excluded:Number(excluded?.total||0),highest:Number(summary?.highest||0),average:Number(Number(summary?.average||0).toFixed(2)),averagePercentage:Number(Number(summary?.average_percentage||0).toFixed(1))},lastRun:run||null,metrics:metrics.results.map((item)=>({...item,attempts_count:Number(item.attempts_count||0),correct_count:Number(item.correct_count||0),incorrect_count:Number(item.incorrect_count||0),skipped_count:Number(item.skipped_count||0),average_awarded:Number(item.average_awarded||0),average_time_seconds:Number(item.average_time_seconds||0)})),candidates:candidates.results});
}

export async function POST(request:Request){
  const blocked=protectMutation(request,{scope:'organizer-results',limit:60});if(blocked)return blocked;
  const organizer=await requireOrganizerRequest(request);if(!organizer)return Response.json({error:'Organizer sign-in required.'},{status:401});await ensureResultSchema();
  const body=await request.json() as {assessmentId?:string;attemptId?:string;action?:string;reason?:string;jobId?:string};if(!body.assessmentId||!body.action)return Response.json({error:'Invalid results action.'},{status:400});
  const assessment=await getAssessment(body.assessmentId);if(!assessment)return Response.json({error:'Assessment not found.'},{status:404});
  const resultStatuses=new Set(['ended','results_processing','results_ready','results_released']);
  if(body.action==='process_batch'){
    if(!body.jobId)return Response.json({error:'Result job is required.'},{status:400});
    try{return Response.json({saved:true,job:await processResultJob(body.jobId,organizer.email)});}catch(reason){return Response.json({error:reason instanceof Error?reason.message:'Could not process this result batch.'},{status:409});}
  }
  if(body.action==='recompute'){
    if(!resultStatuses.has(String(assessment.status)))return Response.json({error:'End the test before computing results.'},{status:409});
    return Response.json({saved:true,job:await startResultJob(body.assessmentId,organizer.email)});
  }
  if(!new Set(['results_processing','results_ready','results_released']).has(String(assessment.status)))return Response.json({error:'Compute results before reviewing candidate attempts.'},{status:409});
  if(!body.attemptId)return Response.json({error:'Choose a candidate attempt.'},{status:400});
  const attempt=await env.DB.prepare("SELECT * FROM attempts WHERE id=? AND assessment_id=? AND status IN ('submitted','evaluated')").bind(body.attemptId,body.assessmentId).first<Record<string,unknown>>();if(!attempt)return Response.json({error:'Submitted attempt not found.'},{status:404});
  const now=Math.floor(Date.now()/1000);
  if(body.action==='exclude'||body.action==='include'){
    const excluded=body.action==='exclude';const reason=(body.reason||'Organizer review').trim().slice(0,300);
    await env.DB.batch([
      env.DB.prepare('UPDATE attempts SET excluded_at=?,excluded_reason=?,updated_at=? WHERE id=?').bind(excluded?now:null,excluded?reason:null,now,body.attemptId),
      env.DB.prepare('INSERT INTO organizer_audit_log (id,assessment_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),body.assessmentId,organizer.email,excluded?'results.attempt_excluded':'results.attempt_restored',JSON.stringify({attemptId:body.attemptId,reason:excluded?reason:null}),now),
    ]);
    return Response.json({saved:true,job:await startResultJob(body.assessmentId,organizer.email)});
  }
  if(body.action==='reevaluate'){
    const questions=await env.DB.prepare(`SELECT id,type,answers_json,accepted_variants_json,tita_tolerance,marks,negative_marks FROM questions WHERE assessment_id=? AND is_active=1 ORDER BY position`).bind(body.assessmentId).all<ScoreQuestion>();
    const scored=scoreAttempt(questions.results,jsonAnswers(attempt.answers_json)),times=jsonNumberMap(attempt.time_spent_json);const details=Object.fromEntries(Object.entries(scored.details).map(([id,detail])=>[id,{...detail,timeSeconds:times[id]||0}]));
    await env.DB.batch([
      env.DB.prepare(`UPDATE attempts SET status='evaluated',result_json=?,score=?,max_score=?,correct_count=?,incorrect_count=?,unattempted_count=?,evaluation_version=evaluation_version+1,scored_at=?,updated_at=? WHERE id=?`).bind(JSON.stringify(details),scored.score,scored.maxScore,scored.correct,scored.incorrect,scored.unattempted,now,now,body.attemptId),
      env.DB.prepare('INSERT INTO organizer_audit_log (id,assessment_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),body.assessmentId,organizer.email,'results.attempt_reevaluated',JSON.stringify({attemptId:body.attemptId,score:scored.score}),now),
    ]);
    return Response.json({saved:true,job:await startResultJob(body.assessmentId,organizer.email)});
  }
  return Response.json({error:'Invalid results action.'},{status:400});
}
