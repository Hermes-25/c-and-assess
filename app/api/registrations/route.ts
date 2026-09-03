import { env } from 'cloudflare:workers';
import { getRequestSession, requireOrganizerRequest } from '../../../lib/auth';
import { ensureCandidateSchema } from '../../../lib/candidate-store';
import { parseSettings } from '../../../lib/assessment-store';
import { protectMutation } from '../../../lib/request-security';

export async function GET(request:Request){
  const organizer=await requireOrganizerRequest(request);if(!organizer)return Response.json({error:'Organizer sign-in required.'},{status:401});
  await ensureCandidateSchema();const assessmentId=new URL(request.url).searchParams.get('assessmentId');if(!assessmentId)return Response.json({registrations:[]});
  const result=await env.DB.prepare(`SELECT r.*,t.id AS attempt_id,t.status AS attempt_status,t.score,t.max_score,t.answered_count,t.tab_switches,t.submitted_at
    FROM registrations r LEFT JOIN attempts t ON t.assessment_id=r.assessment_id AND t.user_id=r.user_id
    WHERE r.assessment_id=? ORDER BY r.registered_at DESC LIMIT 10000`).bind(assessmentId).all();
  return Response.json({registrations:result.results});
}

export async function POST(request:Request){
  const blocked=protectMutation(request,{scope:'registration',limit:12});if(blocked)return blocked;
  const session=await getRequestSession(request);if(!session)return Response.json({error:'Sign in required.'},{status:401});
  await ensureCandidateSchema();const body=await request.json() as {assessmentId?:string;college?:string;graduationYear?:number;branch?:string;consent?:boolean;action?:'block'|'unblock';registrationId?:string;reason?:string};
  if(body.action){
    if(session.role!=='organizer'||!body.registrationId)return Response.json({error:'Organizer access required.'},{status:403});
    const status=body.action==='block'?'blocked':'registered';
    await env.DB.prepare('UPDATE registrations SET status=?,blocked_reason=?,updated_at=? WHERE id=?').bind(status,body.action==='block'?(body.reason?.trim()||'Blocked by organizer'):null,Math.floor(Date.now()/1000),body.registrationId).run();
    return Response.json({saved:true,status});
  }
  if(!body.assessmentId||!body.consent)return Response.json({error:'Assessment and consent are required.'},{status:400});
  const college=body.college?.trim().slice(0,160)||'';const branch=body.branch?.trim().slice(0,120)||'';const graduationYear=Number(body.graduationYear);
  if(!college||!branch||!Number.isInteger(graduationYear)||graduationYear<2020||graduationYear>2040)return Response.json({error:'College, branch and a valid graduation year are required.'},{status:400});
  const assessment=await env.DB.prepare('SELECT status,registration_starts_at,registration_ends_at,settings_json FROM assessments WHERE id=?').bind(body.assessmentId).first<{status:string;registration_starts_at:number|null;registration_ends_at:number|null;settings_json:string}>();
  if(!assessment)return Response.json({error:'Assessment not found.'},{status:404});const now=Math.floor(Date.now()/1000);
  if(['draft','ended','archived','results_processing','results_ready','results_released'].includes(assessment.status)||!assessment.registration_starts_at||!assessment.registration_ends_at||now<assessment.registration_starts_at||now>assessment.registration_ends_at)return Response.json({error:'Registration is not open for this assessment.'},{status:409});
  const settings=parseSettings(assessment.settings_json);const domain=session.email.split('@')[1]?.toLowerCase()||'';
  if(settings.audience==='domains'&&!settings.allowedDomains.includes(domain))return Response.json({error:'This email domain is not eligible for this assessment.'},{status:403});
  if(settings.registrationCapacity){const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM registrations WHERE assessment_id=? AND status!='blocked'").bind(body.assessmentId).first<{total:number}>();if(Number(count?.total||0)>=settings.registrationCapacity)return Response.json({error:'This assessment has reached its registration capacity.'},{status:409});}
  const existing=await env.DB.prepare('SELECT id,status FROM registrations WHERE assessment_id=? AND user_id=?').bind(body.assessmentId,session.sub).first<{id:string;status:string}>();
  if(existing?.status==='blocked')return Response.json({error:'This registration has been blocked. Contact the organizer.'},{status:403});
  await env.DB.prepare(`INSERT INTO registrations (id,assessment_id,user_id,email,name,college,graduation_year,branch,status,consent_at,profile_json,registered_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,'registered',?,'{}',?,?) ON CONFLICT(assessment_id,user_id) DO UPDATE SET college=excluded.college,graduation_year=excluded.graduation_year,branch=excluded.branch,consent_at=excluded.consent_at,updated_at=excluded.updated_at`)
    .bind(existing?.id||crypto.randomUUID(),body.assessmentId,session.sub,session.email,session.name,college,graduationYear,branch,now,now,now).run();
  return Response.json({registered:true});
}
