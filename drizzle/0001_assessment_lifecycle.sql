ALTER TABLE `assessments` ADD COLUMN `registration_starts_at` integer;
--> statement-breakpoint
ALTER TABLE `assessments` ADD COLUMN `registration_ends_at` integer;
--> statement-breakpoint
ALTER TABLE `assessments` ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `assessments` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `assessments` ADD COLUMN `paper_version` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `assessments` ADD COLUMN `question_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `assessments` ADD COLUMN `total_marks` real NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `assessments` ADD COLUMN `published_at` integer;
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `section_id` text;
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `passage` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `topic` text NOT NULL DEFAULT 'General';
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `subtopic` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `source` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `accepted_variants_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `tita_tolerance` real;
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `is_active` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `created_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `assessment_sections` (
  `id` text PRIMARY KEY NOT NULL, `assessment_id` text NOT NULL, `name` text NOT NULL, `position` integer NOT NULL,
  `duration_seconds` integer, `instructions` text DEFAULT '' NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sections_assessment_position` ON `assessment_sections` (`assessment_id`,`position`);
--> statement-breakpoint
CREATE TABLE `registrations` (
  `id` text PRIMARY KEY NOT NULL, `assessment_id` text NOT NULL, `user_id` text NOT NULL, `email` text NOT NULL, `name` text,
  `college` text, `graduation_year` integer, `branch` text, `status` text DEFAULT 'registered' NOT NULL,
  `registered_at` integer NOT NULL, `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_registrations_assessment_user` ON `registrations` (`assessment_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_registrations_assessment_status` ON `registrations` (`assessment_id`,`status`);
--> statement-breakpoint
CREATE TABLE `assessment_versions` (
  `id` text PRIMARY KEY NOT NULL, `assessment_id` text NOT NULL, `version` integer NOT NULL, `kind` text NOT NULL,
  `snapshot_json` text NOT NULL, `created_by` text NOT NULL, `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_versions_assessment_version` ON `assessment_versions` (`assessment_id`,`version`);
--> statement-breakpoint
CREATE TABLE `question_versions` (
  `id` text PRIMARY KEY NOT NULL, `assessment_id` text NOT NULL, `paper_version` integer NOT NULL, `question_id` text NOT NULL,
  `position` integer NOT NULL, `payload_json` text NOT NULL, `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_question_versions_paper_position` ON `question_versions` (`assessment_id`,`paper_version`,`position`);
--> statement-breakpoint
CREATE TABLE `organizer_audit_log` (
  `id` text PRIMARY KEY NOT NULL, `assessment_id` text, `actor_email` text NOT NULL, `action` text NOT NULL,
  `detail_json` text DEFAULT '{}' NOT NULL, `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_assessment_created` ON `organizer_audit_log` (`assessment_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `question_imports` (
  `id` text PRIMARY KEY NOT NULL, `assessment_id` text NOT NULL, `source_filename` text NOT NULL, `status` text NOT NULL,
  `expected_rows` integer NOT NULL, `staged_rows` integer DEFAULT 0 NOT NULL, `error_json` text DEFAULT '[]' NOT NULL,
  `image_manifest_json` text DEFAULT '[]' NOT NULL, `uploaded_images_json` text DEFAULT '[]' NOT NULL,
  `created_by` text NOT NULL, `created_at` integer NOT NULL, `committed_at` integer
);
--> statement-breakpoint
CREATE TABLE `question_import_rows` (
  `import_id` text NOT NULL, `position` integer NOT NULL, `prompt_fingerprint` text NOT NULL, `type` text NOT NULL,
  `prompt` text NOT NULL, `passage` text DEFAULT '' NOT NULL, `options_json` text DEFAULT '[]' NOT NULL,
  `answers_json` text DEFAULT '[]' NOT NULL, `solution` text DEFAULT '' NOT NULL, `marks` real NOT NULL,
  `negative_marks` real DEFAULT 0 NOT NULL, `answer_keywords_json` text DEFAULT '[]' NOT NULL, `keyword_marks` real DEFAULT 0 NOT NULL,
  `image_name` text, `duration_seconds` integer, `section_name` text DEFAULT 'General' NOT NULL, `topic` text DEFAULT 'General' NOT NULL,
  `subtopic` text DEFAULT '' NOT NULL, `difficulty` text DEFAULT 'medium' NOT NULL, `source` text DEFAULT '' NOT NULL,
  `accepted_variants_json` text DEFAULT '[]' NOT NULL, `tita_tolerance` real,
  PRIMARY KEY (`import_id`,`position`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_rows_fingerprint` ON `question_import_rows` (`import_id`,`prompt_fingerprint`);
