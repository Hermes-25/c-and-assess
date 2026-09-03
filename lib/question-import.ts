export type RawQuestionRow = Record<string, string | number | string[] | null | undefined>;
export type QuestionIssue = { row: number; level: 'error' | 'warning'; field?: string; message: string };
export type NormalizedQuestion = {
  position: number; type: 'mcq' | 'multi' | 'tita' | 'subjective' | 'comprehension'; prompt: string; passage: string;
  choices: string[]; answers: string[]; solution: string; marks: number; negativeMarks: number;
  answerKeywords: string[]; keywordMarks: number; imageName: string | null; durationSeconds: number | null;
  sectionName: string; topic: string; subtopic: string; difficulty: 'easy' | 'medium' | 'hard'; source: string;
  acceptedVariants: string[]; titaTolerance: number | null; fingerprint: string;
};

const labels = ['A','B','C','D','E','F'];
const value = (row: RawQuestionRow, ...keys: string[]) => {
  for (const key of keys) {
    const found = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === key.toLowerCase());
    if (found) return String(row[found] ?? '').trim();
  }
  return '';
};

function normalizeType(raw: string, answer: string) {
  const type = raw.trim().toLowerCase();
  if (['subjective','text box','textbox','long answer'].includes(type)) return 'subjective' as const;
  if (['tita','single line','fill in the blanks','fill in the blank','numerical'].includes(type)) return 'tita' as const;
  if (['checkbox','multi','multiple select','multiple correct'].includes(type)) return 'multi' as const;
  if (['comprehension','passage','reading comprehension'].includes(type)) return 'comprehension' as const;
  if (['objective','mcq','multiple choice'].includes(type)) return answer.split(',').filter((part) => part.trim()).length > 1 ? 'multi' as const : 'mcq' as const;
  return null;
}

function fingerprint(prompt: string) {
  return prompt.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().slice(0, 500);
}

export function normalizeQuestionRows(rows: RawQuestionRow[], startPosition = 1) {
  const issues: QuestionIssue[] = [];
  const normalized: NormalizedQuestion[] = [];
  const fingerprints = new Set<string>();

  rows.forEach((row, index) => {
    const position = startPosition + index;
    const displayRow = position + 1;
    const prompt = value(row, 'Question', 'Questions');
    const answer = value(row, 'Answer');
    const choices = Array.from({ length: 6 }, (_, choice) => value(row, `Choice${choice + 1}`, `Option${choice + 1}`)).filter(Boolean);
    const type = normalizeType(value(row, 'Type'), answer);
    const marks = Number(value(row, 'Marks'));
    const negativeMarks = Number(value(row, 'Negative Marks', 'Negative Mark') || 0);
    const difficultyRaw = value(row, 'Difficulty', 'Complexity').toLowerCase() || 'medium';
    const rowFingerprint = fingerprint(prompt);
    if (!prompt) issues.push({ row: displayRow, level: 'error', field: 'Question', message: 'Question is empty.' });
    if (!type) issues.push({ row: displayRow, level: 'error', field: 'Type', message: `Unsupported question type “${value(row, 'Type') || 'blank'}”.` });
    if (!Number.isFinite(marks) || marks <= 0) issues.push({ row: displayRow, level: 'error', field: 'Marks', message: 'Marks must be a positive number.' });
    if (!Number.isFinite(negativeMarks) || negativeMarks < 0) issues.push({ row: displayRow, level: 'error', field: 'Negative Marks', message: 'Negative marks must be zero or positive.' });
    if (!['easy','medium','hard'].includes(difficultyRaw)) issues.push({ row: displayRow, level: 'error', field: 'Difficulty', message: 'Difficulty must be easy, medium or hard.' });
    if (negativeMarks > marks) issues.push({ row: displayRow, level: 'warning', field: 'Negative Marks', message: 'Negative marks are greater than positive marks.' });
    if ((type === 'mcq' || type === 'multi' || type === 'comprehension') && choices.length < 2) issues.push({ row: displayRow, level: 'error', field: 'Choices', message: 'Objective questions need at least two choices.' });
    if (type !== 'subjective' && !answer) issues.push({ row: displayRow, level: 'error', field: 'Answer', message: 'An answer is required for auto-evaluated questions.' });
    if (type === 'comprehension' && !value(row, 'Passage', 'Comprehension')) issues.push({ row: displayRow, level: 'error', field: 'Passage', message: 'Comprehension questions require a passage.' });
    if (rowFingerprint && fingerprints.has(rowFingerprint)) issues.push({ row: displayRow, level: 'error', field: 'Question', message: 'Duplicate question in this upload.' });
    fingerprints.add(rowFingerprint);

    let answers: string[] = [];
    if (type === 'mcq' || type === 'multi' || type === 'comprehension') {
      const parts = (type === 'multi' ? answer.split(',') : [answer]).map((part) => part.trim()).filter(Boolean);
      answers = parts.map((part) => {
        const labelIndex = labels.indexOf(part.toUpperCase());
        if (labelIndex >= 0) {
          issues.push({ row: displayRow, level: 'warning', field: 'Answer', message: `Option ${part.toUpperCase()} was converted to its full answer text.` });
          return choices[labelIndex] || '';
        }
        return choices.find((choice) => choice.toLowerCase() === part.toLowerCase()) || '';
      });
      if (answers.some((item) => !item)) issues.push({ row: displayRow, level: 'error', field: 'Answer', message: 'Answer must exactly match an option’s text or valid A–F label.' });
      if (new Set(answers).size !== answers.length) issues.push({ row: displayRow, level: 'error', field: 'Answer', message: 'The same correct option is listed more than once.' });
    } else if (answer) answers = [answer];

    const toleranceRaw = value(row, 'TITA Tolerance', 'Tolerance');
    const tolerance = toleranceRaw ? Number(toleranceRaw) : null;
    if (toleranceRaw && (!Number.isFinite(tolerance) || Number(tolerance) < 0)) issues.push({ row: displayRow, level: 'error', field: 'TITA Tolerance', message: 'Tolerance must be zero or a positive number.' });

    if (prompt && type && Number.isFinite(marks) && marks > 0 && Number.isFinite(negativeMarks)) normalized.push({
      position, type, prompt, passage: value(row, 'Passage', 'Comprehension'), choices, answers,
      solution: value(row, 'Solution', 'Solutions'), marks, negativeMarks,
      answerKeywords: value(row, 'Answer Keywords').split(',').map((item) => item.trim()).filter(Boolean),
      keywordMarks: Number(value(row, 'Answer Keywords marks', 'Answer Keywords Marks') || 0),
      imageName: value(row, 'Image') || null,
      durationSeconds: value(row, 'Duration In Seconds') ? Number(value(row, 'Duration In Seconds')) : null,
      sectionName: value(row, 'Section') || 'General', topic: value(row, 'Topic', 'Tag') || 'General',
      subtopic: value(row, 'Subtopic', 'Sub-topic'), difficulty: (['easy','medium','hard'].includes(difficultyRaw) ? difficultyRaw : 'medium') as 'easy' | 'medium' | 'hard',
      source: value(row, 'Source'), acceptedVariants: value(row, 'Accepted Variants').split('|').map((item) => item.trim()).filter(Boolean),
      titaTolerance: tolerance, fingerprint: rowFingerprint,
    });
  });
  return { normalized, issues };
}

