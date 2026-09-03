import { AdminNav } from '../../_components/AdminNav';
import { AssessmentEditor } from './AssessmentEditor';

export const metadata = { title: 'Assessment setup | C&Assess' };
export default function AssessmentPage() {
  return <main className="admin-shell"><AdminNav active="Assessment" /><section className="admin-main"><header className="admin-topbar"><div><span>Organizer / Assessment builder</span><h1>Assessment setup</h1></div></header><div className="admin-content"><div className="setup-tabs"><a className="active" href="#basic">Basic info</a><a href="#window">Access window</a><a href="#rules">Rules & integrity</a><a href="/organizer/questions">Question paper</a></div><AssessmentEditor/></div></section></main>;
}
