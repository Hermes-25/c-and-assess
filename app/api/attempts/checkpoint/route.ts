import { env } from 'cloudflare:workers';
import { getRequestSession } from '../../../../lib/auth';
import { protectMutation } from '../../../../lib/request-security';

async function ensureTable() {
  // Kept for the legacy demo route; deployment migrations own this table.
  if(true)return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS attempt_checkpoints (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      marked_json TEXT NOT NULL DEFAULT '[]',
      tab_switches INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return Response.json({ error: 'Candidate sign-in required.' }, { status: 401 });
  const assessmentId = new URL(request.url).searchParams.get('assessmentId');
  if (!assessmentId) return Response.json({ error: 'Assessment is required.' }, { status: 400 });
  await ensureTable();
  const id = `${assessmentId}:${session.sub}`;
  const row = await env.DB.prepare('SELECT answers_json, marked_json, tab_switches, updated_at FROM attempt_checkpoints WHERE id = ?').bind(id).first<{ answers_json: string; marked_json: string; tab_switches: number; updated_at: number }>();
  if (!row) return Response.json({ checkpoint: null });
  return Response.json({ checkpoint: { answers: JSON.parse(row.answers_json), marked: JSON.parse(row.marked_json), tabSwitches: row.tab_switches, updatedAt: row.updated_at } });
}

export async function POST(request: Request) {
  const blocked=protectMutation(request,{scope:'legacy-checkpoint',limit:30});if(blocked)return blocked;
  const session = await getRequestSession(request);
  if (!session) return Response.json({ error: 'Candidate sign-in required.' }, { status: 401 });
  const payload = await request.json() as {
    assessmentId?: string; answers?: Record<string, string[]>; marked?: number[]; tabSwitches?: number;
  };
  if (!payload.assessmentId || !payload.answers) {
    return Response.json({ error: 'Invalid checkpoint.' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  await ensureTable();
  const checkpointId = `${payload.assessmentId}:${session.sub}`;
  await env.DB.prepare(`
    INSERT INTO attempt_checkpoints (id, assessment_id, answers_json, marked_json, tab_switches, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      answers_json = excluded.answers_json,
      marked_json = excluded.marked_json,
      tab_switches = excluded.tab_switches,
      updated_at = excluded.updated_at
  `).bind(
    checkpointId,
    payload.assessmentId,
    JSON.stringify(payload.answers),
    JSON.stringify(payload.marked ?? []),
    payload.tabSwitches ?? 0,
    now,
  ).run();

  return Response.json({ saved: true, at: now });
}
