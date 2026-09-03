'use client';

import JSZip from 'jszip';
import Papa from 'papaparse';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeQuestionRows, type QuestionIssue, type RawQuestionRow } from '../../../lib/question-import';
import { usePendingNavigationGuard } from '../../_components/usePendingNavigationGuard';
import { PublishedPaperReview,type PublishedQuestion } from './PublishedPaperReview';

type CsvRow = Record<string, string>;
type ExistingQuestion = PublishedQuestion;
const required = ['Question', 'Type', 'Answer', 'Marks', 'Negative Marks'];
const templateHeader = ['Question','Type','Answer','Choice1','Choice2','Choice3','Choice4','Choice5','Choice6','Marks','Negative Marks','Solution','Section','Topic','Subtopic','Difficulty','Passage','Answer Keywords','Answer Keywords marks','Accepted Variants','TITA Tolerance','Image','Duration In Seconds','Source','Tag'];

function validate(rows: CsvRow[], fields: string[], imageNames: Set<string>) {
  const missing = required.filter((field) => !fields.some((value) => value.toLowerCase() === field.toLowerCase()))
    .map((field) => ({ row: 1, level: 'error' as const, field, message: `Missing required column: ${field}` }));
  const result = normalizeQuestionRows(rows as RawQuestionRow[]);
  const imageIssues: QuestionIssue[] = [];
  rows.forEach((row, index) => {
    const image = String(row.Image || '').trim();
    if (image && imageNames.size > 0 && !imageNames.has(image)) imageIssues.push({ row:index + 2, level:'error', field:'Image', message:`Image “${image}” is not present in the ZIP.` });
    if (image && imageNames.size === 0) imageIssues.push({ row:index + 2, level:'warning', field:'Image', message:`Image “${image}” still needs a matching ZIP upload.` });
  });
  return { normalized: result.normalized, issues: [...missing, ...result.issues, ...imageIssues] };
}
export default function QuestionImporter() {
  const [assessmentId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('assessment') || '');
  const csvInput = useRef<HTMLInputElement>(null); const zipInput = useRef<HTMLInputElement>(null); const mappingDialog=useRef<HTMLDialogElement>(null);
  const [assessmentName,setAssessmentName] = useState('Selected assessment'); const [assessmentStatus,setAssessmentStatus] = useState('loading'); const [existing,setExisting] = useState<ExistingQuestion[]>([]);
  const [fileName,setFileName] = useState(''); const [zipName,setZipName] = useState(''); const [rows,setRows] = useState<CsvRow[]>([]); const [fields,setFields] = useState<string[]>([]);
  const [imageNames,setImageNames] = useState<Set<string>>(new Set()); const [imageFiles,setImageFiles] = useState<File[]>([]); const [fileIssues,setFileIssues] = useState<QuestionIssue[]>([]);
  const [zipState,setZipState] = useState<'idle'|'reading'|'ready'|'failed'>('idle');
  const [state,setState] = useState<'idle'|'importing'|'done'|'failed'>('idle'); const [progress,setProgress] = useState(''); const [progressPercent,setProgressPercent] = useState(0); const [failure,setFailure] = useState('');
  usePendingNavigationGuard(state==='importing'||zipState==='reading'||(rows.length>0&&state!=='done'),'This paper has files or validation work that are not safely published yet. Leave this organizer section anyway?');

  useEffect(() => {
    if (!assessmentId) return;
    fetch(`/api/questions/import?assessmentId=${encodeURIComponent(assessmentId)}`).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { assessment?:{title:string;status:string}; questions?:ExistingQuestion[] };
      setAssessmentName(payload.assessment?.title || 'Selected assessment'); setAssessmentStatus(payload.assessment?.status||'draft'); setExisting(payload.questions || []);
    }).catch(() => undefined);
  },[assessmentId]);

  const validation = useMemo(() => fileName ? validate(rows,fields,imageNames) : { normalized:[], issues:[] as QuestionIssue[] },[fileName,rows,fields,imageNames]);
  const issues = [...fileIssues,...validation.issues]; const errors = issues.filter((issue) => issue.level === 'error'); const warnings = issues.filter((issue) => issue.level === 'warning');
  const paperLocked = assessmentStatus==='loading'||['live','ended','results_processing','results_ready','results_released','archived'].includes(assessmentStatus);

  function loadCsv(file?:File) {
    setFileIssues([]); setState('idle'); setProgress(''); setProgressPercent(0); setFailure(''); if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return setFileIssues([{row:1,level:'error',message:'Choose a .csv file.'}]);
    if (file.size > 10 * 1024 * 1024) return setFileIssues([{row:1,level:'error',message:'CSV exceeds the 10 MB limit.'}]);
    Papa.parse<CsvRow>(file,{header:true,skipEmptyLines:'greedy',transformHeader:(header)=>header.trim(),complete:(result)=>{
      setFileName(file.name); setRows(result.data); setFields(result.meta.fields || []);
      setFileIssues(result.errors.map((error)=>({row:(error.row || 0)+2,level:'error' as const,message:error.message})));
    }});
  }

  async function loadZip(file?:File) {
    if (!file) return;
    setState('idle'); setProgress(''); setProgressPercent(0); setFailure(''); setZipState('reading');
    if (!file.name.toLowerCase().endsWith('.zip')) { setZipState('failed'); return setFileIssues((items)=>[...items,{row:1,level:'error',message:'Choose a .zip image bundle.'}]); }
    if (file.size > 10 * 1024 * 1024) { setZipState('failed'); return setFileIssues((items)=>[...items,{row:1,level:'error',message:'ZIP exceeds the 10 MB limit.'}]); }
    try {
      const zip = await JSZip.loadAsync(file); const entries = Object.values(zip.files).filter((entry)=>!entry.dir);
      const unsafe = entries.filter((entry)=>entry.name.includes('..') || entry.name.startsWith('/') || entry.name.startsWith('\\'));
      const names = entries.map((entry)=>entry.name.split('/').pop() || entry.name);
      const invalid = names.filter((name)=>!/\.(png|jpe?g)$/i.test(name));
      const duplicateNames = names.filter((name,index)=>names.findIndex((candidate)=>candidate.toLowerCase()===name.toLowerCase())!==index);
      if (unsafe.length || invalid.length) { setZipState('failed'); return setFileIssues((items)=>[...items,{row:1,level:'error',message:'ZIP may contain only safe .png, .jpg or .jpeg image files.'}]); }
      if (duplicateNames.length) { setZipState('failed'); return setFileIssues((items)=>[...items,{row:1,level:'error',message:`Every image filename must be unique. Rename duplicate: ${duplicateNames[0]}`}]); }
      const extracted = await Promise.all(entries.map(async (entry)=>{ const name=entry.name.split('/').pop() || entry.name; const blob=await entry.async('blob'); return new File([blob],name,{type:/\.png$/i.test(name)?'image/png':'image/jpeg'}); }));
      if (extracted.some((file)=>file.size > 2*1024*1024)) { setZipState('failed'); return setFileIssues((items)=>[...items,{row:1,level:'error',message:'Each extracted image must be 2 MB or smaller.'}]); }
      setZipName(file.name); setImageNames(new Set(names)); setImageFiles(extracted); setZipState('ready');
    } catch { setZipState('failed'); setFileIssues((items)=>[...items,{row:1,level:'error',message:'The ZIP could not be read.'}]); }
  }

  function downloadTemplate(advanced=false) {
    const simpleHeader=['Question','Type','Answer','Choice1','Choice2','Choice3','Choice4','Choice5','Choice6','Marks','Negative Marks','Solution','Section','Topic','Difficulty','Image'];
    const header=advanced?templateHeader:simpleHeader;
    const example=advanced?['What is 20% of 150?','Objective','30','20','25','30','35','','','3','1','20% of 150 = 30.','Quantitative Aptitude','Percentages','Basics','easy','','','','','','q01.png','','Original C&A question','Quantitative Aptitude']:['What is 20% of 150?','Objective','30','20','25','30','35','','','3','1','20% of 150 = 30.','Quantitative Aptitude','Percentages','easy','q01.png'];
    const quote = (cell:string) => /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"','""')}"` : cell;
    const blob = new Blob([[header,example].map((row)=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=advanced?'CA-Assess-advanced-question-template.csv':'CA-Assess-simple-question-template.csv'; link.click(); URL.revokeObjectURL(url);
  }

  async function requestJson(url:string,options:RequestInit) {
    const response=await fetch(url,options); const payload=await response.json() as Record<string,unknown>;
    if (!response.ok) throw new Error(String(payload.error || 'The import could not be completed.'));
    return payload;
  }

  async function importQuestions() {
    if (!assessmentId || !rows.length || errors.length) return;
    setState('importing'); setProgressPercent(4); setFailure(''); let importId='';
    try {
      setProgress('Creating a protected import session…');
      const started=await requestJson('/api/questions/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'start',assessmentId,sourceFilename:fileName,expectedRows:rows.length,imageNames:[...new Set(rows.map((row)=>String(row.Image || '').trim()).filter(Boolean))]})});
      importId=String(started.importId); const chunkSize=Number(started.chunkSize || 40);
      for(let offset=0;offset<rows.length;offset+=chunkSize){
        setProgressPercent(12+Math.round(56*Math.min(offset+chunkSize,rows.length)/rows.length));
        setProgress(`Validating and staging ${Math.min(offset+chunkSize,rows.length)} of ${rows.length} questions…`);
        await requestJson('/api/questions/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'chunk',assessmentId,importId,offset,rows:rows.slice(offset,offset+chunkSize)})});
      }
      if(imageFiles.length){
        setProgressPercent(76);
        setProgress(`Uploading ${imageFiles.length} protected question image${imageFiles.length===1?'':'s'}…`);
        const form=new FormData(); form.append('assessmentId',assessmentId); form.append('importId',importId); imageFiles.forEach((file)=>form.append('images',file,file.name));
        await requestJson('/api/questions/images',{method:'POST',body:form});
      }
      setProgressPercent(92); setProgress('Publishing the validated paper atomically…');
      await requestJson('/api/questions/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'commit',assessmentId,importId})});
      const refreshed=await fetch(`/api/questions/import?assessmentId=${encodeURIComponent(assessmentId)}`,{cache:'no-store'});const refreshedData=await refreshed.json() as {questions?:ExistingQuestion[]};
      setState('done'); setProgressPercent(100); setProgress(`${rows.length} questions and their images are validated and published.`); setExisting(refreshedData.questions||[]);
    } catch(reason) {
      setState('failed'); setProgressPercent(0); setFailure(reason instanceof Error?reason.message:'The import could not be completed.'); setProgress('');
      if(importId) void fetch('/api/questions/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'cancel',assessmentId,importId})});
    }
  }

  return <div className="importer-layout">
    <section className="upload-column">
      <div className="upload-heading"><div><p className="page-label">Paper workspace</p><h2>{assessmentName}</h2><p className="import-current">{existing.length ? `${existing.length} published question${existing.length===1?'':'s'} currently in this draft` : 'No questions published yet'}</p></div><div className="template-actions"><button className="template-button how-button" onClick={()=>mappingDialog.current?.showModal()}><span aria-hidden="true">?</span> How image mapping works</button><button className="template-button" onClick={()=>downloadTemplate(false)}>Download simple template</button><button className="template-button" onClick={()=>downloadTemplate(true)}>Advanced fields</button></div></div>
      {paperLocked&&assessmentStatus!=='loading'?<div className="paper-lock-banner" role="status"><div><strong>This published paper is locked</strong><span>Candidate activity has started. The questions and images already published are the exact paper candidates will continue to see.</span></div><a href="/organizer/new">Create a new assessment →</a></div>:<div className="import-safety"><strong>Safe replacement</strong><span>The current paper remains untouched until every CSV row and image passes validation.</span></div>}
      <dialog ref={mappingDialog} className="image-mapping-dialog" onClick={(event)=>{if(event.target===event.currentTarget)event.currentTarget.close();}}><section className="image-mapping-guide" aria-labelledby="image-mapping-title"><header><div><p className="page-label">Image filename mapping</p><h3 id="image-mapping-title">The CSV name and ZIP file must match exactly</h3></div><button type="button" aria-label="Close image mapping guide" onClick={()=>mappingDialog.current?.close()}>×</button></header><p>In the CSV <strong>Image</strong> column, enter the complete filename—including its extension. Put a file with that exact name inside the ZIP.</p><div className="image-mapping-example"><span>CSV Image cell</span><code>q001.png</code><i aria-hidden="true">→</i><span>Matching ZIP file</span><code>q001.png</code></div><ul><li>Matching is case-sensitive: <code>q001.png</code> and <code>Q001.png</code> are different.</li><li>Use one unique filename per image. Recommended: <code>q001.png</code>, <code>q002.png</code>, <code>q003.jpg</code>.</li><li>Leave the Image cell blank when a question has no image.</li><li>Use only PNG, JPG or JPEG. Keep each image under 2 MB and the complete ZIP under 10 MB.</li><li>Keep files directly inside the ZIP. Do not write paths such as <code>images/q001.png</code> in the CSV.</li></ul></section></dialog>
      <PublishedPaperReview key={`${assessmentId}:${existing.length}:${existing[0]?.id||'empty'}`} initial={existing} status={assessmentStatus}/>
      <button type="button" className={`drop-zone ${fileName?'is-ready':''}`} disabled={paperLocked||state==='importing'} onClick={()=>csvInput.current?.click()} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();if(!paperLocked)loadCsv(event.dataTransfer.files[0]);}}>
        <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(event)=>loadCsv(event.target.files?.[0])}/><span className="file-badge">CSV</span><strong>{fileName || 'Drop the question CSV here'}</strong><small>{fileName?`${rows.length} rows found`:'or click to choose · maximum 10 MB'}</small>
      </button>
      <button type="button" className={`drop-zone compact ${zipState==='reading'?'is-loading':zipState==='ready'?'is-ready':''}`} disabled={paperLocked||zipState==='reading'||state==='importing'} onClick={()=>zipInput.current?.click()} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();if(!paperLocked)void loadZip(event.dataTransfer.files[0]);}}>
        <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={(event)=>void loadZip(event.target.files?.[0])}/><span className="file-badge zip">{zipState==='reading'?'···':'ZIP'}</span><strong>{zipState==='reading'?'Reading and checking the image ZIP…':zipName || 'Add matching images (optional)'}</strong><small>{zipState==='reading'?'Keep this page open while filenames and file safety are checked.':zipName?`${imageNames.size} safe image files found`:'.png, .jpg or .jpeg · 2 MB each · 10 MB total'}</small>
      </button>
      {rows.length>0&&<><div className={`validation-summary ${paperLocked?'is-locked':errors.length?'has-errors':state==='done'?'is-published':'is-valid'}`}><div><strong>{paperLocked?'Paper locked — these files are not published':errors.length?`${errors.length} blocking issue${errors.length===1?'':'s'}`:state==='done'?`✓ Paper published safely`:`✓ ${rows.length} questions validated locally`}</strong><span>{paperLocked?'The active assessment still uses the published paper shown above. Create a new assessment to use this CSV and ZIP.':state==='done'?`${rows.length} questions · ${imageNames.size} images verified and live`: `${warnings.length} warning${warnings.length===1?'':'s'} · ready for final publishing`}</span></div><button type="button" disabled={paperLocked||errors.length>0||zipState==='reading'||state==='importing'||state==='done'} onClick={importQuestions}>{paperLocked?'Locked after candidate activity':state==='importing'?'Validating & publishing…':state==='done'?'Published ✓':'Validate & publish paper'}</button></div>{progress&&<div className="import-progress" aria-live="polite"><span className={state==='done'?'done':''}/><strong>{progress}</strong></div>}<div className="question-preview"><div className="question-preview-row head"><span>#</span><span>Local file preview</span><span>Type</span><span>Marks</span></div>{validation.normalized.slice(0,8).map((row)=><div className="question-preview-row" key={row.position}><span>{row.position}</span><strong>{row.prompt.slice(0,100)}</strong><span>{row.type.toUpperCase()}</span><span>{row.marks}</span></div>)}</div></>}
      {issues.length>0&&<div className="issue-list" aria-live="polite">{issues.slice(0,15).map((issue,index)=><div className={issue.level} key={`${issue.row}-${issue.message}-${index}`}><span>{issue.level==='error'?'Fix':'Note'}</span><p>{issue.row?`Row ${issue.row}: `:''}{issue.message}</p></div>)}{issues.length>15&&<p className="more-issues">+ {issues.length-15} more issues</p>}</div>}
      {state==='failed'&&<p className="form-error">{failure} The previous paper was not changed.</p>}{state==='done'&&<div className="upload-next-actions"><a href={`/organizer/assessment?assessment=${encodeURIComponent(assessmentId)}`}>Review settings</a><a className="solid-action small" href="/organizer">Return to dashboard →</a></div>}
      {state==='importing'&&<div className="paper-publish-overlay" role="dialog" aria-modal="true" aria-live="polite"><div className="paper-publish-loader"><p className="page-label">Protected paper publishing</p><div className="paper-loader-heading"><h2>Checking every question and image.</h2><strong>{progressPercent}%</strong></div><div className="paper-loader-track"><i style={{width:`${progressPercent}%`}}/></div><p>{progress}</p><blockquote>“A careful validation now prevents an unfair question during the assessment.”</blockquote><small>Do not close this tab or move to another organizer section until publishing finishes.</small></div></div>}
    </section>
    <aside className="upload-guidance"><p className="page-label">Supported paper types</p><h3>MCQ, multiple-select, TITA and comprehension</h3><dl><div><dt>Start simple</dt><dd>The simple template contains only common paper fields. Topic and Difficulty power useful analysis; Section is optional, and Subtopic/Tag stay in the advanced file.</dd></div><div><dt>Images</dt><dd>Put the exact filename in Image—such as q01.png—then place a file with that exact name in the ZIP. The validator maps and previews it automatically.</dd></div><div><dt>Answers</dt><dd>Full option text is preferred. A–F labels are normalized automatically.</dd></div><div><dt>TITA</dt><dd>Use Accepted Variants separated by | or a numeric TITA Tolerance in the advanced template.</dd></div><div><dt>Corrections</dt><dd>Preview options and images above. Before candidate activity, one wrong question can be edited without re-uploading the CSV.</dd></div></dl><div className="scope-note"><strong>Deliberately deferred</strong><p>Coding, audio/video and subjective scoring are outside the first live OA build.</p></div></aside>
  </div>;
}
