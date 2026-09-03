export type ScoreQuestion = {
  id:string; type:string; answers_json:string; accepted_variants_json:string; tita_tolerance:number|null;
  marks:number; negative_marks:number;
};

const parsed = (value:string) => { try { const result=JSON.parse(value); return Array.isArray(result)?result.map(String):[]; } catch { return []; } };
const clean = (value:string) => value.trim().replace(/\s+/g,' ').toLowerCase();
const numeric = (value:string) => Number(value.replaceAll(',','').trim());

export function scoreAttempt(questions:ScoreQuestion[],answers:Record<string,string[]>) {
  let score=0,maxScore=0,correct=0,incorrect=0,unattempted=0;
  const details:Record<string,{status:'correct'|'incorrect'|'unattempted'|'manual';awarded:number}>={};
  for(const question of questions){
    maxScore+=Number(question.marks)||0;
    const response=(answers[question.id]||[]).map(String).map((value)=>value.trim()).filter(Boolean);
    if(!response.length){unattempted+=1;details[question.id]={status:'unattempted',awarded:0};continue;}
    if(question.type==='subjective'){details[question.id]={status:'manual',awarded:0};continue;}
    const keys=parsed(question.answers_json);
    let valid=false;
    if(question.type==='multi'){
      const expected=[...new Set(keys.map(clean))].sort(); const received=[...new Set(response.map(clean))].sort();
      valid=expected.length===received.length&&expected.every((value,index)=>value===received[index]);
    }else if(question.type==='tita'){
      const variants=[...keys,...parsed(question.accepted_variants_json)]; const given=response[0]||'';
      const givenNumber=numeric(given); const tolerance=question.tita_tolerance;
      valid=variants.some((answer)=>{
        const expectedNumber=numeric(answer);
        return tolerance!==null&&Number.isFinite(givenNumber)&&Number.isFinite(expectedNumber)
          ? Math.abs(givenNumber-expectedNumber)<=Math.abs(tolerance)
          : clean(answer.replaceAll(',',''))===clean(given.replaceAll(',',''));
      });
    }else valid=keys.some((answer)=>clean(answer)===clean(response[0]||''));
    const awarded=valid?Number(question.marks)||0:-(Number(question.negative_marks)||0);
    score+=awarded; if(valid)correct+=1;else incorrect+=1;
    details[question.id]={status:valid?'correct':'incorrect',awarded};
  }
  return {score:Number(score.toFixed(4)),maxScore:Number(maxScore.toFixed(4)),correct,incorrect,unattempted,details};
}
