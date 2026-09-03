/* eslint-disable @next/next/no-html-link-for-pages */
import { ProductHeader } from '../_components/ProductHeader';
import { safeReturnTo } from '../../lib/auth';

export const metadata = { title: 'Sign in | C&Assess' };
export const dynamic = 'force-dynamic';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const googleUrl = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <main className="signin-page">
      <ProductHeader compact />
      <section className="signin-layout">
        <div className="signin-message">
          <p className="page-label">Candidate access</p>
          <h1>One sign-in.<br />No new password.</h1>
          <p>Use the account you already have. IIT Guwahati and regular Google accounts are supported.</p>
          <div className="privacy-line"><strong>Your account</strong><span>Name, email, attempts and scores stay linked across mocks.</span></div>
          <div className="privacy-line"><strong>Your report</strong><span>Results and practice recommendations are private by default.</span></div>
        </div>
        <div className="signin-box">
          <h2>Continue with Google</h2>
          <p>Use your Google account to continue. Access to each assessment still follows its published eligibility and registration rules.</p>
          {params.error && <p className="auth-error" role="alert">Google sign-in could not be completed. Please try again.</p>}
          <a className="provider-button" href={googleUrl}><span className="provider-letter google">G</span><b>Continue with Google</b><small>Secure OAuth</small></a>
          <div className="auth-note"><strong>Organizer access</strong><p>Restricted server-side to caciitg@gmail.com and cac@iitg.ac.in after sign-in.</p></div>
          <nav className="signin-legal" aria-label="Legal information"><a href="/privacy">Privacy notice</a><a href="/terms">Terms of use</a></nav>
          <a className="signin-back" href="/">← Back to the mock series</a>
        </div>
      </section>
    </main>
  );
}

