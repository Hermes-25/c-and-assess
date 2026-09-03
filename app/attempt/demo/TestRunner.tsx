'use client';
/* eslint-disable @next/next/no-html-link-for-pages */

import { useCallback, useEffect, useMemo, useState } from 'react';

type Question = {
  id: number;
  tag: string;
  type: 'single' | 'multi' | 'tita';
  prompt: string;
  detail?: string;
  options?: string[];
};

const questions: Question[] = [
  { id: 1, tag: 'Quantitative aptitude', type: 'single', prompt: 'A train covers 360 km at a uniform speed. If the speed were 5 km/h more, it would take 48 minutes less. What is the original speed?', options: ['40 km/h', '45 km/h', '50 km/h', '60 km/h'] },
  { id: 2, tag: 'Logical reasoning', type: 'single', prompt: 'Choose the statement that must be true if all analysts are problem-solvers and some researchers are analysts.', options: ['All researchers are problem-solvers', 'Some researchers are problem-solvers', 'No analyst is a researcher', 'Some problem-solvers are not analysts'] },
  { id: 3, tag: 'Data interpretation', type: 'tita', prompt: 'A team completed 72% of 250 planned interviews. Enter the number of interviews completed.', detail: 'Type only the numeric value.' },
  { id: 4, tag: 'Quantitative aptitude', type: 'multi', prompt: 'Which of the following numbers are divisible by both 3 and 4?', options: ['108', '114', '120', '126'] },
  { id: 5, tag: 'Logical reasoning', type: 'single', prompt: 'Find the next term in the sequence: 3, 8, 18, 38, __', options: ['68', '72', '76', '78'] },
  { id: 6, tag: 'Data interpretation', type: 'single', prompt: 'Revenue rose from ₹80 lakh to ₹104 lakh. What was the percentage increase?', options: ['20%', '24%', '30%', '34%'] },
];

