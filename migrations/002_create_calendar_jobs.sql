-- 002_create_calendar_jobs.sql
-- Bảng lưu các job/lịch hẹn trong Calendar Job.

CREATE TABLE IF NOT EXISTS calendar_jobs (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  job_date    DATE        NOT NULL,
  start_time  TEXT,
  end_time    TEXT,
  status      TEXT        NOT NULL DEFAULT 'planned',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_jobs_job_date
  ON calendar_jobs (job_date DESC);