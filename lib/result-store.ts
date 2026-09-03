import { env } from 'cloudflare:workers';
import { ensureCandidateSchema } from './candidate-store';

type D1Column={name:string};
async function columnSet(table:string){const result=await env.DB.prepare(`PRAGMA table_info(${table})`).all<D1Column>();return new Set(result.results.map((item)=>item.name));}

export async function ensureResultSchema(){
  // Result schema changes are deploy-time migrations, never request-time work.
  if(true)return;
  await ensureCandidateSchema();
  const trackerApplied=await env.DB.prepare('SELECT id FROM app_migrations WHERE id=?').bind('attempt_error_tracker_v1').first();
  if(!trackerApplied){
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS attempt_error_tags (attempt_id TEXT NOT NULL,question_id TEXT NOT NULL,tag TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL,PRIMARY KEY (attempt_id,question_id))`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_attempt_error_tags_attempt ON attempt_error_tags (attempt_id)'),
      env.DB.prepare('INSERT OR IGNORE INTO app_migrations (id,applied_at) VALUES (?,?)').bind('attempt_error_tracker_v1',Math.floor(Date.now()/1000)),
    ]);
  }
  const applied=await env.DB.prepare('SELECT id FROM app_migrations WHERE id=?').bind('result_analytics_v1').first();if(applied)return;
  const attemptColumns=await columnSet('attempts');
  if(!attemptColumns.has('evaluation_version'))await env.DB.batch([
    env.DB.prepare(`CREATE TABLE attempts_results_new (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'started',answers_json TEXT NOT NULL DEFAULT '{}',marked_json TEXT NOT NULL DEFAULT '[]',answered_count INTEGER NOT NULL DEFAULT 0,tab_switches INTEGER NOT NULL DEFAULT 0,violations_json TEXT NOT NULL DEFAULT '[]',paper_version INTEGER NOT NULL DEFAULT 0,shuffle_seed TEXT NOT NULL DEFAULT '',question_order_json TEXT NOT NULL DEFAULT '[]',answer_version INTEGER NOT NULL DEFAULT 0,last_checkpoint_at INTEGER,result_json TEXT NOT NULL DEFAULT '{}',time_spent_json TEXT NOT NULL DEFAULT '{}',score REAL,max_score REAL,correct_count INTEGER,incorrect_count INTEGER,unattempted_count INTEGER,percentile REAL,rank INTEGER,excluded_at INTEGER,excluded_reason TEXT,evaluation_version INTEGER NOT NULL DEFAULT 1,started_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,submitted_at INTEGER,scored_at INTEGER,updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`INSERT INTO attempts_results_new (id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,paper_version,shuffle_seed,question_order_json,answer_version,last_checkpoint_at,result_json,score,max_score,correct_count,incorrect_count,unattempted_count,percentile,rank,started_at,expires_at,submitted_at,scored_at,updated_at) SELECT id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,paper_version,shuffle_seed,question_order_json,answer_version,last_checkpoint_at,result_json,score,max_score,correct_count,incorrect_count,unattempted_count,percentile,rank,started_at,expires_at,submitted_at,scored_at,updated_at FROM attempts`),
    env.DB.prepare('DROP TABLE attempts'),env.DB.prepare('ALTER TABLE attempts_results_new RENAME TO attempts')
  ]);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS question_metrics (assessment_id TEXT NOT NULL,question_id TEXT NOT NULL,attempts_count INTEGER NOT NULL DEFAULT 0,correct_count INTEGER NOT NULL DEFAULT 0,incorrect_count INTEGER NOT NULL DEFAULT 0,skipped_count INTEGER NOT NULL DEFAULT 0,average_awarded REAL NOT NULL DEFAULT 0,average_time_seconds REAL NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,PRIMARY KEY (assessment_id,question_id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS result_runs (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,eligible_attempts INTEGER NOT NULL,excluded_attempts INTEGER NOT NULL,highest_score REAL NOT NULL DEFAULT 0,average_score REAL NOT NULL DEFAULT 0,summary_json TEXT NOT NULL DEFAULT '{}',created_by TEXT NOT NULL,created_at INTEGER NOT NULL)`),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_assessment_user ON attempts (assessment_id,user_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_assessment_status ON attempts (assessment_id,status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_assessment_score ON attempts (assessment_id,score)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_assessment_rank ON attempts (assessment_id,rank)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_result_runs_assessment_created ON result_runs (assessment_id,created_at)'),
  ]);
  await env.DB.prepare('INSERT OR IGNORE INTO app_migrations (id,applied_at) VALUES (?,?)').bind('result_analytics_v1',Math.floor(Date.now()/1000)).run();
  await env.DB.prepare('PRAGMA optimize').run();
}

export async function recomputeResults(assessmentId:string,actorEmail:string){
  await ensureResultSchema();const now=Math.floor(Date.now()/1000);
  await env.DB.batch([
    env.DB.prepare(`WITH ranked AS (SELECT id,ROW_NUMBER() OVER (ORDER BY score DESC,(submitted_at-started_at) ASC,submitted_at ASC,id ASC) AS rank_value,ROUND(100.0*CUME_DIST() OVER (ORDER BY score ASC),2) AS percentile_value FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NULL AND score IS NOT NULL) UPDATE attempts SET rank=(SELECT rank_value FROM ranked WHERE ranked.id=attempts.id),percentile=(SELECT percentile_value FROM ranked WHERE ranked.id=attempts.id),updated_at=? WHERE assessment_id=? AND id IN (SELECT id FROM ranked)`).bind(assessmentId,now,assessmentId),
    env.DB.prepare('UPDATE attempts SET rank=NULL,percentile=NULL,updated_at=? WHERE assessment_id=? AND excluded_at IS NOT NULL').bind(now,assessmentId),
    env.DB.prepare('DELETE FROM question_metrics WHERE assessment_id=?').bind(assessmentId),
    env.DB.prepare(`INSERT INTO question_metrics (assessment_id,question_id,attempts_count,correct_count,incorrect_count,skipped_count,average_awarded,average_time_seconds,updated_at) SELECT ?,j.key,COUNT(*),SUM(CASE WHEN json_extract(j.value,'$.status')='correct' THEN 1 ELSE 0 END),SUM(CASE WHEN json_extract(j.value,'$.status')='incorrect' THEN 1 ELSE 0 END),SUM(CASE WHEN json_extract(j.value,'$.status')='unattempted' THEN 1 ELSE 0 END),ROUND(AVG(COALESCE(json_extract(j.value,'$.awarded'),0)),3),ROUND(AVG(COALESCE(json_extract(j.value,'$.timeSeconds'),0)),2),? FROM attempts a,json_each(a.result_json) j WHERE a.assessment_id=? AND a.status IN ('submitted','evaluated') AND a.excluded_at IS NULL GROUP BY j.key`).bind(assessmentId,now,assessmentId),
  ]);
  const summary=await env.DB.prepare(`SELECT COUNT(*) AS eligible_attempts,COALESCE(MAX(score),0) AS highest_score,COALESCE(AVG(score),0) AS average_score,COALESCE(AVG(CASE WHEN max_score>0 THEN score*100.0/max_score END),0) AS average_percentage FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NULL`).bind(assessmentId).first<{eligible_attempts:number;highest_score:number;average_score:number;average_percentage:number}>();
  const excluded=await env.DB.prepare(`SELECT COUNT(*) AS total FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NOT NULL`).bind(assessmentId).first<{total:number}>();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO result_runs (id,assessment_id,eligible_attempts,excluded_attempts,highest_score,average_score,summary_json,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),assessmentId,Number(summary?.eligible_attempts||0),Number(excluded?.total||0),Number(summary?.highest_score||0),Number(summary?.average_score||0),JSON.stringify({averagePercentage:Number(summary?.average_percentage||0)}),actorEmail,now),
    env.DB.prepare(`INSERT INTO organizer_audit_log (id,assessment_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),assessmentId,actorEmail,'results.recomputed',JSON.stringify({eligible:Number(summary?.eligible_attempts||0),excluded:Number(excluded?.total||0)}),now),
  ]);
  return {eligible:Number(summary?.eligible_attempts||0),excluded:Number(excluded?.total||0),highestScore:Number(summary?.highest_score||0),averageScore:Number(summary?.average_score||0),averagePercentage:Number(summary?.average_percentage||0)};
}

