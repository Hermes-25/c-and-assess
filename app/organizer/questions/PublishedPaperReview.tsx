'use client';

import { FormEvent,useState } from 'react';
import { usePendingNavigationGuard } from '../../_components/usePendingNavigationGuard';

export type PublishedQuestion={id:string;position:number;type:string;prompt:string;passage:string;options_json:string;answers_json:string;solution:string;marks:number;negative_marks:number;topic:string;subtopic:string;difficulty:string;image_key:string|null};
const json=(value:string)=>{try{return JSON.parse(value||'[]') as string[];}catch{return [];}};

export function PublishedPaperReview({initial,status}:{initial:PublishedQuestion[];status:string}){
  const [questions,setQuestions]=useState(initial);
  const [editing,setEditing]=useState<PublishedQuestion|null>(null);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [editorDirty,setEditorDirty]=useState(false);
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [removeImage,setRemoveImage]=useState(false);
  const locked=['live','ended','results_processing','results_ready','results_released','archived'].includes(status);
  const imageCount=questions.filter((question)=>Boolean(question.image_key)).length;
  usePendingNavigationGuard(Boolean(editing)&&(editorDirty||saving),'This question has changes that are not safely saved yet. Leave the organizer workspace anyway?');

  function edit(question:PublishedQuestion){setEditing(question);setEditorDirty(false);setImageFile(null);setRemoveImage(false);setMessage('');}
  function close(){if((editorDirty||saving)&&!window.confirm('Discard the unsaved changes to this question?'))return;setEditing(null);setEditorDirty(false);setImageFile(null);setRemoveImage(false);}

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editing)return;setSaving(true);setMessage('');
    try{
      const form=new FormData(event.currentTarget);
      const options=String(form.get('options')||'').split('\n').map((item)=>item.trim()).filter(Boolean);
      const answers=String(form.get('answers')||'').split('\n').map((item)=>item.trim()).filter(Boolean);
      const response=await fetch('/api/questions/manage',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({questionId:editing.id,prompt:form.get('prompt'),passage:form.get('passage'),options,answers,solution:form.get('solution'),marks:Number(form.get('marks')),negativeMarks:Number(form.get('negativeMarks')),topic:form.get('topic'),subtopic:form.get('subtopic'),difficulty:form.get('difficulty')})});
      const data=await response.json() as {error?:string;question?:PublishedQuestion};
      if(!response.ok||!data.question)throw new Error(data.error||'Question could not be updated.');
      let updated=data.question;
      setQuestions((items)=>items.map((item)=>item.id===editing.id?updated:item));
      if(imageFile||removeImage){
        const imageForm=new FormData();imageForm.append('questionId',editing.id);imageForm.append('remove',String(removeImage));if(imageFile)imageForm.append('image',imageFile,imageFile.name);
        const imageResponse=await fetch('/api/questions/manage-image',{method:'POST',body:imageForm});
        const imageData=await imageResponse.json() as {error?:string;imageKey?:string|null};
        if(!imageResponse.ok)throw new Error(`Question text was saved, but the image was not changed: ${imageData.error||'image update failed.'}`);
        updated={...updated,image_key:imageData.imageKey||null};
        setQuestions((items)=>items.map((item)=>item.id===editing.id?updated:item));
      }
      setEditing(null);setEditorDirty(false);setImageFile(null);setRemoveImage(false);setMessage(`Question ${editing.position}, including its image, is saved.`);
    }catch(reason){setMessage(reason instanceof Error?reason.message:'Question could not be updated.');}
    finally{setSaving(false);}
  }

  if(!questions.length)return null;
  return <section className="published-paper-review">
    <header><div><p className="page-label">Published paper · used by candidates</p><h3>Preview the complete published paper</h3><p>This is the exact question paper candidates receive. The local CSV/ZIP uploader below does not change it until publishing succeeds.</p></div><div className="published-paper-status"><strong>{questions.length} questions</strong><span className={imageCount?'has-images':'no-images'}>{imageCount} question image{imageCount===1?'':'s'} attached</span></div></header>
    {message&&<p className="paper-review-message" role="status">{message}</p>}
    <div className="published-question-list">{questions.map((question,index)=>{const options=json(question.options_json),answers=json(question.answers_json);return <details open={questions.length<=5||index===0} key={question.id}>
      <summary><span>Q{question.position}</span><strong>{question.prompt}</strong><small>{question.type.toUpperCase()} · {question.topic} · {question.marks} marks</small></summary>
      <div className="published-question-body">{question.passage&&<div className="review-passage">{question.passage}</div>}<h4>{question.prompt}</h4>
        {question.image_key?<img src={`/api/questions/preview-image?questionId=${encodeURIComponent(question.id)}&v=${encodeURIComponent(question.image_key)}`} alt={`Reference for question ${question.position}`}/>:<p className="paper-no-image">No image is attached to this published question.</p>}<ol>{options.map((option)=><li className={answers.includes(option)?'correct':''} key={option}>{option}{answers.includes(option)&&<b>Answer</b>}</li>)}</ol>
        {question.type==='tita'&&<p className="published-tita"><strong>Accepted answer:</strong> {answers.join(' · ')}</p>}<div className="published-solution"><strong>Solution</strong><p>{question.solution||'No written solution added.'}</p></div><button type="button" disabled={locked} onClick={()=>edit(question)}>{locked?'Locked after candidate activity':'Edit question & image'}</button>
      </div></details>;})}</div>
    {editing&&<div className="paper-edit-modal" role="dialog" aria-modal="true"><form onSubmit={save} onChange={()=>setEditorDirty(true)}><header><div><p className="page-label">Edit question {editing.position}</p><h3>Correct this question in place</h3></div><button type="button" onClick={close}>Close</button></header>
      <label>Question<textarea name="prompt" defaultValue={editing.prompt} required/></label><label>Passage / shared context<textarea name="passage" defaultValue={editing.passage}/></label>
      {editing.type!=='tita'&&<label>Options <small>One option per line</small><textarea name="options" defaultValue={json(editing.options_json).join('\n')} required/></label>}
      <label>Correct answer{editing.type==='multi'&&'s'} <small>Exact option text; one answer per line</small><textarea name="answers" defaultValue={json(editing.answers_json).join('\n')} required/></label><label>Solution<textarea name="solution" defaultValue={editing.solution}/></label>
      <div className="paper-image-editor"><span>Question image</span><small>{editing.image_key?'A protected image is currently attached. Replace it below or remove it.':'No image is currently attached. You can add one now.'}</small><input name="replacementImage" type="file" accept="image/png,image/jpeg" onChange={(event)=>{setImageFile(event.target.files?.[0]||null);setRemoveImage(false);setEditorDirty(true);}}/>{editing.image_key&&<label><input type="checkbox" checked={removeImage} onChange={(event)=>{setRemoveImage(event.target.checked);if(event.target.checked)setImageFile(null);setEditorDirty(true);}}/> Remove the current image</label>}</div>
      <div className="paper-edit-grid"><label>Marks<input name="marks" type="number" min="0.01" step="0.01" defaultValue={editing.marks} required/></label><label>Negative marks<input name="negativeMarks" type="number" min="0" step="0.01" defaultValue={editing.negative_marks}/></label><label>Topic<input name="topic" defaultValue={editing.topic}/></label><label>Subtopic <small>Optional</small><input name="subtopic" defaultValue={editing.subtopic}/></label><label>Difficulty<select name="difficulty" defaultValue={editing.difficulty}><option>easy</option><option>medium</option><option>hard</option></select></label></div><button className="solid-action" disabled={saving}>{saving?'Saving question & image…':'Save question & image'}</button>
    </form></div>}
  </section>;
}
