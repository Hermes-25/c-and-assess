/* eslint-disable @next/next/no-html-link-for-pages */
type ProductHeaderProps = { context?: string; compact?: boolean; user?: { name: string; role: 'candidate' | 'organizer' } };

export function ProductHeader({ context, compact = false, user }: ProductHeaderProps) {
  return (
    <header className={`product-header ${compact ? 'product-header-compact' : ''}`}>
      <a className="product-brand" href="/">
        <strong>C&amp;Assess</strong>
      </a>
      {context && <p>{context}</p>}
      <nav aria-label="Account navigation">
        <a href="/assessments">Assessments</a>
        {user?.role === 'organizer' && <a href="/organizer">Organizer workspace</a>}
        {user ? <a className="header-action" href="/api/auth/signout?returnTo=/">Sign out</a> : <a className="header-action" href="/api/auth/google?returnTo=%2Fassessments">Continue with Google</a>}
      </nav>
    </header>
  );
}
