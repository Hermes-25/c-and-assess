'use client';

import { FormEvent, useEffect, useState } from 'react';
import { usePendingNavigationGuard } from '../../_components/usePendingNavigationGuard';

type Assessment = {
  id:string; title:string; slug:string; description:string; status:string; duration_seconds:number; registration_starts_at:number|null;
  registration_ends_at:number|null; starts_at:number|null; ends_at:number|null; version:number; question_count:number; total_marks:number;
  settings:{shuffleQuestions:boolean;shuffleOptions:boolean;allowEditing:boolean;maxTabSwitches:number;startPolicy:string;solutionVisibility:string;audience:'open'|'domains';allowedDomains:string[];registrationCapacity:number|null};
};

function localInput(epoch:number|null) {
  if(!epoch)return '';
  const date=new Date(epoch*1000); const pad=(value:number)=>String(value).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AssessmentEditor() {
  const [assessment,setAssessment]=useState<Assessment|null>(null); const [loading,setLoading]=useState(true); const [message,setMessage]=useState(''); const [saving,setSaving]=useState(false); const [dirty,setDirty]=useState(false); const [loadError,setLoadError]=useState('');
  usePendingNavigationGuard(dirty||saving,'Assessment settings are still unsaved. Leave this organizer section anyway?');
  useEffect(()=>{void(async()=>{try{let id=new URLSearchParams(window.location.search).get('assessment');if(!id){const list=await fetch('/api/assessments',{cache:'no-store'});const data=await list.json() as {assessments?:Assessment[]};id=data.assessments?.[0]?.id||null;}if(!id){setLoadError('Create an assessment before editing settings.');return;}const response=await fetch(`/api/assessments?id=${encodeURIComponent(id)}`,{cache:'no-store'});const payload=await response.json() as {assessment?:Assessment;error?:string};if(!response.ok||!payload.assessment)throw new Error(payload.error||'Could not load assessment.');setAssessment(payload.assessment);}catch(reason){setLoadError(reason instanceof Error?reason.message:'Could not load assessment.');}finally{setLoading(false);}})();},[]);

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!assessment)return; setSaving(true);setMessage('');const form=new FormData(event.currentTarget);
    const iso=(key:string)=>new Date(String(form.get(key))).toISOString();
    try{const response=await fetch('/api/assessments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      id:assessment.id,expectedVersion:assessment.version,title:form.get('title'),slug:form.get('slug'),description:form.get('description'),
      durationMinutes:Number(form.get('durationMinutes')),registrationStartsAt:iso('registrationStartsAt'),registrationEndsAt:iso('registrationEndsAt'),startsAt:iso('startsAt'),endsAt:iso('endsAt'),
      shuffleQuestions:form.get('shuffleQuestions')==='on',shuffleOptions:form.get('shuffleOptions')==='on',allowEditing:form.get('allowEditing')==='on',maxTabSwitches:Number(form.get('maxTabSwitches')),
      startPolicy:form.get('startPolicy'),solutionVisibility:form.get('solutionVisibility'),audience:form.get('audience'),allowedDomains:form.get('allowedDomains'),registrationCapacity:form.get('registrationCapacity')?Number(form.get('registrationCapacity')):null,
    })});const payload=await response.json() as {error?:string;version?:number};if(!response.ok)throw new Error(payload.error||'Could not save changes.');setAssessment({...assessment,version:Number(payload.version||assessment.version+1)});setDirty(false);setMessage('Saved as a new assessment version.');}
    catch(reason){setMessage(reason instanceof Error?reason.message:'Could not save changes.');}finally{setSaving(false);}
  }

  if(loading)return <div className="organizer-loading"><strong>Loading assessment settings…</strong></div>;
  if(loadError||!assessment)return <div className="organizer-empty"><h2>No assessment selected</h2><p>{loadError}</p><a className="solid-action small" href="/organizer/new">Create a test</a></div>;
  const paperLocked=['live','ended','results_processing','results_ready','results_released','archived'].includes(assessment.status);
  const windowLocked=['results_processing','results_ready','results_released','archived'].includes(assessment.status);
  return <form className="assessment-form" key={assessment.version} onSubmit={save} onChange={()=>setDirty(true)}>
    <div className="form-savebar"><div><strong>{assessment.title}</strong><span>{assessment.status.replaceAll('_',' ')} · version {assessment.version} · {assessment.question_count} questions · {assessment.total_marks} marks</span></div><span className={message.toLowerCase().includes('could')?'form-inline-error':''}>{message||'All times are entered in your device timezone and stored as absolute time.'}</span><button className="solid-action small" disabled={saving||windowLocked}>{windowLocked?'Locked':saving?'Saving…':paperLocked?'Save window changes':'Save new version'}</button></div>
    {paperLocked&&<div className="locked-notice"><strong>The paper rules are protected.</strong><span>{windowLocked?'Results processing has started, so all settings are locked.':'Candidates have started, so questions, duration and scoring rules stay fixed. You can still extend registration or the test access window.'}</span></div>}
    <section id="basic"><div className="form-section-heading"><div><p className="page-label">01 · Candidate-facing setup</p><h2>Basic information</h2></div><a href={`/organizer/questions?assessment=${encodeURIComponent(assessment.id)}`}>Review question paper →</a></div><div className="form-grid">
      <label className="span-two">Assessment name<input name="title" defaultValue={assessment.title} required disabled={paperLocked}/></label>
      <label>URL slug<input name="slug" defaultValue={assessment.slug} pattern="[a-z0-9-]+" disabled={paperLocked}/></label>
      <label>Duration (minutes)<input name="durationMinutes" type="number" defaultValue={Math.round(assessment.duration_seconds/60)} min="5" max="300" required disabled={paperLocked}/></label>
      <label className="span-two">Candidate instructions<textarea name="description" defaultValue={assessment.description} disabled={paperLocked}/></label>
    </div></section>
    <section id="window"><p className="page-label">02 · Access window</p><h2>Registration and test timing</h2><div className="form-grid">
      <label>Registrations open<input name="registrationStartsAt" type="datetime-local" defaultValue={localInput(assessment.registration_starts_at)} required disabled={windowLocked}/></label>
      <label>Registrations close<input name="registrationEndsAt" type="datetime-local" defaultValue={localInput(assessment.registration_ends_at)} required disabled={windowLocked}/></label>
      <label>Test starts<input name="startsAt" type="datetime-local" defaultValue={localInput(assessment.starts_at)} required readOnly={paperLocked} disabled={windowLocked}/></label>
      <label>Absolute test close<input name="endsAt" type="datetime-local" defaultValue={localInput(assessment.ends_at)} required disabled={windowLocked}/></label>
      <p className="form-helper span-two"><strong>Automatic windows</strong><span>Registration and test access open and close from these timestamps. Registration may overlap the test window; no manual start/close routine is required.</span></p>
      <label>Registration audience<select name="audience" defaultValue={assessment.settings.audience} disabled={paperLocked}><option value="open">Any Google account</option><option value="domains">Only listed email domains</option></select></label>
      <label>Allowed domains<input name="allowedDomains" defaultValue={assessment.settings.allowedDomains.join(', ')} placeholder="iitg.ac.in, gmail.com" disabled={paperLocked}/></label>
      <label>Registration capacity<input name="registrationCapacity" type="number" min="1" defaultValue={assessment.settings.registrationCapacity||''} placeholder="No limit" disabled={paperLocked}/></label>
      <label className="span-two">Candidate start policy<select name="startPolicy" defaultValue={assessment.settings.startPolicy} disabled={paperLocked}><option value="common_deadline">Timer ends at the earlier of full duration or absolute close (recommended)</option><option value="full_duration">Every admitted candidate receives the full duration</option></select></label>
    </div></section>
    <section id="rules"><p className="page-label">03 · Integrity and response rules</p><h2>Attempt controls</h2><div className="settings-list">
      <label><span><strong>Shuffle questions</strong><small>Each candidate receives a stable randomized order.</small></span><input name="shuffleQuestions" type="checkbox" defaultChecked={assessment.settings.shuffleQuestions} disabled={paperLocked}/></label>
      <label><span><strong>Shuffle options</strong><small>Answers remain mapped after candidate-specific shuffling.</small></span><input name="shuffleOptions" type="checkbox" defaultChecked={assessment.settings.shuffleOptions} disabled={paperLocked}/></label>
      <label><span><strong>Allow returning to earlier questions</strong><small>Turn this off for a strictly forward-only paper. Section locking will be added only with real section timers.</small></span><input name="allowEditing" type="checkbox" defaultChecked={assessment.settings.allowEditing} disabled={paperLocked}/></label>
      <label><span><strong>Maximum tab switches</strong><small>Crossing this limit visibly flags the attempt for organizer review; it does not auto-submit on an accidental switch.</small></span><input name="maxTabSwitches" type="number" defaultValue={assessment.settings.maxTabSwitches} min="0" max="20" disabled={paperLocked}/></label>
      <label><span><strong>Solution release</strong><small>Scores and solutions can be separated after evaluation.</small></span><select name="solutionVisibility" defaultValue={assessment.settings.solutionVisibility} disabled={paperLocked}><option value="separate_release">Release solutions separately (recommended)</option><option value="with_results">Release with results</option></select></label>
    </div></section>
  </form>;
}
