import { env } from 'cloudflare:workers';
import { ensureAssessmentSchema, parseSettings } from './assessment-store';

type D1Column={name:string};
async function columnSet(table:string){const result=await env.DB.prepare(`PRAGMA table_info(${table})`).all<D1Column>();return new Set(result.results.map((item)=>item.name));}

export async function ensureCandidateSchema(){
  // Candidate traffic must never perform schema inspection or DDL.
  if(true)return;
  await ensureAssessmentSchema();
  const applied=await env.DB.prepare('SELECT id FROM app_migrations WHERE id=?').bind('candidate_engine_v1').first(); if(applied)return;
  const attemptColumns=await columnSet('attempts');
  if(!attemptColumns.has('answer_version')) await env.DB.batch([
    env.DB.prepare(`CREATE TABLE attempts_candidate_new (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'started',answers_json TEXT NOT NULL DEFAULT '{}',marked_json TEXT NOT NULL DEFAULT '[]',answered_count INTEGER NOT NULL DEFAULT 0,tab_switches INTEGER NOT NULL DEFAULT 0,violations_json TEXT NOT NULL DEFAULT '[]',paper_version INTEGER NOT NULL DEFAULT 0,shuffle_seed TEXT NOT NULL DEFAULT '',question_order_json TEXT NOT NULL DEFAULT '[]',answer_version INTEGER NOT NULL DEFAULT 0,last_checkpoint_at INTEGER,result_json TEXT NOT NULL DEFAULT '{}',score REAL,max_score REAL,correct_count INTEGER,incorrect_count INTEGER,unattempted_count INTEGER,percentile REAL,rank INTEGER,started_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,submitted_at INTEGER,scored_at INTEGER,updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`INSERT INTO attempts_candidate_new (id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,score,percentile,rank,started_at,expires_at,submitted_at,updated_at) SELECT id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,score,percentile,rank,started_at,expires_at,submitted_at,updated_at FROM attempts`),
    env.DB.prepare('DROP TABLE attempts'),env.DB.prepare('ALTER TABLE attempts_candidate_new RENAME TO attempts')
  ]);
  const registrationColumns=await columnSet('registrations');
  if(!registrationColumns.has('consent_at')) await env.DB.batch([
    env.DB.prepare(`CREATE TABLE registrations_candidate_new (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,user_id TEXT NOT NULL,email TEXT NOT NULL,name TEXT,college TEXT,graduation_year INTEGER,branch TEXT,status TEXT NOT NULL DEFAULT 'registered',consent_at INTEGER,profile_json TEXT NOT NULL DEFAULT '{}',blocked_reason TEXT,registered_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`INSERT INTO registrations_candidate_new (id,assessment_id,user_id,email,name,college,graduation_year,branch,status,registered_at,updated_at) SELECT id,assessment_id,user_id,email,name,college,graduation_year,branch,status,registered_at,updated_at FROM registrations`),
    env.DB.prepare('DROP TABLE registrations'),env.DB.prepare('ALTER TABLE registrations_candidate_new RENAME TO registrations')
  ]);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS proctor_events (id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,event_type TEXT NOT NULL,detail_json TEXT NOT NULL DEFAULT '{}',occurred_at INTEGER NOT NULL)`),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_assessment_user ON attempts (assessment_id,user_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_assessment_status ON attempts (assessment_id,status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_assessment_score ON attempts (assessment_id,score)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_assessment_user ON registrations (assessment_id,user_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_registrations_assessment_status ON registrations (assessment_id,status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_proctor_events_attempt ON proctor_events (attempt_id)'),
  ]);
  await env.DB.prepare('INSERT OR IGNORE INTO app_migrations (id,applied_at) VALUES (?,?)').bind('candidate_engine_v1',Math.floor(Date.now()/1000)).run();
  await env.DB.prepare('PRAGMA optimize').run();
}

export function jsonArray(value:unknown){try{const result=JSON.parse(String(value||'[]'));return Array.isArray(result)?result.map(String):[];}catch{return [];}}
export function jsonAnswers(value:unknown){try{const result=JSON.parse(String(value||'{}')) as Record<string,unknown>;return Object.fromEntries(Object.entries(result).map(([key,item])=>[key,Array.isArray(item)?item.map(String).slice(0,20):[]]));}catch{return {};}}
export function jsonNumberMap(value:unknown){try{const result=JSON.parse(String(value||'{}')) as Record<string,unknown>;return Object.fromEntries(Object.entries(result).map(([key,item])=>[key,Math.max(0,Math.floor(Number(item)||0))]));}catch{return {};}}
function unbiasedRandomIndex(upperExclusive:number){
  const sampleSpace=0x1_0000_0000;
  const rejectionLimit=Math.floor(sampleSpace/upperExclusive)*upperExclusive;
  const bytes=new Uint32Array(1);
  let value:number;
  do{
    crypto.getRandomValues(bytes);
    value=bytes[0];
  }while(value>=rejectionLimit);
  return value%upperExclusive;
}
export function shuffle<T>(values:T[]){const result=[...values];for(let i=result.length-1;i>0;i-=1){const j=unbiasedRandomIndex(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}
export function deterministicShuffle<T>(values:T[],seed:string){let state=2166136261;for(const char of seed)state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;const next=()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};const result=[...values];for(let i=result.length-1;i>0;i-=1){const j=Math.floor(next()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export const safeCandidateAssessment=(row:Record<string,unknown>)=>({id:row.id,slug:row.slug,title:row.title,description:row.description,status:row.status,durationSeconds:row.duration_seconds,registrationStartsAt:row.registration_starts_at,registrationEndsAt:row.registration_ends_at,startsAt:row.starts_at,endsAt:row.ends_at,questionCount:row.question_count,totalMarks:row.total_marks,settings:parseSettings(String(row.settings_json||'{}')),registrationStatus:row.registration_status||null,attemptId:row.attempt_id||null,attemptStatus:row.attempt_status||null});
