/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- The club logo is served directly so this edge deployment does not require an image-optimization service. */
import { getSession } from '../../lib/auth';

const links = [
  ['Overview', '/organizer'],
  ['New test', '/organizer/new'],
  ['Assessment', '/organizer/assessment'],
  ['Questions', '/organizer/questions'],
  ['Participants', '/organizer/participants'],
  ['Results', '/organizer/results'],
];

export async function AdminNav({ active }: { active: string }) {
  const session = await getSession();
  return (
    <aside className="admin-nav">
      <div className="admin-identity"><img src="/brand/cna-logo.svg" alt="Consulting & Analytics Club, IIT Guwahati"/><div><strong>C&amp;Assess</strong><small>Organizer workspace</small></div></div>
      <nav aria-label="Organizer navigation">
        {links.map(([label, href]) => <a className={active === label ? 'active' : ''} href={href} key={label}>{label}</a>)}
      </nav>
      <div className="admin-exit-links"><a href="/assessments">Candidate assessment desk</a><a href="/">C&amp;Assess home</a><a href="/api/auth/signout?returnTo=/">Sign out</a></div>
      <div className="admin-credit">Built by Abhishek Das<br/>Maintained by the C&amp;A Team</div><div className="admin-account"><span>{session?.name?.slice(0,2).toUpperCase()||'CA'}</span><div><strong>{session?.name||'Club admin'}</strong><small>{session?.email||'Organizer account'}</small></div></div>
    </aside>
  );
}
