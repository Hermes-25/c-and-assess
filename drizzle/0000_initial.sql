CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `name` text,
  `provider` text NOT NULL,
  `role` text DEFAULT 'candidate' NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `assessments` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `duration_seconds` integer NOT NULL,
  `starts_at` integer,
  `ends_at` integer,
  `settings_json` text DEFAULT '{}' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_assessments_slug` ON `assessments` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_assessments_status` ON `assessments` (`status`);
--> statement-breakpoint
CREATE TABLE `questions` (
  `id` text PRIMARY KEY NOT NULL,
  `assessment_id` text NOT NULL,
  `position` integer NOT NULL,
  `type` text NOT NULL,
  `prompt` text NOT NULL,
  `options_json` text DEFAULT '[]' NOT NULL,
  `answers_json` text DEFAULT '[]' NOT NULL,
  `solution` text DEFAULT '' NOT NULL,
  `marks` real NOT NULL,
  `negative_marks` real DEFAULT 0 NOT NULL,
  `answer_keywords_json` text DEFAULT '[]' NOT NULL,
  `keyword_marks` real DEFAULT 0 NOT NULL,
  `image_key` text,
  `duration_seconds` integer,
  `tag` text DEFAULT 'General' NOT NULL,
  `difficulty` text DEFAULT 'medium' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_questions_assessment_position` ON `questions` (`assessment_id`,`position`);
--> statement-breakpoint
CREATE TABLE `attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `assessment_id` text NOT NULL,
  `user_id` text NOT NULL,
  `status` text DEFAULT 'started' NOT NULL,
  `answers_json` text DEFAULT '{}' NOT NULL,
  `marked_json` text DEFAULT '[]' NOT NULL,
  `answered_count` integer DEFAULT 0 NOT NULL,
  `tab_switches` integer DEFAULT 0 NOT NULL,
  `violations_json` text DEFAULT '[]' NOT NULL,
  `score` real,
  `percentile` real,
  `rank` integer,
  `started_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `submitted_at` integer,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attempts_assessment_user` ON `attempts` (`assessment_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_attempts_assessment_status` ON `attempts` (`assessment_id`,`status`);
--> statement-breakpoint
CREATE TABLE `proctor_events` (
  `id` text PRIMARY KEY NOT NULL,
  `attempt_id` text NOT NULL,
  `event_type` text NOT NULL,
  `detail_json` text DEFAULT '{}' NOT NULL,
  `occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_proctor_events_attempt` ON `proctor_events` (`attempt_id`);
--> statement-breakpoint
CREATE TABLE `attempt_error_tags` (
  `attempt_id` text NOT NULL,
  `question_id` text NOT NULL,
  `tag` text NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`attempt_id`, `question_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attempt_error_tags_question` ON `attempt_error_tags` (`attempt_id`,`question_id`);
