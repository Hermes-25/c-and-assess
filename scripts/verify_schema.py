import os
import pathlib
import sqlite3
import tempfile

database_path = pathlib.Path(tempfile.gettempdir()) / "c-and-assess-schema-test.db"
database_path.unlink(missing_ok=True)
connection = sqlite3.connect(database_path)
for migration in ("drizzle/0000_initial.sql", "drizzle/0001_assessment_lifecycle.sql", "drizzle/0002_candidate_engine.sql", "drizzle/0003_result_analytics.sql", "drizzle/0004_result_jobs.sql"):
    sql = pathlib.Path(migration).read_text(encoding="utf-8").replace("--> statement-breakpoint", "")
    connection.executescript(sql)

tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
required_tables = {
    "assessments", "assessment_sections", "registrations", "assessment_versions",
    "organizer_audit_log", "question_imports", "question_import_rows", "question_versions", "questions", "attempts", "proctor_events", "question_metrics", "result_runs", "result_jobs",
}
assert required_tables <= tables, required_tables - tables
assessment_columns = {row[1] for row in connection.execute("PRAGMA table_info(assessments)")}
assert {"paper_version", "question_count", "total_marks", "registration_ends_at"} <= assessment_columns
attempt_columns = {row[1] for row in connection.execute("PRAGMA table_info(attempts)")}
assert {"paper_version", "answer_version", "result_json", "max_score", "scored_at", "time_spent_json", "excluded_at", "evaluation_version"} <= attempt_columns
attempt_sql = """INSERT INTO attempts (id,assessment_id,user_id,status,result_json,score,max_score,correct_count,incorrect_count,unattempted_count,started_at,expires_at,submitted_at,updated_at) VALUES (?,?,?,'submitted',?,?,?,?,?,?,100,500,?,500)"""
detail = '{"q-1":{"status":"correct","awarded":3,"timeSeconds":40}}'
connection.execute(attempt_sql, ("a-1", "assessment-1", "u-1", detail, 10, 12, 3, 1, 0, 200))
connection.execute(attempt_sql, ("a-2", "assessment-1", "u-2", detail, 5, 12, 2, 2, 0, 240))
connection.execute(attempt_sql, ("a-3", "assessment-1", "u-3", detail, 5, 12, 2, 2, 0, 220))
connection.execute("""WITH ranked AS (SELECT id,ROW_NUMBER() OVER (ORDER BY score DESC,(submitted_at-started_at) ASC,submitted_at ASC,id ASC) AS rank_value,ROUND(100.0*CUME_DIST() OVER (ORDER BY score ASC),2) AS percentile_value FROM attempts WHERE assessment_id=? AND status IN ('submitted','evaluated') AND excluded_at IS NULL AND score IS NOT NULL) UPDATE attempts SET rank=(SELECT rank_value FROM ranked WHERE ranked.id=attempts.id),percentile=(SELECT percentile_value FROM ranked WHERE ranked.id=attempts.id) WHERE assessment_id=? AND id IN (SELECT id FROM ranked)""", ("assessment-1", "assessment-1"))
ranked = list(connection.execute("SELECT id,rank,percentile FROM attempts ORDER BY rank"))
assert ranked == [("a-1", 1, 100.0), ("a-3", 2, 66.67), ("a-2", 3, 66.67)], ranked
connection.execute("""INSERT INTO question_metrics (assessment_id,question_id,attempts_count,correct_count,incorrect_count,skipped_count,average_awarded,average_time_seconds,updated_at) SELECT ?,j.key,COUNT(*),SUM(CASE WHEN json_extract(j.value,'$.status')='correct' THEN 1 ELSE 0 END),SUM(CASE WHEN json_extract(j.value,'$.status')='incorrect' THEN 1 ELSE 0 END),SUM(CASE WHEN json_extract(j.value,'$.status')='unattempted' THEN 1 ELSE 0 END),ROUND(AVG(COALESCE(json_extract(j.value,'$.awarded'),0)),3),ROUND(AVG(COALESCE(json_extract(j.value,'$.timeSeconds'),0)),2),500 FROM attempts a,json_each(a.result_json) j WHERE a.assessment_id=? GROUP BY j.key""", ("assessment-1", "assessment-1"))
assert connection.execute("SELECT attempts_count,correct_count,average_time_seconds FROM question_metrics WHERE question_id='q-1'").fetchone() == (3, 3, 40.0)
print(f"schema-and-ranking-ok {len(tables)} tables {len(assessment_columns)} assessment-columns")
connection.close()
database_path.unlink(missing_ok=True)
