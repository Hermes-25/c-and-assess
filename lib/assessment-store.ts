import { env } from 'cloudflare:workers';

export const assessmentStatuses = ['draft','registration_open','registration_closed','scheduled','live','ended','results_processing','results_ready','results_released','archived'] as const;
export type AssessmentStatus = typeof assessmentStatuses[number];

export type AssessmentSettings = {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowEditing: boolean;
  maxTabSwitches: number;
  startPolicy: 'full_duration' | 'common_deadline';
  resultVisibility: 'manual_release';
  solutionVisibility: 'with_results' | 'separate_release';
  tieBreaker: 'shorter_time';
  audience: 'open' | 'domains';
  allowedDomains: string[];
  registrationCapacity: number | null;
  solutionsReleased: boolean;
};

export const defaultAssessmentSettings: AssessmentSettings = {
  shuffleQuestions: true,
  shuffleOptions: true,
  allowEditing: true,
  maxTabSwitches: 3,
  startPolicy: 'common_deadline',
  resultVisibility: 'manual_release',
  solutionVisibility: 'separate_release',
  tieBreaker: 'shorter_time',
  audience: 'open',
  allowedDomains: [],
  registrationCapacity: null,
  solutionsReleased: false,
};

export async function syncAssessmentClock() {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`UPDATE assessments SET
    status = CASE
      WHEN ends_at IS NOT NULL AND ends_at <= ? THEN 'ended'
      WHEN starts_at IS NOT NULL AND starts_at <= ? AND ends_at > ? THEN 'live'
      ELSE status
    END,
    updated_at = ?
    WHERE status IN ('registration_open','registration_closed','scheduled','live')
      AND (
        (ends_at IS NOT NULL AND ends_at <= ?)
        OR (status != 'live' AND starts_at IS NOT NULL AND starts_at <= ? AND ends_at > ?)
      )`)
    .bind(now, now, now, now, now, now, now).run();
}

type D1Column = { name: string };

async function columns(table: string) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all<D1Column>();
  return new Set(result.results.map((column) => column.name));
}

