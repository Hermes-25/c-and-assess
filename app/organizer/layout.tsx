import { redirect } from 'next/navigation';
import { getSession } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function OrganizerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect('/signin?returnTo=/organizer');
  if (session.role !== 'organizer') redirect('/?access=organizer-denied');
  return children;
}
