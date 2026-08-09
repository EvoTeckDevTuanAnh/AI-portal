-- 001_create_bridge_heartbeat.sql
-- Bảng lưu trạng thái bridge theo từng lần kiểm tra (heartbeat loop của WS server).

CREATE TABLE IF NOT EXISTS bridge_heartbeat (
  id          BIGSERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  port        INTEGER     NOT NULL,
  up          BOOLEAN     NOT NULL,
  page_open   BOOLEAN     NOT NULL DEFAULT false,
  composer_ready BOOLEAN  NOT NULL DEFAULT false,
  queued      INTEGER     NOT NULL DEFAULT 0,
  busy        BOOLEAN     NOT NULL DEFAULT false,
  headless    BOOLEAN     NOT NULL DEFAULT false,
  detail      JSONB
);

CREATE INDEX IF NOT EXISTS idx_bridge_heartbeat_recorded_at
  ON bridge_heartbeat (recorded_at DESC);