import { redirect } from 'next/navigation';import { getSession } from '../../../lib/auth';import { RealResultDashboard } from './RealResultDashboard';
export const metadata={title:'My analysis | C&Assess'};export const dynamic='force-dynamic';
export default async function ResultPage({params}:{params:Promise<{attemptId:string}>}){const session=await getSession();const {attemptId}=await params;if(!session)redirect(`/signin?returnTo=${encodeURIComponent(`/results/${attemptId}`)}`);return <RealResultDashboard attemptId={attemptId} candidate={session.name}/>;}
