import { redirect } from 'next/navigation';import { getSession } from '../../../lib/auth';import { SubmissionReceipt } from './SubmissionReceipt';
export const metadata={title:'Submission received | C&Assess'};export const dynamic='force-dynamic';
export default async function SubmissionPage({params}:{params:Promise<{attemptId:string}>}){const session=await getSession();const {attemptId}=await params;if(!session)redirect(`/signin?returnTo=${encodeURIComponent(`/submission/${attemptId}`)}`);return <SubmissionReceipt attemptId={attemptId} candidate={session.name}/>;}
