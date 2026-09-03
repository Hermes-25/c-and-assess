'use client';

import { useEffect,useRef,useState } from 'react';

export function ShareAssessmentButton({assessmentId,title,label='Share assessment',className='share-assessment-button'}:{assessmentId:string;title:string;label?:string;className?:string}){
  const [feedback,setFeedback]=useState('');
  const timer=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);

  async function share(){
    const url=`${window.location.origin}/assessments?assessment=${encodeURIComponent(assessmentId)}`;
    try{
      if(navigator.share){await navigator.share({title:`${title} | C&Assess`,text:`Register for ${title} on C&Assess.`,url});setFeedback('Shared');}
      else{await copy(url);setFeedback('Link copied');}
    }catch(reason){
      if(reason instanceof DOMException&&reason.name==='AbortError')return;
      try{await copy(url);setFeedback('Link copied');}catch{setFeedback('Copy failed');}
    }
    window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setFeedback(''),2400);
  }

  return <button type="button" className={className} onClick={()=>void share()} aria-label={`${label}: ${title}`}><span aria-hidden="true">↗</span>{feedback||label}</button>;
}

async function copy(value:string){
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(value);
  const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const copied=document.execCommand('copy');field.remove();if(!copied)throw new Error('Copy failed');
}
