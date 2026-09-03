import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl = (process.env.LOAD_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const candidates = Number(process.argv[2] || 200);
const assessmentId = process.argv[3] || `load-${candidates}`;
const concurrency = Number(process.env.LOAD_CONCURRENCY || 50);
const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error('AUTH_SECRET is required for the local load rehearsal.');

const b64 = (value) => Buffer.from(value).toString('base64url');
const token = (sub, email, role = 'candidate') => {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({ sub, email, name: sub, role, iat: now, exp: now + 7200 }));
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retryable = new Set([429, 500, 502, 503, 504]);
const latencies = [];
const errors = [];
let completed = 0;
let retries = 0;

async function call(path, { method = 'GET', body, cookie, ip } = {}, attempt = 0) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie: `cna_session=${encodeURIComponent(cookie)}` } : {}),
      ...(ip ? { 'cf-connecting-ip': ip } : {}),
      origin: baseUrl,
      'sec-fetch-site': 'same-origin',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  latencies.push(performance.now() - started);
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (response.status === 409 && path === '/api/attempts/save' && payload.checkpoint) {
    const checkpoint = payload.checkpoint;
    const matchesCommittedRetry = Number(checkpoint.answer_version) === Number(body.baseVersion) + 1
      && checkpoint.answers_json === JSON.stringify(body.answers)
      && checkpoint.marked_json === JSON.stringify(body.marked)
      && Number(checkpoint.tab_switches || 0) === Number(body.tabSwitches || 0);
    if (matchesCommittedRetry) return { saved: true, answerVersion: Number(checkpoint.answer_version), recoveredRetry: true };
  }
  if (!response.ok && retryable.has(response.status) && attempt < 4) {
    retries += 1;
    await delay(100 * (2 ** attempt) + Math.floor(Math.random() * 100));
    return call(path, { method, body, cookie, ip }, attempt + 1);
  }
  if (!response.ok) throw new Error(`${method} ${path} ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function candidate(i) {
  const sub = `load-user-${candidates}-${i}`;
  const cookie = token(sub, `${sub}@example.test`);
  const ip = `10.${Math.floor(i / 65536) % 255}.${Math.floor(i / 256) % 255}.${i % 255}`;
  const start = await call('/api/attempts/start', { method: 'POST', body: { assessmentId }, cookie, ip });
  const attemptId = start.attemptId;
  const session = await call(`/api/attempts/session?attemptId=${encodeURIComponent(attemptId)}`, { cookie, ip });
  let version = Number(session.answerVersion || 0);
  const answers = {};
  for (let batch = 0; batch < 3; batch += 1) {
    for (let q = 1; q <= 8; q += 1) answers[`${assessmentId}-q-${batch * 8 + q}`] = ['A'];
    const saved = await call('/api/attempts/save', {
      method: 'POST', cookie, ip,
      body: { attemptId, baseVersion: version, answers, marked: [], timeSpent: {}, tabSwitches: 0 },
    });
    version = Number(saved.answerVersion);
  }
  await call('/api/attempts/submit', {
    method: 'POST', cookie, ip,
    body: { attemptId, answers, marked: [], timeSpent: {}, tabSwitches: 0 },
  });
  completed += 1;
}

const startedAt = performance.now();
let next = 0;
async function worker() {
  while (next < candidates) {
    const i = next++;
    try { await candidate(i); } catch (error) { errors.push(String(error)); }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, candidates) }, worker));

if (!errors.length) {
  const organizer = token('load-organizer', 'caciitg@gmail.com', 'organizer');
  const ip = '10.255.255.1';
  await call('/api/assessments/status', { method: 'POST', cookie: organizer, ip, body: { assessmentId, action: 'end_test' } });
  const begun = await call('/api/assessments/status', { method: 'POST', cookie: organizer, ip, body: { assessmentId, action: 'begin_result_processing' } });
  let job = begun.job;
  for (let step = 0; job && job.status !== 'complete' && step < 20; step += 1) {
    const result = await call('/api/results/manage', { method: 'POST', cookie: organizer, ip, body: { assessmentId, action: 'process_batch', jobId: job.id } });
    job = result.job;
  }
  if (job?.status !== 'complete') errors.push('Batched result job did not complete.');
}

latencies.sort((a, b) => a - b);
const percentile = (p) => Number((latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] || 0).toFixed(1));
const report = {
  passed: errors.length === 0,
  candidates,
  completed,
  requests: latencies.length,
  retries,
  concurrency,
  elapsedMs: Math.round(performance.now() - startedAt),
  p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99),
  errors: errors.slice(0, 10),
};
mkdirSync('outputs', { recursive: true });
writeFileSync(`outputs/load-report-${candidates}.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
