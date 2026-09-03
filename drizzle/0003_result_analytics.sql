CREATE TABLE attempts_results_new (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'started',answers_json TEXT NOT NULL DEFAULT '{}',marked_json TEXT NOT NULL DEFAULT '[]',answered_count INTEGER NOT NULL DEFAULT 0,tab_switches INTEGER NOT NULL DEFAULT 0,violations_json TEXT NOT NULL DEFAULT '[]',paper_version INTEGER NOT NULL DEFAULT 0,shuffle_seed TEXT NOT NULL DEFAULT '',question_order_json TEXT NOT NULL DEFAULT '[]',answer_version INTEGER NOT NULL DEFAULT 0,last_checkpoint_at INTEGER,result_json TEXT NOT NULL DEFAULT '{}',time_spent_json TEXT NOT NULL DEFAULT '{}',score REAL,max_score REAL,correct_count INTEGER,incorrect_count INTEGER,unattempted_count INTEGER,percentile REAL,rank INTEGER,excluded_at INTEGER,excluded_reason TEXT,evaluation_version INTEGER NOT NULL DEFAULT 1,started_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,submitted_at INTEGER,scored_at INTEGER,updated_at INTEGER NOT NULL);
--> statement-breakpoint
INSERT INTO attempts_results_new (id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,paper_version,shuffle_seed,question_order_json,answer_version,last_checkpoint_at,result_json,score,max_score,correct_count,incorrect_count,unattempted_count,percentile,rank,started_at,expires_at,submitted_at,scored_at,updated_at) SELECT id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,paper_version,shuffle_seed,question_order_json,answer_version,last_checkpoint_at,result_json,score,max_score,correct_count,incorrect_count,unattempted_count,percentile,rank,started_at,expires_at,submitted_at,scored_at,updated_at FROM attempts;
--> statement-breakpoint
DROP TABLE attempts;
--> statement-breakpoint
ALTER TABLE attempts_results_new RENAME TO attempts;
--> statement-breakpoint
CREATE TABLE question_metrics (assessment_id TEXT NOT NULL,question_id TEXT NOT NULL,attempts_count INTEGER NOT NULL DEFAULT 0,correct_count INTEGER NOT NULL DEFAULT 0,incorrect_count INTEGER NOT NULL DEFAULT 0,skipped_count INTEGER NOT NULL DEFAULT 0,average_awarded REAL NOT NULL DEFAULT 0,average_time_seconds REAL NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,PRIMARY KEY (assessment_id,question_id));
--> statement-breakpoint
CREATE TABLE result_runs (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,eligible_attempts INTEGER NOT NULL,excluded_attempts INTEGER NOT NULL,highest_score REAL NOT NULL DEFAULT 0,average_score REAL NOT NULL DEFAULT 0,summary_json TEXT NOT NULL DEFAULT '{}',created_by TEXT NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_attempts_assessment_user ON attempts (assessment_id,user_id);
--> statement-breakpoint
CREATE INDEX idx_attempts_assessment_status ON attempts (assessment_id,status);
--> statement-breakpoint
CREATE INDEX idx_attempts_assessment_score ON attempts (assessment_id,score);
--> statement-breakpoint
CREATE INDEX idx_attempts_assessment_rank ON attempts (assessment_id,rank);
--> statement-breakpoint
CREATE INDEX idx_result_runs_assessment_created ON result_runs (assessment_id,created_at);
