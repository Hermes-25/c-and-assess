import { redirect } from 'next/navigation';import { getSession } from '../../../lib/auth';import { ProductionRunner } from './ProductionRunner';
export const metadata={title:'Assessment attempt | C&Assess'};export const dynamic='force-dynamic';
export default async function AttemptPage({params}:{params:Promise<{attemptId:string}>}){const session=await getSession();const {attemptId}=await params;if(!session)redirect(`/signin?returnTo=${encodeURIComponent(`/attempt/${attemptId}`)}`);return <ProductionRunner attemptId={attemptId} candidate={{name:session.name,email:session.email}}/>;}
