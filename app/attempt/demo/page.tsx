import TestRunner from './TestRunner';
import { redirect } from 'next/navigation';
import { getSession } from '../../../lib/auth';

export const metadata = { title: 'Demo Attempt | C&Assess' };
export const dynamic = 'force-dynamic';

export default async function DemoAttemptPage() {
  const session = await getSession();
  if (!session) redirect('/signin?returnTo=/attempt/demo');
  return <TestRunner candidate={{ name: session.name, email: session.email }} />;
}
