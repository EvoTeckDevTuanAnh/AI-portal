CREATE TABLE IF NOT EXISTS routine_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  repeat_type TEXT NOT NULL CHECK (repeat_type IN ('daily', 'weekdays', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS routine_schedule_days (
  id BIGSERIAL PRIMARY KEY,
  routine_id BIGINT NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  UNIQUE (routine_id, weekday)
);

CREATE TABLE IF NOT EXISTS routine_steps (
  id BIGSERIAL PRIMARY KEY,
  routine_id BIGINT NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routine_runs (
  id BIGSERIAL PRIMARY KEY,
  routine_id BIGINT NOT NULL REFERENCES routine_templates(id) ON DELETE RESTRICT,
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (routine_id, run_date)
);

CREATE TABLE IF NOT EXISTS routine_step_runs (
  id BIGSERIAL PRIMARY KEY,
  routine_run_id BIGINT NOT NULL REFERENCES routine_runs(id) ON DELETE CASCADE,
  routine_step_id BIGINT NOT NULL REFERENCES routine_steps(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'missed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (routine_run_id, routine_step_id)
);

CREATE INDEX IF NOT EXISTS idx_routine_runs_date ON routine_runs (run_date);
CREATE INDEX IF NOT EXISTS idx_routine_steps_routine ON routine_steps (routine_id, sort_order);