export async function ensureAssessmentSchema() {
  // Production migrations are applied by the deployment pipeline. Request
  // handlers keep this compatibility call as a zero-cost no-op.
  if (true) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)').run();
  const applied = await env.DB.prepare('SELECT id FROM app_migrations WHERE id = ?').bind('assessment_lifecycle_v1').first();
  if (applied) return;

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft', duration_seconds INTEGER NOT NULL, starts_at INTEGER, ends_at INTEGER,
    settings_json TEXT NOT NULL DEFAULT '{}', created_by TEXT NOT NULL, created_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, position INTEGER NOT NULL, type TEXT NOT NULL,
    prompt TEXT NOT NULL, options_json TEXT NOT NULL DEFAULT '[]', answers_json TEXT NOT NULL DEFAULT '[]',
    solution TEXT NOT NULL DEFAULT '', marks REAL NOT NULL, negative_marks REAL NOT NULL DEFAULT 0,
    answer_keywords_json TEXT NOT NULL DEFAULT '[]', keyword_marks REAL NOT NULL DEFAULT 0,
    image_key TEXT, duration_seconds INTEGER, tag TEXT NOT NULL DEFAULT 'General', difficulty TEXT NOT NULL DEFAULT 'medium'
  )`).run();

  const assessmentColumns = await columns('assessments');
  const questionColumns = await columns('questions');
  if (!assessmentColumns.has('paper_version')) {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE assessments_lifecycle_new (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
        duration_seconds INTEGER NOT NULL, registration_starts_at INTEGER, registration_ends_at INTEGER, starts_at INTEGER, ends_at INTEGER,
        settings_json TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1, paper_version INTEGER NOT NULL DEFAULT 0,
        question_count INTEGER NOT NULL DEFAULT 0, total_marks REAL NOT NULL DEFAULT 0, published_at INTEGER,
        created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`),
      env.DB.prepare(`INSERT INTO assessments_lifecycle_new SELECT id, slug, title, description,
        CASE WHEN status = 'published' THEN 'results_released' ELSE status END, duration_seconds,
        created_at, starts_at, starts_at, ends_at, settings_json, 1, 0,
        (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = assessments.id),
        COALESCE((SELECT SUM(marks) FROM questions q WHERE q.assessment_id = assessments.id),0), NULL,
        created_by, created_at, created_at FROM assessments`),
      env.DB.prepare('DROP TABLE assessments'),
      env.DB.prepare('ALTER TABLE assessments_lifecycle_new RENAME TO assessments'),
    ]);
  }
  if (!questionColumns.has('is_active')) {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE questions_lifecycle_new (
        id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, position INTEGER NOT NULL, type TEXT NOT NULL, prompt TEXT NOT NULL,
        section_id TEXT, passage TEXT NOT NULL DEFAULT '', options_json TEXT NOT NULL DEFAULT '[]', answers_json TEXT NOT NULL DEFAULT '[]',
        solution TEXT NOT NULL DEFAULT '', marks REAL NOT NULL, negative_marks REAL NOT NULL DEFAULT 0,
        answer_keywords_json TEXT NOT NULL DEFAULT '[]', keyword_marks REAL NOT NULL DEFAULT 0, image_key TEXT, duration_seconds INTEGER,
        tag TEXT NOT NULL DEFAULT 'General', topic TEXT NOT NULL DEFAULT 'General', subtopic TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '',
        accepted_variants_json TEXT NOT NULL DEFAULT '[]', tita_tolerance REAL, difficulty TEXT NOT NULL DEFAULT 'medium',
        is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
      )`),
      env.DB.prepare(`INSERT INTO questions_lifecycle_new SELECT id, assessment_id, position, type, prompt, NULL, '', options_json, answers_json,
        solution, marks, negative_marks, answer_keywords_json, keyword_marks, image_key, duration_seconds, tag, tag, '', '', '[]', NULL,
        difficulty, 1, 0, 0 FROM questions`),
      env.DB.prepare('DROP TABLE questions'),
      env.DB.prepare('ALTER TABLE questions_lifecycle_new RENAME TO questions'),
    ]);
  }

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'started',
      answers_json TEXT NOT NULL DEFAULT '{}', marked_json TEXT NOT NULL DEFAULT '[]', answered_count INTEGER NOT NULL DEFAULT 0,
      tab_switches INTEGER NOT NULL DEFAULT 0, violations_json TEXT NOT NULL DEFAULT '[]', score REAL, percentile REAL, rank INTEGER,
      started_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, submitted_at INTEGER, updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS assessment_sections (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, name TEXT NOT NULL, position INTEGER NOT NULL,
      duration_seconds INTEGER, instructions TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT,
      college TEXT, graduation_year INTEGER, branch TEXT, status TEXT NOT NULL DEFAULT 'registered',
      registered_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS assessment_versions (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, version INTEGER NOT NULL, kind TEXT NOT NULL,
      snapshot_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS question_versions (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, paper_version INTEGER NOT NULL, question_id TEXT NOT NULL,
      position INTEGER NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS organizer_audit_log (
      id TEXT PRIMARY KEY, assessment_id TEXT, actor_email TEXT NOT NULL, action TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS question_imports (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, source_filename TEXT NOT NULL, status TEXT NOT NULL,
      expected_rows INTEGER NOT NULL, staged_rows INTEGER NOT NULL DEFAULT 0, error_json TEXT NOT NULL DEFAULT '[]',
      image_manifest_json TEXT NOT NULL DEFAULT '[]', uploaded_images_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL, created_at INTEGER NOT NULL, committed_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS question_import_rows (
      import_id TEXT NOT NULL, position INTEGER NOT NULL, prompt_fingerprint TEXT NOT NULL, type TEXT NOT NULL,
      prompt TEXT NOT NULL, passage TEXT NOT NULL DEFAULT '', options_json TEXT NOT NULL DEFAULT '[]',
      answers_json TEXT NOT NULL DEFAULT '[]', solution TEXT NOT NULL DEFAULT '', marks REAL NOT NULL,
      negative_marks REAL NOT NULL DEFAULT 0, answer_keywords_json TEXT NOT NULL DEFAULT '[]', keyword_marks REAL NOT NULL DEFAULT 0,
      image_name TEXT, duration_seconds INTEGER, section_name TEXT NOT NULL DEFAULT 'General', topic TEXT NOT NULL DEFAULT 'General',
      subtopic TEXT NOT NULL DEFAULT '', difficulty TEXT NOT NULL DEFAULT 'medium', source TEXT NOT NULL DEFAULT '',
      accepted_variants_json TEXT NOT NULL DEFAULT '[]', tita_tolerance REAL,
      PRIMARY KEY (import_id, position)
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_slug ON assessments (slug)',
    'CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments (status)',
    'CREATE INDEX IF NOT EXISTS idx_questions_assessment_position ON questions (assessment_id, position)',
    'CREATE INDEX IF NOT EXISTS idx_sections_assessment_position ON assessment_sections (assessment_id, position)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_assessment_user ON registrations (assessment_id, user_id)',
    'CREATE INDEX IF NOT EXISTS idx_registrations_assessment_status ON registrations (assessment_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_versions_assessment_version ON assessment_versions (assessment_id, version)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_question_versions_paper_position ON question_versions (assessment_id, paper_version, position)',
    'CREATE INDEX IF NOT EXISTS idx_audit_assessment_created ON organizer_audit_log (assessment_id, created_at)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_import_rows_fingerprint ON question_import_rows (import_id, prompt_fingerprint)',
  ];
  for (const sql of schemaStatements) await env.DB.prepare(sql).run();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("UPDATE assessments SET status = 'results_released' WHERE status = 'published'").run();
  await env.DB.prepare(`UPDATE assessments SET
    registration_starts_at = COALESCE(registration_starts_at, created_at),
    registration_ends_at = COALESCE(registration_ends_at, starts_at),
    updated_at = CASE WHEN updated_at = 0 THEN created_at ELSE updated_at END,
    question_count = (SELECT COUNT(*) FROM questions WHERE questions.assessment_id = assessments.id AND is_active = 1),
    total_marks = COALESCE((SELECT SUM(marks) FROM questions WHERE questions.assessment_id = assessments.id AND is_active = 1), 0)
  `).run();
  await env.DB.prepare('INSERT OR IGNORE INTO app_migrations (id, applied_at) VALUES (?, ?)').bind('assessment_lifecycle_v1', now).run();
  await env.DB.prepare('PRAGMA optimize').run();
}

export function parseSettings(value: string | null | undefined): AssessmentSettings {
  try { return { ...defaultAssessmentSettings, ...(JSON.parse(value || '{}') as Partial<AssessmentSettings>) }; }
  catch { return defaultAssessmentSettings; }
}

export async function writeAudit(actorEmail: string, action: string, assessmentId?: string, detail: Record<string, unknown> = {}) {
  await env.DB.prepare('INSERT INTO organizer_audit_log (id, assessment_id, actor_email, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), assessmentId || null, actorEmail, action, JSON.stringify(detail), Math.floor(Date.now() / 1000)).run();
}

export async function getAssessment(assessmentId: string): Promise<Record<string, unknown> | null> {
  await ensureAssessmentSchema();
  await syncAssessmentClock();
  const assessment = await env.DB.prepare(`SELECT a.*,
    (SELECT COUNT(*) FROM registrations r WHERE r.assessment_id = a.id) AS registration_count,
    (SELECT COUNT(*) FROM attempts t WHERE t.assessment_id = a.id AND t.status IN ('started','submitted','evaluated')) AS started_count,
    (SELECT COUNT(*) FROM attempts t WHERE t.assessment_id = a.id AND t.status IN ('submitted','evaluated')) AS submitted_count
    FROM assessments a WHERE a.id = ?`).bind(assessmentId).first<Record<string, unknown>>();
  if (!assessment) return null;
  return { ...(assessment as Record<string, unknown>), settings: parseSettings(String(assessment.settings_json || '{}')) };
}

export async function listAssessments(limit = 50) {
  await ensureAssessmentSchema();
  await syncAssessmentClock();
  const result = await env.DB.prepare(`SELECT a.id, a.slug, a.title, a.description, a.status, a.duration_seconds,
    a.registration_starts_at, a.registration_ends_at, a.starts_at, a.ends_at, a.settings_json,
    a.version, a.paper_version, a.question_count, a.total_marks, a.created_at, a.updated_at,
    (SELECT COUNT(*) FROM registrations r WHERE r.assessment_id = a.id) AS registration_count,
    (SELECT COUNT(*) FROM attempts t WHERE t.assessment_id = a.id AND t.status IN ('started','submitted','evaluated')) AS started_count,
    (SELECT COUNT(*) FROM attempts t WHERE t.assessment_id = a.id AND t.status IN ('submitted','evaluated')) AS submitted_count
    FROM assessments a ORDER BY a.updated_at DESC, a.created_at DESC LIMIT ?`).bind(limit).all<Record<string, unknown>>();
  return result.results.map((assessment) => ({ ...assessment, settings: parseSettings(String(assessment.settings_json || '{}')) }));
}

export function publicAssessment(row: Record<string, unknown>) {
  const { settings_json: _settingsJson, ...assessment } = row;
  return assessment;
}
