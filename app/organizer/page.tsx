import { AdminNav } from '../_components/AdminNav';
import { OrganizerDashboard } from './OrganizerDashboard';

export const metadata = { title: 'Organizer overview | C&Assess' };
export default function OrganizerPage() {
  return (
    <main className="admin-shell">
      <AdminNav active="Overview" />
      <section className="admin-main">
        <header className="admin-topbar"><div><span>Organizer / Tests</span><h1>Operations dashboard</h1></div><a className="solid-action small" href="/organizer/new">New test <span>→</span></a></header>
        <OrganizerDashboard/>
      </section>
    </main>
  );
}
