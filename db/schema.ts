import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  provider: text('provider').notNull(),
  role: text('role', { enum: ['candidate', 'organizer'] }).notNull().default('candidate'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('idx_users_email').on(table.email)]);

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['draft', 'registration_open', 'registration_closed', 'scheduled', 'live', 'ended', 'results_processing', 'results_ready', 'results_released', 'archived'] }).notNull().default('draft'),
  durationSeconds: integer('duration_seconds').notNull(),
  registrationStartsAt: integer('registration_starts_at', { mode: 'timestamp' }),
  registrationEndsAt: integer('registration_ends_at', { mode: 'timestamp' }),
  startsAt: integer('starts_at', { mode: 'timestamp' }),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  settingsJson: text('settings_json').notNull().default('{}'),
  version: integer('version').notNull().default(1),
  paperVersion: integer('paper_version').notNull().default(0),
  questionCount: integer('question_count').notNull().default(0),
  totalMarks: real('total_marks').notNull().default(0),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('idx_assessments_slug').on(table.slug), index('idx_assessments_status').on(table.status)]);

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull(),
  position: integer('position').notNull(),
  type: text('type', { enum: ['mcq', 'multi', 'tita', 'subjective', 'comprehension'] }).notNull(),
  prompt: text('prompt').notNull(),
  sectionId: text('section_id'),
  passage: text('passage').notNull().default(''),
  optionsJson: text('options_json').notNull().default('[]'),
  answersJson: text('answers_json').notNull().default('[]'),
  solution: text('solution').notNull().default(''),
  marks: real('marks').notNull(),
  negativeMarks: real('negative_marks').notNull().default(0),
  answerKeywordsJson: text('answer_keywords_json').notNull().default('[]'),
  keywordMarks: real('keyword_marks').notNull().default(0),
  imageKey: text('image_key'),
  durationSeconds: integer('duration_seconds'),
  tag: text('tag').notNull().default('General'),
  topic: text('topic').notNull().default('General'),
  subtopic: text('subtopic').notNull().default(''),
  source: text('source').notNull().default(''),
  acceptedVariantsJson: text('accepted_variants_json').notNull().default('[]'),
  titaTolerance: real('tita_tolerance'),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull().default('medium'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_questions_assessment_position').on(table.assessmentId, table.position)]);

export const assessmentSections = sqliteTable('assessment_sections', {
  id: text('id').primaryKey(), assessmentId: text('assessment_id').notNull(), name: text('name').notNull(),
  position: integer('position').notNull(), durationSeconds: integer('duration_seconds'), instructions: text('instructions').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_sections_assessment_position').on(table.assessmentId, table.position)]);

export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(), assessmentId: text('assessment_id').notNull(), userId: text('user_id').notNull(),
  email: text('email').notNull(), name: text('name'), college: text('college'), graduationYear: integer('graduation_year'), branch: text('branch'),
  status: text('status').notNull().default('registered'), consentAt: integer('consent_at', { mode: 'timestamp' }), profileJson: text('profile_json').notNull().default('{}'), blockedReason: text('blocked_reason'), registeredAt: integer('registered_at', { mode: 'timestamp' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('idx_registrations_assessment_user').on(table.assessmentId, table.userId), index('idx_registrations_assessment_status').on(table.assessmentId, table.status)]);

export const assessmentVersions = sqliteTable('assessment_versions', {
  id: text('id').primaryKey(), assessmentId: text('assessment_id').notNull(), version: integer('version').notNull(), kind: text('kind').notNull(),
  snapshotJson: text('snapshot_json').notNull(), createdBy: text('created_by').notNull(), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_versions_assessment_version').on(table.assessmentId, table.version)]);

export const questionVersions = sqliteTable('question_versions', {
  id: text('id').primaryKey(), assessmentId: text('assessment_id').notNull(), paperVersion: integer('paper_version').notNull(),
  questionId: text('question_id').notNull(), position: integer('position').notNull(), payloadJson: text('payload_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('idx_question_versions_paper_position').on(table.assessmentId, table.paperVersion, table.position)]);

export const organizerAuditLog = sqliteTable('organizer_audit_log', {
  id: text('id').primaryKey(), assessmentId: text('assessment_id'), actorEmail: text('actor_email').notNull(), action: text('action').notNull(),
  detailJson: text('detail_json').notNull().default('{}'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_audit_assessment_created').on(table.assessmentId, table.createdAt)]);

export const questionImports = sqliteTable('question_imports', {
  id: text('id').primaryKey(), assessmentId: text('assessment_id').notNull(), sourceFilename: text('source_filename').notNull(), status: text('status').notNull(),
  expectedRows: integer('expected_rows').notNull(), stagedRows: integer('staged_rows').notNull().default(0), errorJson: text('error_json').notNull().default('[]'),
  imageManifestJson: text('image_manifest_json').notNull().default('[]'), uploadedImagesJson: text('uploaded_images_json').notNull().default('[]'),
  createdBy: text('created_by').notNull(), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(), committedAt: integer('committed_at', { mode: 'timestamp' }),
});

export const questionImportRows = sqliteTable('question_import_rows', {
  importId: text('import_id').notNull(), position: integer('position').notNull(), promptFingerprint: text('prompt_fingerprint').notNull(), type: text('type').notNull(),
  prompt: text('prompt').notNull(), passage: text('passage').notNull().default(''), optionsJson: text('options_json').notNull().default('[]'), answersJson: text('answers_json').notNull().default('[]'),
  solution: text('solution').notNull().default(''), marks: real('marks').notNull(), negativeMarks: real('negative_marks').notNull().default(0),
  answerKeywordsJson: text('answer_keywords_json').notNull().default('[]'), keywordMarks: real('keyword_marks').notNull().default(0), imageName: text('image_name'),
  durationSeconds: integer('duration_seconds'), sectionName: text('section_name').notNull().default('General'), topic: text('topic').notNull().default('General'),
  subtopic: text('subtopic').notNull().default(''), difficulty: text('difficulty').notNull().default('medium'), source: text('source').notNull().default(''),
  acceptedVariantsJson: text('accepted_variants_json').notNull().default('[]'), titaTolerance: real('tita_tolerance'),
}, (table) => [uniqueIndex('idx_import_rows_position').on(table.importId, table.position), uniqueIndex('idx_import_rows_fingerprint').on(table.importId, table.promptFingerprint)]);

export const attempts = sqliteTable('attempts', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull(),
  userId: text('user_id').notNull(),
  status: text('status', { enum: ['started', 'submitted', 'expired', 'evaluated'] }).notNull().default('started'),
  answersJson: text('answers_json').notNull().default('{}'),
  markedJson: text('marked_json').notNull().default('[]'),
  answeredCount: integer('answered_count').notNull().default(0),
  tabSwitches: integer('tab_switches').notNull().default(0),
  violationsJson: text('violations_json').notNull().default('[]'),
  paperVersion: integer('paper_version').notNull().default(0), shuffleSeed: text('shuffle_seed').notNull().default(''), questionOrderJson: text('question_order_json').notNull().default('[]'),
  answerVersion: integer('answer_version').notNull().default(0), lastCheckpointAt: integer('last_checkpoint_at', { mode: 'timestamp' }), resultJson: text('result_json').notNull().default('{}'), timeSpentJson: text('time_spent_json').notNull().default('{}'),
  score: real('score'),
  maxScore: real('max_score'), correctCount: integer('correct_count'), incorrectCount: integer('incorrect_count'), unattemptedCount: integer('unattempted_count'),
  percentile: real('percentile'),
  rank: integer('rank'),
  excludedAt: integer('excluded_at', { mode: 'timestamp' }), excludedReason: text('excluded_reason'), evaluationVersion: integer('evaluation_version').notNull().default(1),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  scoredAt: integer('scored_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('idx_attempts_assessment_user').on(table.assessmentId, table.userId),
  index('idx_attempts_assessment_status').on(table.assessmentId, table.status),
  index('idx_attempts_assessment_score').on(table.assessmentId, table.score),
  index('idx_attempts_assessment_rank').on(table.assessmentId, table.rank),
]);

export const questionMetrics = sqliteTable('question_metrics', {
  assessmentId:text('assessment_id').notNull(), questionId:text('question_id').notNull(), attemptsCount:integer('attempts_count').notNull().default(0),
  correctCount:integer('correct_count').notNull().default(0), incorrectCount:integer('incorrect_count').notNull().default(0), skippedCount:integer('skipped_count').notNull().default(0),
  averageAwarded:real('average_awarded').notNull().default(0), averageTimeSeconds:real('average_time_seconds').notNull().default(0), updatedAt:integer('updated_at',{mode:'timestamp'}).notNull(),
}, (table)=>[uniqueIndex('idx_question_metrics_assessment_question').on(table.assessmentId,table.questionId)]);

export const resultRuns = sqliteTable('result_runs', {
  id:text('id').primaryKey(), assessmentId:text('assessment_id').notNull(), eligibleAttempts:integer('eligible_attempts').notNull(), excludedAttempts:integer('excluded_attempts').notNull(),
  highestScore:real('highest_score').notNull().default(0), averageScore:real('average_score').notNull().default(0), summaryJson:text('summary_json').notNull().default('{}'), createdBy:text('created_by').notNull(), createdAt:integer('created_at',{mode:'timestamp'}).notNull(),
}, (table)=>[index('idx_result_runs_assessment_created').on(table.assessmentId,table.createdAt)]);

export const resultJobs = sqliteTable('result_jobs', {
  id:text('id').primaryKey(), assessmentId:text('assessment_id').notNull(), status:text('status').notNull().default('pending'),
  phase:text('phase').notNull().default('rank'), cursor:integer('cursor').notNull().default(0), totalQuestions:integer('total_questions').notNull().default(0),
  createdBy:text('created_by').notNull(), errorText:text('error_text'), createdAt:integer('created_at',{mode:'timestamp'}).notNull(),
  updatedAt:integer('updated_at',{mode:'timestamp'}).notNull(), completedAt:integer('completed_at',{mode:'timestamp'}),
}, (table)=>[index('idx_result_jobs_assessment_created').on(table.assessmentId,table.createdAt),index('idx_result_jobs_status').on(table.status)]);

export const proctorEvents = sqliteTable('proctor_events', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull(),
  eventType: text('event_type').notNull(),
  detailJson: text('detail_json').notNull().default('{}'),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_proctor_events_attempt').on(table.attemptId)]);

export const attemptErrorTags = sqliteTable('attempt_error_tags', {
  attemptId: text('attempt_id').notNull(),
  questionId: text('question_id').notNull(),
  tag: text('tag').notNull(),
  note: text('note').notNull().default(''),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('idx_attempt_error_tags_question').on(table.attemptId, table.questionId)]);