export default function TestRunner({ candidate }: { candidate: { name: string; email: string } }) {
  const [started, setStarted] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(60 * 60);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [marked, setMarked] = useState<number[]>([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [notice, setNotice] = useState('Answers are saved automatically.');
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [submitted, setSubmitted] = useState(false);
  const isSubmitted = submitted || (started && seconds === 0) || tabSwitches >= 3;

  const question = questions[current];
  const answered = useMemo(() => Object.values(answers).filter((value) => value.length > 0 && value[0] !== '').length, [answers]);

  useEffect(() => {
    let active = true;
    fetch('/api/attempts/checkpoint?assessmentId=placement-mock-01')
      .then(async (response) => response.ok ? response.json() as Promise<{ checkpoint?: { answers?: Record<number, string[]>; marked?: number[]; tabSwitches?: number } }> : null)
      .then((data) => {
        if (!active || !data?.checkpoint) return;
        setAnswers(data.checkpoint.answers ?? {});
        setMarked(data.checkpoint.marked ?? []);
        setTabSwitches(data.checkpoint.tabSwitches ?? 0);
        setNotice('Your previous saved answers were recovered.');
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const checkpoint = useCallback(async (nextAnswers: Record<number, string[]>, nextSwitches = tabSwitches) => {
    setSaveState('saving');
    try {
      await fetch('/api/attempts/checkpoint', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assessmentId: 'placement-mock-01', answers: nextAnswers, marked, tabSwitches: nextSwitches }),
      });
      setSaveState('saved');
    } catch {
      setNotice('Connection interrupted. Your answer is safe on this device and will retry.');
      setSaveState('saved');
    }
  }, [marked, tabSwitches]);

  useEffect(() => {
    if (!started || isSubmitted) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [started, isSubmitted]);

  useEffect(() => {
    if (!started || isSubmitted) return;
    const block = (event: Event) => { event.preventDefault(); setNotice('Copy, paste and right-click are disabled during this assessment.'); };
    const visibility = () => {
      if (document.hidden) {
        setTabSwitches((value) => {
          const next = value + 1;
          setNotice(`Tab switch recorded (${next}/3). The test will submit after the third switch.`);
          void checkpoint(answers, next);
          return next;
        });
      }
    };
    document.addEventListener('copy', block); document.addEventListener('paste', block); document.addEventListener('contextmenu', block); document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('copy', block); document.removeEventListener('paste', block); document.removeEventListener('contextmenu', block); document.removeEventListener('visibilitychange', visibility); };
  }, [answers, checkpoint, started, isSubmitted]);

  function updateAnswer(value: string) {
    const existing = answers[question.id] ?? [];
    const nextValue = question.type === 'multi'
      ? existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value]
      : [value];
    const next = { ...answers, [question.id]: nextValue };
    setAnswers(next); setNotice('Answer recorded.'); void checkpoint(next);
  }

  async function begin() {
    setStarted(true);
    try { await document.documentElement.requestFullscreen(); } catch { setNotice('Full-screen was not available. This has not been counted as a violation.'); }
  }

  if (!started) {
    return (
      <main className="pretest-page">
        <div className="pretest-card">
          <a className="product-brand dark" href="/"><strong>C&amp;Assess</strong></a>
          <p className="page-label">Placement Readiness Mock 01</p>
          <h1>Before you begin</h1>
          <div className="candidate-identity"><div><span>Signed in as</span><strong>{candidate.name}</strong><small>{candidate.email}</small></div><a href="/api/auth/signout?returnTo=/">Sign out</a></div>
          <p className="pretest-intro">You will have 60 minutes. The timer continues if your connection drops, and your last saved response can be recovered.</p>
          <ul className="rule-list">
            <li><strong>3 tab switches maximum</strong><span>Each switch is shown to you and logged.</span></li>
            <li><strong>No copy, paste or right-click</strong><span>Keyboard navigation remains available.</span></li>
            <li><strong>Full-screen test mode</strong><span>Leaving full-screen or switching tabs adds an integrity warning.</span></li>
          </ul>
          <label className="consent-row"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I understand the rules and will attempt the test independently.</label>
          <button className="solid-action" disabled={!agreed} onClick={begin}>Begin in secure mode <span>→</span></button>
          <a className="quiet-link" href="/">Return to assessment details</a>
        </div>
      </main>
    );
  }

  if (isSubmitted) {
    return (
      <main className="submission-page">
        <div className="submission-card"><span className="success-mark">✓</span><p className="page-label">Attempt submitted</p><h1>Your responses are safe.</h1><p>You answered {answered} of {questions.length} questions. Detailed analysis is available in this demo result.</p><a className="solid-action" href="/results/demo">View my analysis <span>→</span></a></div>
      </main>
    );
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <main className="test-shell">
      <header className="test-header">
        <a className="product-brand" href="/"><strong>C&amp;Assess</strong></a>
        <div><strong>Placement Readiness Mock 01</strong><span>{candidate.name} · Section 1 of 1</span></div>
        <div className="test-status"><span className={saveState}>{saveState === 'saving' ? 'Saving…' : 'Saved'}</span><strong aria-label={`${time} remaining`}>{time}</strong><button onClick={() => setSubmitted(true)}>Submit test</button></div>
      </header>
      <div className="test-notice" role="status"><span>{notice}</span><strong>Tab switches: {tabSwitches}/3</strong></div>
      <div className="test-layout">
        <section className="question-stage">
          <div className="question-topline"><span>Question {current + 1} of {questions.length}</span><span>{question.tag} · {question.type === 'tita' ? 'TITA' : question.type === 'multi' ? 'Multiple select' : 'MCQ'}</span></div>
          <h1>{question.prompt}</h1>{question.detail && <p className="question-detail">{question.detail}</p>}
          <div className="answer-area">
            {question.options?.map((option, index) => {
              const selected = (answers[question.id] ?? []).includes(option);
              return <button className={`answer-option ${selected ? 'selected' : ''}`} onClick={() => updateAnswer(option)} key={option}><span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong><i>{selected ? 'Selected' : ''}</i></button>;
            })}
            {question.type === 'tita' && <label className="tita-field"><span>Your numeric answer</span><input inputMode="decimal" value={answers[question.id]?.[0] ?? ''} onChange={(event) => updateAnswer(event.target.value)} placeholder="Enter value" /></label>}
          </div>
          <div className="question-actions">
            <button className={`review-button ${marked.includes(question.id) ? 'active' : ''}`} onClick={() => setMarked((items) => items.includes(question.id) ? items.filter((id) => id !== question.id) : [...items, question.id])}>{marked.includes(question.id) ? 'Marked for review' : 'Mark for review'}</button>
            <div><button disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}>Previous</button><button className="next-button" onClick={() => current === questions.length - 1 ? setSubmitted(true) : setCurrent((value) => value + 1)}>{current === questions.length - 1 ? 'Finish & submit' : 'Save & next'}</button></div>
          </div>
        </section>
        <aside className="question-palette">
          <div><p>Question palette</p><span>{answered}/{questions.length} answered</span></div>
          <div className="palette-grid">{questions.map((item, index) => <button aria-label={`Go to question ${index + 1}`} className={`${current === index ? 'current' : ''} ${answers[item.id]?.length ? 'answered' : ''} ${marked.includes(item.id) ? 'marked' : ''}`} onClick={() => setCurrent(index)} key={item.id}>{index + 1}</button>)}</div>
          <dl><div><dt className="answered-dot" /> <dd>Answered</dd></div><div><dt className="marked-dot" /> <dd>Review</dd></div><div><dt /> <dd>Not answered</dd></div></dl>
          <button className="fullscreen-button" onClick={() => void document.documentElement.requestFullscreen()}>Return to full-screen</button>
        </aside>
      </div>
    </main>
  );
}
