'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { usePendingNavigationGuard } from '../../_components/usePendingNavigationGuard';

type Assessment = { id:string; title:string; status:string; settings:{ solutionsReleased?:boolean; solutionVisibility?:string } };
type ResultJob = { id:string; status:string; phase:string; progress:number };
type Data = {
  assessment:Assessment;
  summary:{ eligible:number; excluded:number; highest:number; average:number; averagePercentage:number };
  lastRun:{ created_at:number }|null;
  metrics:Array<{ id:string; position:number; prompt:string; topic:string; difficulty:string; attempts_count:number; correct_count:number; incorrect_count:number; skipped_count:number; average_awarded:number; average_time_seconds:number }>;
  candidates:Array<{ id:string; name:string; email:string; college:string; score:number; max_score:number; rank:number|null; percentile:number|null; correct_count:number; incorrect_count:number; unattempted_count:number; tab_switches:number; excluded_at:number|null; excluded_reason:string|null; evaluation_version:number }>;
  error?:string;
};

const fmt = (value:number) => `${Math.floor(value/60)}m ${Math.round(value%60)}s`;
const resultStages = [
  ['ended','Test ended'],
  ['results_processing','Review analytics'],
  ['results_released','Reports published'],
] as const;
const resultStatusSet = new Set<string>(resultStages.map(([status]) => status));
const reviewStatusSet = new Set<string>(['results_processing','results_ready','results_released']);

