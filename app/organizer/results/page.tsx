import { AdminNav } from '../../_components/AdminNav';
import { ResultsManager } from './ResultsManager';
export const metadata={title:'Results control room | C&Assess'};
export default function OrganizerResultsPage(){return <main className="admin-shell"><AdminNav active="Results"/><section className="admin-main"><header className="admin-topbar"><div><span>Organizer / Results</span><h1>Results control room</h1></div><span className="draft-label">Audited controls</span></header><div className="admin-content"><ResultsManager/></div></section></main>;}
