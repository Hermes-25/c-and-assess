import { AdminNav } from '../../_components/AdminNav';
import { NewTestForm } from './NewTestForm';

export const metadata = { title: 'Create test | C&Assess' };
export default function NewTestPage() {
  return <main className="admin-shell"><AdminNav active="New test"/><section className="admin-main"><header className="admin-topbar"><div><span>Organizer / Tests</span><h1>Create a new test</h1></div></header><div className="admin-content"><NewTestForm/></div></section></main>;
}