type ResultJobRow={id:string;assessment_id:string;status:string;phase:string;cursor:number;total_questions:number;created_by:string;error_text:string|null;created_at:number;updated_at:number;completed_at:number|null};
const jobView=(job:ResultJobRow)=>({id:job.id,assessmentId:job.assessment_id,status:job.status,phase:job.phase,cursor:Number(job.cursor),totalQuestions:Number(job.total_questions),progress:job.status==='complete'?100:job.phase==='rank'?5:job.phase==='finalize'?95:Math.min(90,10+Math.round(80*Number(job.cursor)/Math.max(1,Number(job.total_questions))))});

export async function startResultJob(assessmentId:string,actorEmail:string){
  const now=Math.floor(Date.now()/1000),id=crypto.randomUUID();
  const total=await env.DB.prepare('SELECT COUNT(*) AS total FROM questions WHERE assessment_id=? AND is_active=1').bind(assessmentId).first<{total:number}>();
  await env.DB.batch([
    env.DB.prepare("UPDATE result_jobs SET status='cancelled',updated_at=? WHERE assessment_id=? AND status IN ('pending','running')").bind(now,assessmentId),
    env.DB.prepare('DELETE FROM question_metrics WHERE assessment_id=?').bind(assessmentId),
    env.DB.prepare("INSERT INTO result_jobs (id,assessment_id,status,phase,cursor,total_questions,created_by,created_at,updated_at) VALUES (?,?,'pending','rank',0,?,?,?,?)").bind(id,assessmentId,Number(total?.total||0),actorEmail,now,now),
  ]);
  return jobView({id,assessment_id:assessmentId,status:'pending',phase:'rank',cursor:0,total_questions:Number(total?.total||0),created_by:actorEmail,error_text:null,created_at:now,updated_at:now,completed_at:null});
}

