import { AdminNav } from '../../_components/AdminNav';
import QuestionImporter from './QuestionImporter';

export const metadata = { title: 'Upload questions | C&Assess' };
export default function QuestionsPage() {
  return <main className="admin-shell"><AdminNav active="Questions" /><section className="admin-main"><header className="admin-topbar"><div><span>Organizer / Paper publishing</span><h1>Question paper</h1></div><span className="draft-label">Validated CSV workflow</span></header><div className="admin-content"><QuestionImporter /></div></section></main>;
}
