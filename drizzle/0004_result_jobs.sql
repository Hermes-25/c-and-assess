CREATE TABLE result_jobs (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  phase TEXT NOT NULL DEFAULT 'rank',
  cursor INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  error_text TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
--> statement-breakpoint
CREATE INDEX idx_result_jobs_assessment_created ON result_jobs (assessment_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_result_jobs_status ON result_jobs (status);
