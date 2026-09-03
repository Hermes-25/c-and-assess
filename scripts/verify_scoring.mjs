import { scoreAttempt } from '../lib/scoring.ts';

const questions = [
  { id:'m', type:'mcq', answers_json:'["B"]', accepted_variants_json:'[]', tita_tolerance:null, marks:3, negative_marks:1 },
  { id:'x', type:'multi', answers_json:'["A","C"]', accepted_variants_json:'[]', tita_tolerance:null, marks:4, negative_marks:2 },
  { id:'t', type:'tita', answers_json:'["12.5"]', accepted_variants_json:'["12.50"]', tita_tolerance:0.01, marks:2, negative_marks:0 },
];
const perfect = scoreAttempt(questions, { m:['B'], x:['C','A'], t:['12.505'] });
if (perfect.score !== 9 || perfect.correct !== 3 || perfect.maxScore !== 9) throw new Error(JSON.stringify(perfect));
const partial = scoreAttempt(questions, { m:['A'], x:['A'] });
if (partial.score !== -3 || partial.incorrect !== 2 || partial.unattempted !== 1) throw new Error(JSON.stringify(partial));
console.log('scoring-ok', JSON.stringify({ perfect, partial }));
