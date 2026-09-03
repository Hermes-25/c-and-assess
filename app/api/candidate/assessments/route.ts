import { env } from 'cloudflare:workers';
import { getRequestSession } from '../../../../lib/auth';
import { ensureCandidateSchema, safeCandidateAssessment } from '../../../../lib/candidate-store';

export async function GET(request:Request){
  const user=await getRequestSession(request);if(!user)return Response.json({error:'Sign in required.'},{status:401});
  await ensureCandidateSchema();
  const [result,profile]=await Promise.all([env.DB.prepare(`SELECT a.*,r.status AS registration_status,t.id AS attempt_id,t.status AS attempt_status
    FROM assessments a LEFT JOIN registrations r ON r.assessment_id=a.id AND r.user_id=?
    LEFT JOIN attempts t ON t.assessment_id=a.id AND t.user_id=?
    WHERE a.status NOT IN ('draft','archived') ORDER BY a.starts_at DESC LIMIT 50`).bind(user.sub,user.sub).all<Record<string,unknown>>(),
    env.DB.prepare(`SELECT college,graduation_year,branch FROM registrations WHERE user_id=? AND college IS NOT NULL ORDER BY updated_at DESC LIMIT 1`).bind(user.sub).first<Record<string,unknown>>()]);
  return Response.json({assessments:result.results.map(safeCandidateAssessment),profile:profile?{college:String(profile.college||''),graduationYear:Number(profile.graduation_year||0),branch:String(profile.branch||'')}:null,serverNow:Math.floor(Date.now()/1000)});
}
