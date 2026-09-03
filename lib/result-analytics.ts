export type RankedAttempt = { id:string; score:number; durationSeconds:number; submittedAt:number };

export function rankCohort(attempts:RankedAttempt[]){
  const ordered=[...attempts].sort((a,b)=>b.score-a.score||a.durationSeconds-b.durationSeconds||a.submittedAt-b.submittedAt||a.id.localeCompare(b.id));
  const scores=[...attempts].map((item)=>item.score);
  return ordered.map((item,index)=>({
    ...item,
    rank:index+1,
    percentile:Number((100*scores.filter((score)=>score<=item.score).length/Math.max(1,scores.length)).toFixed(2)),
  }));
}

export function strengthLabel(accuracy:number,attemptRate:number){
  if(attemptRate<45)return 'Low attempt';
  if(accuracy>=75)return 'Strong';
  if(accuracy>=55)return 'Developing';
  return 'Needs work';
}
