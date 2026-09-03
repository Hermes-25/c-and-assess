import { ProductHeader } from '../../_components/ProductHeader';
import { ResultDashboard } from './ResultDashboard';
import { getSession } from '../../../lib/auth';

export const metadata = { title: 'Your analysis | C&Assess' };
export const dynamic = 'force-dynamic';

export default async function ResultPage() {
  const session = await getSession();
  return (
    <main className="product-page analysis-page">
      <ProductHeader context="Candidate analysis" user={session ? { name: session.name, role: session.role } : undefined} />
      <ResultDashboard />
    </main>
  );
}