export function ResultsManager() {
  const [assessments,setAssessments] = useState<Assessment[]>([]);
  const [selected,setSelected] = useState('');
  const [data,setData] = useState<Data|null>(null);
  const [view,setView] = useState<'candidates'|'questions'>('candidates');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState('');
  usePendingNavigationGuard(Boolean(busy),'A results operation is still running. Leaving now may interrupt the organizer workflow. Leave anyway?');

  const load = async (id=selected) => {
    if(!id)return;
    const response = await fetch(`/api/results/manage?assessmentId=${encodeURIComponent(id)}`,{cache:'no-store'});
    setData(await response.json() as Data);
  };
  const refreshAssessments = async () => {
    const response = await fetch('/api/assessments',{cache:'no-store'});
    const result = await response.json() as {assessments?:Assessment[]};
    const rows = result.assessments||[];
    setAssessments(rows);
    setSelected((current)=>current||rows[0]?.id||'');
  };

  useEffect(()=>{void refreshAssessments();},[]);
  useEffect(()=>{void load(selected);},[selected]);

  async function finishJob(initial:ResultJob){
    let job=initial;
    for(let step=0;step<20&&job.status!=='complete';step+=1){
      setMessage(`Building cohort analytics… ${Math.max(1,Math.round(job.progress||0))}%`);
      const response=await fetch('/api/results/manage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assessmentId:selected,action:'process_batch',jobId:job.id})});
      const payload=await response.json() as {job?:ResultJob;error?:string};
      if(!response.ok||!payload.job)throw new Error(payload.error||'Result processing stopped before completion.');
      job=payload.job;
    }
    if(job.status!=='complete')throw new Error('Result processing needs another pass. Retry recompute to continue safely.');
    setMessage('Results updated. Ranks and analytics are current.');
  }

  async function action(kind:string,attemptId?:string) {
    if(!selected)return;
    let reason='';
    if(kind==='exclude'){
      reason=window.prompt('Reason for excluding this attempt from ranking:','Integrity review')||'';
      if(!reason)return;
    }
    if((kind==='exclude'||kind==='reevaluate')&&!window.confirm(kind==='exclude'?'Exclude this attempt and recalculate every rank?':'Re-score this submission using the current published answer key?'))return;
    setBusy(attemptId||kind);
    setMessage('Updating results…');
    const response=await fetch('/api/results/manage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assessmentId:selected,attemptId,action:kind,reason})});
    const result=await response.json() as {error?:string;job?:ResultJob};
    try{if(response.ok&&result.job)await finishJob(result.job);else setMessage(response.ok?'Results updated.':result.error||'Update failed.');}catch(reason){setMessage(reason instanceof Error?reason.message:'Result processing failed.');}
    setBusy('');
    if(response.ok)await load();
  }

  async function lifecycleAction(kind:'begin_result_processing'|'mark_results_ready'|'publish_results') {
    if(!selected)return;
    const prompts={
      begin_result_processing:'Compute scores, ranks, percentiles and question analytics for every eligible submission?',
      mark_results_ready:'Mark the review as complete? You can still re-evaluate or exclude attempts before publishing.',
      publish_results:'Publish scorecards and personal analysis to every eligible candidate now? This cannot be silently undone.',
    };
    if(!window.confirm(prompts[kind]))return;
    setBusy(kind);
    setMessage(kind==='begin_result_processing'?'Computing cohort results…':'Updating release stage…');
    const response=await fetch('/api/assessments/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assessmentId:selected,action:kind})});
    const result=await response.json() as {error?:string;job?:ResultJob};
    const successMessage={begin_result_processing:'Analytics computed. Review candidates and question performance before approving the release.',mark_results_ready:'Review approved. Candidate reports are ready to publish.',publish_results:'Results published. Eligible candidates can now open their personal reports.'};
    try{if(response.ok&&result.job)await finishJob(result.job);else setMessage(response.ok?successMessage[kind]:result.error||'Could not update the result stage.');}catch(reason){setMessage(reason instanceof Error?reason.message:'Result processing failed.');}
    setBusy('');
    if(response.ok){await refreshAssessments();await load();}
  }

  async function releaseSolutions() {
    if(!window.confirm('Release answer keys and written solutions to every candidate?'))return;
    setBusy('solutions');
    const response=await fetch('/api/assessments/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assessmentId:selected,action:'release_solutions'})});
    const result=await response.json() as {error?:string};
    setMessage(response.ok?'Solutions released to candidates.':result.error||'Could not release solutions.');
    setBusy('');
    if(response.ok)await load();
  }

  const sortedMetrics=useMemo(()=>[...(data?.metrics||[])].sort((a,b)=>{const ar=a.attempts_count?a.correct_count/a.attempts_count:1,br=b.attempts_count?b.correct_count/b.attempts_count:1;return ar-br;}),[data]);
  const status=data?.assessment.status||'';
  const stageIndex=status==='results_ready'?1:resultStages.findIndex(([value])=>value===status);
  const canReview=reviewStatusSet.has(status);
  const releaseCopy=status==='ended'
    ? 'Submissions are sealed. Compute ranks, percentiles and question analytics to begin the review.'
    : status==='results_processing'
      ? 'Review candidate outcomes, integrity signals and question analytics. Re-evaluate or exclude attempts where required.'
      : status==='results_ready'
        ? 'The review is approved. One final confirmation will make personal reports visible to candidates.'
        : status==='results_released'
          ? 'Candidate scorecards and personal analysis are live. Solutions follow the release policy chosen for this test.'
          : 'The test must be ended before result computation can begin.';

  const candidateTable=data?<div className="participant-table-wrap">
    <table className="participant-table results-admin-table">
      <thead><tr><th>Candidate</th><th>Rank</th><th>Score</th><th>Outcome</th><th>Integrity</th><th>Evaluation</th><th>Controls</th></tr></thead>
      <tbody>{data.candidates.map((row)=><tr className={row.excluded_at?'excluded-row':''} key={row.id}>
        <td><strong>{row.name||'Candidate'}</strong><span>{row.email} · {row.college||'College not provided'}</span></td>
        <td>{row.excluded_at?'Excluded':row.rank?`#${row.rank}`:'—'}<span>{row.percentile===null?'':`${Number(row.percentile).toFixed(2)} %ile`}</span></td>
        <td><strong>{row.score} / {row.max_score}</strong></td>
        <td>{row.correct_count} correct<span>{row.incorrect_count} wrong · {row.unattempted_count} skipped</span></td>
        <td>{row.tab_switches} tab switches</td><td>Version {row.evaluation_version}</td>
        <td><div className="table-control-group"><button disabled={busy!==''||!canReview} onClick={()=>void action('reevaluate',row.id)}>Re-evaluate</button><button className={row.excluded_at?'restore':''} disabled={busy!==''||!canReview} onClick={()=>void action(row.excluded_at?'include':'exclude',row.id)}>{row.excluded_at?'Restore':'Exclude'}</button></div>{row.excluded_reason&&<span>{row.excluded_reason}</span>}</td>
      </tr>)}</tbody>
    </table>
    {!data.candidates.length&&<div className="catalog-empty">No submitted attempts yet.</div>}
  </div>:null;

  const questionTable=data?<div className="participant-table-wrap">
    <table className="participant-table results-admin-table">
      <thead><tr><th>Question</th><th>Topic</th><th>Difficulty</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Average time</th><th>Average marks</th></tr></thead>
      <tbody>{sortedMetrics.map((row)=>{const attempted=Math.max(0,row.attempts_count-row.skipped_count);return <tr key={row.id}>
        <td><strong>Q{row.position}</strong><span>{row.prompt}</span></td><td>{row.topic||'General'}</td><td><span className="status-chip">{row.difficulty}</span></td><td>{attempted} / {row.attempts_count}</td><td>{row.correct_count}<span>{attempted?`${Math.round(100*row.correct_count/attempted)}% accuracy`:''}</span></td><td>{row.incorrect_count}</td><td>{row.skipped_count}</td><td>{fmt(row.average_time_seconds)}</td><td>{row.average_awarded}</td>
      </tr>;})}</tbody>
    </table>
    {!sortedMetrics.length&&<div className="catalog-empty">Run result computation after submissions to build question analytics.</div>}
  </div>:null;

  return <section className="results-manager">
    <section className="results-release-flow" aria-label="Result publishing workflow">
      <div className="results-release-copy"><p className="page-label">Result release</p><h2>{status==='results_released'?'Candidate reports are live':'Review before you publish'}</h2><p>{releaseCopy}</p></div>
      <ol>{resultStages.map(([value,label],index)=><li className={stageIndex>index?'complete':stageIndex===index?'current':''} key={value}><span>0{index+1}</span><strong>{label}</strong></li>)}</ol>
      <div className="results-release-action">
        {status==='ended'&&<button className="release-button" onClick={()=>void lifecycleAction('begin_result_processing')} disabled={busy!==''}>Compute ranks &amp; analytics</button>}
        {status==='results_processing'&&<button className="release-button" onClick={()=>void lifecycleAction('publish_results')} disabled={busy!==''}>Publish candidate reports</button>}
        {status==='results_ready'&&<button className="release-button" onClick={()=>void lifecycleAction('publish_results')} disabled={busy!==''}>Publish candidate reports</button>}
        {status==='results_released'&&<strong className="reports-live">Reports live ✓</strong>}
        {!resultStatusSet.has(status)&&<a className="outline-action" href="/organizer">End the test from Overview →</a>}
      </div>
    </section>
    <div className="results-toolbar"><label>Assessment<select value={selected} onChange={(e)=>setSelected(e.target.value)}>{assessments.map((item)=><option value={item.id} key={item.id}>{item.title}</option>)}</select></label><div>{canReview&&<button onClick={()=>void action('recompute')} disabled={!data||busy!==''}>Recompute all analytics</button>}{status==='results_released'&&data?.assessment.settings.solutionVisibility==='separate_release'&&!data.assessment.settings.solutionsReleased&&<button className="release-button" onClick={()=>void releaseSolutions()} disabled={busy!==''}>Release solutions</button>}</div></div>
    {message&&<p className="results-admin-message" role="status">{message}</p>}
    {data?.error?<div className="catalog-empty">{data.error}</div>:data&&<>
      <section className="results-admin-summary"><article><span>Eligible submissions</span><strong>{data.summary.eligible}</strong></article><article><span>Excluded</span><strong>{data.summary.excluded}</strong></article><article><span>Highest score</span><strong>{data.summary.highest}</strong></article><article><span>Average score</span><strong>{data.summary.average}</strong><small>{data.summary.averagePercentage}% of total marks</small></article></section>
      <div className="results-admin-tabs"><button className={view==='candidates'?'active':''} onClick={()=>setView('candidates')}>Candidate results</button><button className={view==='questions'?'active':''} onClick={()=>setView('questions')}>Question analytics</button><span>{data.lastRun?`Last computed ${new Date(data.lastRun.created_at*1000).toLocaleString('en-IN')}`:'Not computed yet'}</span></div>
      {view==='candidates'?candidateTable:questionTable}
    </>}
  </section>;
}
