-- 003_add_repeat_weekdays.sql
-- Calendar jobs có thể lặp theo các thứ trong tuần.
-- repeat_weekdays = NULL => job một lần (giữ nguyên hành vi cũ).
-- repeat_weekdays = ['mon','wed'] => lặp hằng tuần vào Thứ 2 & Thứ 4.

ALTER TABLE calendar_jobs
  ADD COLUMN IF NOT EXISTS repeat_weekdays TEXT[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_jobs_repeat_weekdays
  ON calendar_jobs USING GIN (repeat_weekdays);