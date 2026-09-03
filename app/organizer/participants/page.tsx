import { AdminNav } from '../../_components/AdminNav';
import { ParticipantsManager } from './ParticipantsManager';

export const metadata = { title: 'Participants | C&Assess' };
export default function ParticipantsPage() {
  return (
    <main className="admin-shell"><AdminNav active="Participants" /><section className="admin-main">
      <header className="admin-topbar"><div><span>Organizer / Registrations</span><h1>Participants &amp; submissions</h1></div><span className="draft-label">Live operations</span></header>
      <div className="admin-content"><ParticipantsManager/></div>
    </section></main>
  );
}
