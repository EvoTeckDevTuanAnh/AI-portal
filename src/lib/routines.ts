import { db } from "@/lib/db";
import { validateRoutine, type RoutineInput, type RoutineStatus, type StepStatus } from "@/lib/routine-domain";

export type Routine = { id: number; name: string; description: string; repeat_type: RoutineInput["repeat_type"]; weekdays: number[]; start_date: string; end_date: string | null; timezone: string; is_active: boolean; steps: RoutineStep[] };
export type RoutineStep = { id: number; title: string; description: string | null; start_time: string; duration_minutes: number | null; sort_order: number };
export type DailyRoutine = Routine & { run: { id: number; run_date: string; status: RoutineStatus }; step_runs: Array<RoutineStep & { run_id: number; status: StepStatus; started_at: string | null; completed_at: string | null; note: string | null }> };
type RoutineRow = { id: number; name: string; description: string; repeat_type: RoutineInput["repeat_type"]; weekdays: number[]; start_date: string | Date; end_date: string | Date | null; timezone: string; is_active: boolean };
type RoutineStepRow = RoutineStep & { routine_id: number };
type StepRunRow = RoutineStep & { run_id: number; status: StepStatus; started_at: string | null; completed_at: string | null; note: string | null };

function dateValue(value: unknown): string { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }

function mapRoutine(row: RoutineRow, steps: RoutineStep[]): Routine {
  return { id: Number(row.id), name: row.name, description: row.description, repeat_type: row.repeat_type, weekdays: (row.weekdays ?? []).map(Number), start_date: dateValue(row.start_date), end_date: row.end_date ? dateValue(row.end_date) : null, timezone: row.timezone, is_active: row.is_active, steps };
}

export async function listRoutines(): Promise<Routine[]> {
  const result = await db.query<RoutineRow>(`SELECT t.*, COALESCE(array_agg(DISTINCT d.weekday) FILTER (WHERE d.weekday IS NOT NULL), '{}') AS weekdays FROM routine_templates t LEFT JOIN routine_schedule_days d ON d.routine_id = t.id GROUP BY t.id ORDER BY t.is_active DESC, t.name`);
  const steps = await db.query<RoutineStepRow>(`SELECT id, routine_id, title, description, start_time, duration_minutes, sort_order FROM routine_steps ORDER BY routine_id, sort_order, id`);
  return result.rows.map((row) => mapRoutine(row, steps.rows.filter((step) => Number(step.routine_id) === Number(row.id))));
}

export async function createRoutine(input: RoutineInput): Promise<Routine> {
  validateRoutine(input);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(`INSERT INTO routine_templates (name, description, repeat_type, start_date, end_date, timezone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [input.name.trim(), input.description?.trim() ?? "", input.repeat_type, input.start_date, input.end_date || null, input.timezone || "Asia/Ho_Chi_Minh"]);
    const routineId = Number(created.rows[0].id);
    const weekdays = input.repeat_type === "weekdays" ? [1, 2, 3, 4, 5] : input.weekdays ?? [];
    for (const day of weekdays) await client.query(`INSERT INTO routine_schedule_days (routine_id, weekday) VALUES ($1, $2)`, [routineId, day]);
    for (const [index, step] of input.steps.entries()) await client.query(`INSERT INTO routine_steps (routine_id, title, description, start_time, duration_minutes, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`, [routineId, step.title.trim(), step.description?.trim() || null, step.start_time, step.duration_minutes ?? null, index]);
    await client.query("COMMIT");
    return (await listRoutines()).find((routine) => routine.id === routineId)!;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function getDailyRoutine(date: string): Promise<DailyRoutine[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const templates = await client.query(`SELECT t.*, COALESCE(array_agg(DISTINCT d.weekday) FILTER (WHERE d.weekday IS NOT NULL), '{}') AS weekdays FROM routine_templates t LEFT JOIN routine_schedule_days d ON d.routine_id = t.id WHERE t.is_active AND t.start_date <= $1::date AND (t.end_date IS NULL OR t.end_date >= $1::date) GROUP BY t.id`, [date]);
    const output: DailyRoutine[] = [];
    for (const row of templates.rows) {
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const days = (row.weekdays ?? []).map(Number);
      if (row.repeat_type === "weekdays" && (weekday < 1 || weekday > 5)) continue;
      if (row.repeat_type === "custom" && !days.includes(weekday)) continue;
      const steps = await client.query<RoutineStep>(`SELECT id, title, description, start_time, duration_minutes, sort_order FROM routine_steps WHERE routine_id = $1 ORDER BY sort_order, id`, [row.id]);
      const run = await client.query(`INSERT INTO routine_runs (routine_id, run_date) VALUES ($1, $2) ON CONFLICT (routine_id, run_date) DO UPDATE SET updated_at = now() RETURNING *`, [row.id, date]);
      for (const step of steps.rows) await client.query(`INSERT INTO routine_step_runs (routine_run_id, routine_step_id) VALUES ($1, $2) ON CONFLICT (routine_run_id, routine_step_id) DO NOTHING`, [run.rows[0].id, step.id]);
      const stepRuns = await client.query<StepRunRow>(`SELECT sr.id AS run_id, sr.status, sr.started_at, sr.completed_at, sr.note, s.* FROM routine_step_runs sr JOIN routine_steps s ON s.id = sr.routine_step_id WHERE sr.routine_run_id = $1 ORDER BY s.sort_order, s.id`, [run.rows[0].id]);
      output.push({ ...mapRoutine(row, steps.rows), run: { id: Number(run.rows[0].id), run_date: date, status: run.rows[0].status }, step_runs: stepRuns.rows.map((step) => ({ ...step, id: Number(step.id), run_id: Number(step.run_id), duration_minutes: step.duration_minutes == null ? null : Number(step.duration_minutes) })) });
    }
    await client.query("COMMIT");
    return output;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function updateStepRun(id: number, status: StepStatus, note?: string | null) {
  if (!["pending", "in_progress", "completed", "skipped", "missed"].includes(status)) throw new Error("invalid step status");
  const result = await db.query(`UPDATE routine_step_runs SET status = $1, note = $2, started_at = CASE WHEN $1 = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END, completed_at = CASE WHEN $1 = 'completed' THEN COALESCE(completed_at, now()) WHEN $1 <> 'completed' THEN NULL ELSE completed_at END, updated_at = now() WHERE id = $3 RETURNING *`, [status, note ?? null, id]);
  if (!result.rowCount) return null;
  await db.query(`UPDATE routine_runs r SET status = CASE WHEN x.remaining = 0 THEN 'completed' WHEN x.started > 0 OR x.completed > 0 THEN 'in_progress' ELSE 'pending' END, completed_at = CASE WHEN x.remaining = 0 THEN COALESCE(r.completed_at, now()) ELSE NULL END, updated_at = now() FROM (SELECT routine_run_id, COUNT(*) FILTER (WHERE status NOT IN ('completed', 'skipped')) AS remaining, COUNT(*) FILTER (WHERE status = 'in_progress') AS started, COUNT(*) FILTER (WHERE status = 'completed') AS completed FROM routine_step_runs GROUP BY routine_run_id) x WHERE r.id = x.routine_run_id AND r.id = $1`, [result.rows[0].routine_run_id]);
  return result.rows[0];
}