export async function processResultJob(jobId:string,actorEmail:string){
  const job=await env.DB.prepare('SELECT * FROM result_jobs WHERE id=?').bind(jobId).first<ResultJobRow>();
  if(!job)throw new Error('Result job not found.');
  if(job.status==='complete'||job.status==='cancelled')return jobView(job);
  const now=Math.floor(Date.now()/1000);
  if(job.phase==='rank'){
    await env.DB.batch([
      env.DB.prepare(`WITH ranked AS (SELECT id,ROW_NUMBER() OVER (ORDER BY score DESC,(submitted_at-started_at) ASC,submitted_at ASC,id ASC) AS rank_value,ROUND(100.0*CUME_DIST() OVER (ORDER BY score ASC),2) AS percentile_value FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NULL AND score IS NOT NULL) UPDATE attempts SET rank=(SELECT rank_value FROM ranked WHERE ranked.id=attempts.id),percentile=(SELECT percentile_value FROM ranked WHERE ranked.id=attempts.id),updated_at=? WHERE assessment_id=? AND id IN (SELECT id FROM ranked)`).bind(job.assessment_id,now,job.assessment_id),
      env.DB.prepare('UPDATE attempts SET rank=NULL,percentile=NULL,updated_at=? WHERE assessment_id=? AND excluded_at IS NOT NULL').bind(now,job.assessment_id),
      env.DB.prepare("UPDATE result_jobs SET status='running',phase='metrics',updated_at=? WHERE id=?").bind(now,job.id),
    ]);
    return {...jobView({...job,status:'running',phase:'metrics',updated_at:now}),progress:10};
  }
  if(job.phase==='metrics'){
    const questions=await env.DB.prepare('SELECT id FROM questions WHERE assessment_id=? AND is_active=1 ORDER BY position LIMIT 10 OFFSET ?').bind(job.assessment_id,Number(job.cursor)).all<{id:string}>();
    const ids=questions.results.map((item)=>item.id);
    if(ids.length){
      const placeholders=ids.map(()=>'?').join(',');
      await env.DB.prepare(`INSERT OR REPLACE INTO question_metrics (assessment_id,question_id,attempts_count,correct_count,incorrect_count,skipped_count,average_awarded,average_time_seconds,updated_at) SELECT ?,j.key,COUNT(*),SUM(CASE WHEN json_extract(j.value,'$.status')='correct' THEN 1 ELSE 0 END),SUM(CASE WHEN json_extract(j.value,'$.status')='incorrect' THEN 1 ELSE 0 END),SUM(CASE WHEN json_extract(j.value,'$.status')='unattempted' THEN 1 ELSE 0 END),ROUND(AVG(COALESCE(json_extract(j.value,'$.awarded'),0)),3),ROUND(AVG(COALESCE(json_extract(j.value,'$.timeSeconds'),0)),2),? FROM attempts a,json_each(a.result_json) j WHERE a.assessment_id=? AND a.status IN ('submitted','evaluated') AND a.excluded_at IS NULL AND j.key IN (${placeholders}) GROUP BY j.key`).bind(job.assessment_id,now,job.assessment_id,...ids).run();
    }
    const cursor=Number(job.cursor)+ids.length,phase=cursor>=Number(job.total_questions)?'finalize':'metrics';
    await env.DB.prepare("UPDATE result_jobs SET status='running',phase=?,cursor=?,updated_at=? WHERE id=?").bind(phase,cursor,now,job.id).run();
    return jobView({...job,status:'running',phase,cursor,updated_at:now});
  }
  const summary=await env.DB.prepare(`SELECT COUNT(*) AS eligible_attempts,COALESCE(MAX(score),0) AS highest_score,COALESCE(AVG(score),0) AS average_score,COALESCE(AVG(CASE WHEN max_score>0 THEN score*100.0/max_score END),0) AS average_percentage FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NULL`).bind(job.assessment_id).first<{eligible_attempts:number;highest_score:number;average_score:number;average_percentage:number}>();
  const excluded=await env.DB.prepare(`SELECT COUNT(*) AS total FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NOT NULL`).bind(job.assessment_id).first<{total:number}>();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO result_runs (id,assessment_id,eligible_attempts,excluded_attempts,highest_score,average_score,summary_json,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),job.assessment_id,Number(summary?.eligible_attempts||0),Number(excluded?.total||0),Number(summary?.highest_score||0),Number(summary?.average_score||0),JSON.stringify({averagePercentage:Number(summary?.average_percentage||0)}),actorEmail,now),
    env.DB.prepare(`INSERT INTO organizer_audit_log (id,assessment_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),job.assessment_id,actorEmail,'results.recomputed_batched',JSON.stringify({eligible:Number(summary?.eligible_attempts||0),excluded:Number(excluded?.total||0),jobId:job.id}),now),
    env.DB.prepare("UPDATE result_jobs SET status='complete',phase='complete',updated_at=?,completed_at=? WHERE id=?").bind(now,now,job.id),
  ]);
  return {...jobView({...job,status:'complete',phase:'complete',updated_at:now,completed_at:now}),summary:{eligible:Number(summary?.eligible_attempts||0),excluded:Number(excluded?.total||0),highestScore:Number(summary?.highest_score||0),averageScore:Number(summary?.average_score||0)}};
}
