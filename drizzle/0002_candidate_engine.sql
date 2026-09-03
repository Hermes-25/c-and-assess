CREATE TABLE attempts_candidate_new (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'started',answers_json TEXT NOT NULL DEFAULT '{}',marked_json TEXT NOT NULL DEFAULT '[]',answered_count INTEGER NOT NULL DEFAULT 0,tab_switches INTEGER NOT NULL DEFAULT 0,violations_json TEXT NOT NULL DEFAULT '[]',paper_version INTEGER NOT NULL DEFAULT 0,shuffle_seed TEXT NOT NULL DEFAULT '',question_order_json TEXT NOT NULL DEFAULT '[]',answer_version INTEGER NOT NULL DEFAULT 0,last_checkpoint_at INTEGER,result_json TEXT NOT NULL DEFAULT '{}',score REAL,max_score REAL,correct_count INTEGER,incorrect_count INTEGER,unattempted_count INTEGER,percentile REAL,rank INTEGER,started_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,submitted_at INTEGER,scored_at INTEGER,updated_at INTEGER NOT NULL);
--> statement-breakpoint
INSERT INTO attempts_candidate_new (id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,score,percentile,rank,started_at,expires_at,submitted_at,updated_at) SELECT id,assessment_id,user_id,status,answers_json,marked_json,answered_count,tab_switches,violations_json,score,percentile,rank,started_at,expires_at,submitted_at,updated_at FROM attempts;
--> statement-breakpoint
DROP TABLE attempts;
--> statement-breakpoint
ALTER TABLE attempts_candidate_new RENAME TO attempts;
--> statement-breakpoint
CREATE TABLE registrations_candidate_new (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL,user_id TEXT NOT NULL,email TEXT NOT NULL,name TEXT,college TEXT,graduation_year INTEGER,branch TEXT,status TEXT NOT NULL DEFAULT 'registered',consent_at INTEGER,profile_json TEXT NOT NULL DEFAULT '{}',blocked_reason TEXT,registered_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
--> statement-breakpoint
INSERT INTO registrations_candidate_new (id,assessment_id,user_id,email,name,college,graduation_year,branch,status,registered_at,updated_at) SELECT id,assessment_id,user_id,email,name,college,graduation_year,branch,status,registered_at,updated_at FROM registrations;
--> statement-breakpoint
DROP TABLE registrations;
--> statement-breakpoint
ALTER TABLE registrations_candidate_new RENAME TO registrations;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS proctor_events (id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,event_type TEXT NOT NULL,detail_json TEXT NOT NULL DEFAULT '{}',occurred_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_attempts_assessment_user ON attempts (assessment_id,user_id);
--> statement-breakpoint
CREATE INDEX idx_attempts_assessment_status ON attempts (assessment_id,status);
--> statement-breakpoint
CREATE INDEX idx_attempts_assessment_score ON attempts (assessment_id,score);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_registrations_assessment_user ON registrations (assessment_id,user_id);
--> statement-breakpoint
CREATE INDEX idx_registrations_assessment_status ON registrations (assessment_id,status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proctor_events_attempt ON proctor_events (attempt_id);
