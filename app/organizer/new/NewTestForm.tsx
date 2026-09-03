'use client';

import { FormEvent, useState } from 'react';
import { usePendingNavigationGuard } from '../../_components/usePendingNavigationGuard';

export function NewTestForm() {
  const [state,setState] = useState<'idle'|'saving'|'failed'>('idle'); const [error,setError] = useState(''); const [dirty,setDirty]=useState(false);
  const allowNavigation=usePendingNavigationGuard(dirty||state==='saving','This new assessment has not been safely created yet. Leave this organizer section anyway?');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState('saving'); setError(''); const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    const iso = (key:string) => new Date(String(payload[key])).toISOString();
    try {
      const response = await fetch('/api/assessments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,registrationStartsAt:iso('registrationStartsAt'),registrationEndsAt:iso('registrationEndsAt'),startsAt:iso('startsAt'),endsAt:iso('endsAt'),durationMinutes:Number(payload.durationMinutes),registrationCapacity:payload.registrationCapacity?Number(payload.registrationCapacity):null,shuffleQuestions:true,shuffleOptions:true,allowEditing:true,maxTabSwitches:3,solutionVisibility:'separate_release'})});
      const result = await response.json() as {id?:string;error?:string}; if (!response.ok || !result.id) throw new Error(result.error || 'Could not save the test.');
      allowNavigation();window.location.href = `/organizer/questions?assessment=${encodeURIComponent(result.id)}`;
    } catch (reason) { setError(reason instanceof Error ? reason.message:'Could not save the test.'); setState('failed'); }
  }
  return <form className="new-test-form" onSubmit={submit} onChange={()=>setDirty(true)}>
    <section className="form-intro"><p className="page-label">Step 1 of 2</p><h2>Set the test basics</h2><p>After saving, you will go straight to question upload. Everything can be changed later.</p></section>
    <section className="form-grid"><label className="span-two">Test name<input name="title" required placeholder="e.g. Product Analyst OA Mock 01"/></label><label className="span-two">Candidate instructions<textarea name="description" placeholder="What this mock covers and any instructions candidates should know."/></label><label>Duration in minutes<input name="durationMinutes" type="number" min="5" max="300" defaultValue="60" required/></label><div className="form-helper"><strong>Maximum marks</strong><span>Calculated automatically from the validated question paper.</span></div><label>Registrations open<input name="registrationStartsAt" type="datetime-local" required/></label><label>Registrations close<input name="registrationEndsAt" type="datetime-local" required/></label><label>Test starts<input name="startsAt" type="datetime-local" required/></label><label>Absolute test close<input name="endsAt" type="datetime-local" required/></label><label>Who can register?<select name="audience" defaultValue="open"><option value="open">Any Google account</option><option value="domains">Only listed email domains</option></select></label><label>Allowed domains<input name="allowedDomains" placeholder="iitg.ac.in, gmail.com"/></label><label>Registration capacity (optional)<input name="registrationCapacity" type="number" min="1" placeholder="e.g. 4000"/></label><label>Candidate start policy<select name="startPolicy" defaultValue="common_deadline"><option value="common_deadline">Full duration, capped by the absolute close (recommended)</option><option value="full_duration">Full duration for every admitted candidate</option></select></label><div className="form-helper span-two"><strong>Timezone</strong><span>Times follow the organizer’s device and are stored as absolute timestamps.</span></div></section>
    <section className="new-test-rules"><h3>Recommended OA defaults</h3><p>Questions and options shuffled · Answers editable · 3 tab-switch signals · Manual result release · Solutions released separately</p><input type="hidden" name="shuffleQuestions" value="true"/><input type="hidden" name="shuffleOptions" value="true"/><input type="hidden" name="allowEditing" value="true"/><input type="hidden" name="maxTabSwitches" value="3"/><input type="hidden" name="solutionVisibility" value="separate_release"/></section>
    {error && <p className="form-error">{error}</p>}<button className="solid-action" disabled={state === 'saving'}>{state === 'saving' ? 'Creating test…':'Create test & upload questions →'}</button>
  </form>;
}
