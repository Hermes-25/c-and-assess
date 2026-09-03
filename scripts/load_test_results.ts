import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { scoreAttempt, type ScoreQuestion } from '../lib/scoring.ts';
import { rankCohort } from '../lib/result-analytics.ts';

const candidateCount=4_000,questionCount=60;
let state=0xCA5517;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const questions:ScoreQuestion[]=Array.from({length:questionCount},(_,index)=>({id:`q-${index+1}`,type:index%10===0?'tita':index%7===0?'multi':'mcq',answers_json:index%10===0?JSON.stringify([String(index+10)]):index%7===0?JSON.stringify(['Alpha','Gamma']):JSON.stringify(['Option B']),accepted_variants_json:'[]',tita_tolerance:index%10===0?0.01:null,marks:3,negative_marks:1}));
const started=performance.now();
const attempts=Array.from({length:candidateCount},(_,candidate)=>{
  const answers:Record<string,string[]>={};
  for(const question of questions){const chance=random();if(chance<.14)continue;if(question.type==='tita')answers[question.id]=[chance<.7?question.answers_json.slice(2,-2):'0'];else if(question.type==='multi')answers[question.id]=chance<.7?['Alpha','Gamma']:['Alpha'];else answers[question.id]=[chance<.7?'Option B':'Option A'];}
  const scored=scoreAttempt(questions,answers);
  return {id:`candidate-${candidate}`,score:scored.score,durationSeconds:1800+Math.floor(random()*1800),submittedAt:1_800_000_000+candidate,details:scored.details};
});
const ranked=rankCohort(attempts.map(({id,score,durationSeconds,submittedAt})=>({id,score,durationSeconds,submittedAt})));
const metrics=Object.fromEntries(questions.map((question)=>[question.id,{attempts:0,correct:0,incorrect:0,skipped:0,awarded:0}]));
for(const attempt of attempts)for(const [questionId,detail] of Object.entries(attempt.details)){const row=metrics[questionId];row.attempts+=1;row.awarded+=detail.awarded;if(detail.status==='correct')row.correct+=1;else if(detail.status==='incorrect')row.incorrect+=1;else row.skipped+=1;}
const elapsed=performance.now()-started;
assert.equal(ranked.length,candidateCount);assert.equal(ranked[0].rank,1);assert.equal(ranked[0].percentile,100);assert.equal(Object.keys(metrics).length,questionCount);assert.ok(Object.values(metrics).every((item)=>item.attempts===candidateCount));
const memory=Math.round(process.memoryUsage().heapUsed/1024/1024);
console.log(JSON.stringify({passed:true,candidates:candidateCount,questions:questionCount,scoredResponses:candidateCount*questionCount,elapsedMs:Number(elapsed.toFixed(1)),heapUsedMb:memory,fastEnoughForOfflineAggregation:elapsed<10_000},null,2));
