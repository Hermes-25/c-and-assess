/* eslint-disable @next/next/no-html-link-for-pages */
import { getSession } from '../lib/auth';
const skills = ['Quantitative aptitude', 'Logical reasoning', 'Data interpretation'];

const analysisFeatures = [
  ['01 · Benchmark', 'Score, rank and percentile', 'See your position overall and by section.'],
  ['02 · Diagnosis', 'Topic and difficulty gaps', 'Find where accuracy or attempts broke down.'],
  ['03 · Time', 'Where minutes leaked', 'Compare time on correct, incorrect and skipped questions.'],
  ['04 · Action', 'What to practise next', 'Get recommendations, solutions and a private error tracker.'],
];

const integrityRules = [
  ['01', 'Full-screen test mode', 'The attempt behaves like a structured online assessment and warns you before the mode is enforced.'],
  ['02', 'Declared tab-switch limit', 'You see the limit and your warning count throughout the test.'],
  ['03', 'Shuffled paper conditions', 'Question and option order can vary between candidates for a fairer attempt.'],
  ['04', 'Autosave and recovery', 'Answers save quietly so a weak connection does not erase your work.'],
];

const steps = [
  ['01', 'Register', 'Use Google. No new password to remember.'],
  ['02', 'Read the rules', 'Check device, timing, marking and integrity conditions.'],
  ['03', 'Attempt the assessment', 'Use a focused test interface with autosave and review flags.'],
  ['04', 'Study your report', 'Review percentile, time, topics, solutions and next steps.'],
];

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getSession();
  const assessmentHref = session ? '/assessments' : '/api/auth/google?returnTo=%2Fassessments';
  return (
    <main className="landing-page">
      <section className="landing-hero" id="top">
        <nav className="landing-nav" aria-label="Main navigation">
          <a className="brand" href="#top" aria-label="C&Assess home">
            <img src="/brand/cna-logo.svg" alt="Consulting & Analytics Club, IIT Guwahati" />
            <span className="brand-product">C&amp;Assess</span>
          </a>
          <div className="landing-nav-links">
            <a href="#active-mock">Assessments</a><a href="#analysis">Analysis</a><a href="#questions">Questions</a><a className="landing-nav-signin" href={assessmentHref}>{session?'My assessments':'Continue with Google'}</a>
          </div>
        </nav>

        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-kicker">C&amp;A Assessment Platform · Free for participants</p>
            <h1>Assess fairly. Learn exactly what changed.</h1>
            <p>Timed online assessments for placement preparation, internship preparation and C&amp;A initiatives—with clear integrity controls and detailed reports covering score, percentile, time use, topic gaps and next steps.</p>
            <div className="landing-hero-actions">
              <a className="landing-primary-action" href={assessmentHref}><span>{session?'Open my assessment desk':'View live assessments with Google'}</span><span>→</span></a>
              <a className="landing-secondary-link" href="/results/demo">Preview your analysis <span>↗</span></a>
            </div>
            <div className="landing-hero-facts" aria-label="Assessment highlights"><span>Flexible formats</span><span>Clear integrity rules</span><span>Answers autosave</span><span>Deep post-test analysis</span></div>
          </div>

          <aside className="landing-sample-report" aria-label="Sample post-test analysis">
            <div className="landing-report-label"><strong>What you get after the test</strong><span>Sample data</span></div>
            <div className="landing-score-row"><div><span>Score</span><strong>72/100</strong></div><div><span>Percentile</span><strong>84.2</strong></div><div><span>Accuracy</span><strong>76%</strong></div></div>
            <div className="landing-report-insight"><small>Your clearest next step</small><strong>Attempt more Data Interpretation sets without sacrificing accuracy.</strong></div>
            <div className="landing-report-list"><div><span>Strongest area</span><strong>Logical reasoning</strong></div><div><span>Largest time leak</span><strong>Quantitative aptitude</strong></div><div><span>Marks left on table</span><strong>14</strong></div></div>
            <a href="/results/demo">Explore the full sample report <span>→</span></a>
          </aside>
        </div>
      </section>

      <section className="landing-shell" id="active-mock">
        <div className="landing-section-head"><div><p>Open assessment</p><h2>Placement Readiness Mock 01</h2></div><span className="landing-status"><i /> Registration open</span></div>
        <div className="landing-assessment">
          <article className="landing-assessment-main">
            <div className="landing-meta"><span>60 questions</span><span>60 minutes</span><span>100 marks</span><span>Free</span></div>
            <h3>A full screening-round rehearsal.</h3>
            <p>Original questions built around recurring patterns in company online assessments—not copied company papers. Questions and options are shuffled for a fair attempt.</p>
            <div className="landing-skill-list">{skills.map((skill, index) => <div key={skill}><span>0{index + 1}</span><strong>{skill}</strong></div>)}</div>
            <div className="landing-assessment-action"><p><strong>Live schedule is shown after sign-in</strong><br />Anyone with an eligible Google account can register.</p><a className="landing-dark-action" href={assessmentHref}><span>{session?'Open assessment desk':'Register with Google'}</span><span>→</span></a></div>
          </article>
          <aside className="landing-before-you-begin">
            <p className="landing-section-label">Before you begin</p><strong>You will know the rules, result timing and required setup before the timer starts.</strong>
            <ul><li>Use a laptop or desktop with a stable modern browser.</li><li>You can move between questions and edit answers.</li><li>Solutions unlock after the assessment window closes.</li></ul>
            <small>Need help? Contact caciitg@gmail.com or cac@iitg.ac.in.</small>
          </aside>
        </div>
      </section>

      <section className="landing-shell landing-analysis" id="analysis">
        <div className="landing-analysis-grid">
          <div className="landing-analysis-copy"><p className="landing-section-label">Analysis that earns the attempt</p><h2>A score tells you where you landed. We show you how to move.</h2><p>Your report separates knowledge gaps from time-management mistakes and poor question selection. Review every question, compare section performance and leave with a focused practice plan.</p><a href="/results/demo">Open the complete analysis demo <span>↗</span></a></div>
          <div className="landing-analysis-features">{analysisFeatures.map(([label, title, description]) => <article key={label}><span>{label}</span><strong>{title}</strong><small>{description}</small></article>)}</div>
        </div>
      </section>

      <section className="landing-shell landing-integrity">
        <div className="landing-integrity-grid">
          <div className="landing-integrity-copy"><p className="landing-kicker">Structured assessment conditions</p><h2>Pressure that prepares you. Rules that stay clear.</h2><p>C&amp;Assess supports timed mocks, internship preparation and club evaluations while explaining every restriction before the timer begins.</p></div>
          <div className="landing-rule-list">{integrityRules.map(([number, title, description]) => <div key={number}><span>{number}</span><section><strong>{title}</strong><p>{description}</p></section></div>)}</div>
        </div>
      </section>

      <section className="landing-shell" id="how-it-works">
        <div className="landing-section-head"><div><p>How it works</p><h2>One clear path from registration to improvement.</h2></div></div>
        <div className="landing-process">{steps.map(([number, title, description]) => <article key={number}><span>{number}</span><strong>{title}</strong><p>{description}</p></article>)}</div>
      </section>

      <section className="landing-shell landing-question-quality">
        <div><p className="landing-section-label">Question quality</p><h2>Built for the skills each assessment needs to measure.</h2></div>
        <div><p>C&amp;Assess supports original question sets for analytics, consulting, product, finance, aptitude and other C&amp;A initiatives. Every paper can be reviewed for topic, difficulty and solution quality before publication.</p><strong>No mystery criteria. Just transparent, purpose-built assessments.</strong></div>
      </section>

      <section className="landing-shell landing-faq" id="questions">
        <div><p className="landing-section-label">Common questions</p><h2>Know before you register.</h2></div>
        <div><details open><summary>Is C&amp;Assess free?</summary><p>Yes. Assessments published by the C&amp;A Team are free for eligible participants.</p></details><details><summary>Who creates the questions?</summary><p>Question sets are prepared or curated by the C&amp;A Team for the purpose of each assessment. The assessment brief tells you what to expect before registration.</p></details><details><summary>When will I see solutions and percentile?</summary><p>Your attempt is saved on submission. Final percentile, rank and solutions are released according to the organizer’s result policy.</p></details><details><summary>What happens if my internet drops?</summary><p>Your recent answers are autosaved. The attempt resumes from the last confirmed save when you reconnect.</p></details><details><summary>What integrity rules apply?</summary><p>The pre-test screen explains full-screen mode, tab-switch limits, copy/paste controls and paper shuffling before you consent and begin.</p></details></div>
      </section>

      <section className="landing-final-cta"><div><p className="landing-section-label">C&amp;A Assessment Platform</p><h2>Attempt with clarity. Learn exactly what to change.</h2><p>See live registrations, assessment windows and released reports on your candidate desk.</p></div><a className="landing-primary-action" href={assessmentHref}><span>{session?'Open my assessments':'Continue with Google'}</span><span>→</span></a></section>
      <footer><p>Consulting &amp; Analytics Club · IIT Guwahati</p><p>Built by Abhishek Das · Maintained by the C&amp;A Team</p></footer>
    </main>
  );
}
