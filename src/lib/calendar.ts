import { db } from "@/lib/db";

// ============================================================================
// Calendar domain — service layer.
// Chứa mô hình dữ liệu CalendarJob + toàn bộ truy vấn DB. API routes (HTTP
// adapter) chỉ gọi các hàm ở đây; UI chỉ đọc kiểu CalendarJob từ module này.
// ============================================================================

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type CalendarJob = {
  id: number;
  title: string;
  description: string;
  job_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  /** Ngày lặp trong tuần: ['mon','tue',...]. null = job một lần. */
  repeat_weekdays: string[] | null;
};

export type CalendarJobInput = {
  title: string;
  description?: string;
  job_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status?: string;
  repeat_weekdays?: string[] | null;
};

type Row = {
  id: number;
  title: string;
  description: string;
  job_date: string | Date;
  start_time: string | null;
  end_time: string | null;
  status: string;
  repeat_weekdays: string[] | null;
};

// pg returns DATE columns as a local-midnight Date; toISOString() would shift a
// day in non-UTC timezones. Format with local components instead.
export function formatDate(v: string | Date): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function toJob(r: Row): CalendarJob {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    job_date: formatDate(r.job_date),
    start_time: r.start_time,
    end_time: r.end_time,
    status: r.status,
    repeat_weekdays: r.repeat_weekdays ?? null,
  };
}

/** Validate repeat_weekdays: array of weekday keys (deduped) or null/empty. */
export function parseWeekdays(v: unknown): string[] | null {
  if (v == null) return null;
  if (!Array.isArray(v)) return null;
  const days = v.filter((x): x is string => typeof x === "string" && WEEKDAYS.includes(x as never));
  return days.length ? (Array.from(new Set(days)) as string[]) : null;
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** List jobs, optionally scoped to one month (or includes weekly-recurring). */
export async function listJobs(month?: string | null): Promise<CalendarJob[]> {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const r = await db.query<Row>(
      `SELECT id, title, description, job_date, start_time, end_time, status, repeat_weekdays
       FROM calendar_jobs
       WHERE (job_date >= $1::date AND job_date < $2::date)
          OR repeat_weekdays IS NOT NULL
       ORDER BY job_date, start_time NULLS LAST, id`,
      [start, end],
    );
    return r.rows.map(toJob);
  }
  const r = await db.query<Row>(
    `SELECT id, title, description, job_date, start_time, end_time, status, repeat_weekdays
     FROM calendar_jobs
     ORDER BY job_date DESC, start_time NULLS LAST, id`,
  );
  return r.rows.map(toJob);
}

/** Fetch one job by id; returns null when not found. */
export async function getJobById(id: number): Promise<CalendarJob | null> {
  const r = await db.query<Row>(
    `SELECT id, title, description, job_date, start_time, end_time, status, repeat_weekdays
     FROM calendar_jobs WHERE id = $1`,
    [id],
  );
  return r.rowCount === 0 ? null : toJob(r.rows[0]);
}

/** Create a job. Throws if title or job_date invalid. */
export async function createJob(input: CalendarJobInput): Promise<CalendarJob> {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw new Error("title is required");
  if (typeof input.job_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.job_date)) {
    throw new Error("job_date must be YYYY-MM-DD");
  }
  const r = await db.query<Row>(
    `INSERT INTO calendar_jobs (title, description, job_date, start_time, end_time, status, repeat_weekdays)
     VALUES ($1, $2, $3::date, $4, $5, $6, $7)
     RETURNING id, title, description, job_date, start_time, end_time, status, repeat_weekdays`,
    [
      title,
      typeof input.description === "string" ? input.description.trim() : "",
      input.job_date,
      typeof input.start_time === "string" ? input.start_time : null,
      typeof input.end_time === "string" ? input.end_time : null,
      typeof input.status === "string" ? input.status : "planned",
      parseWeekdays(input.repeat_weekdays),
    ],
  );
  return toJob(r.rows[0]);
}

/** Update a job. Returns null when id not found. */
export async function updateJob(id: number, input: CalendarJobInput): Promise<CalendarJob | null> {
  const r = await db.query<Row>(
    `UPDATE calendar_jobs
     SET title = COALESCE(NULLIF($1, ''), title),
         description = COALESCE(NULLIF($2, ''), description),
         job_date = COALESCE($3::date, job_date),
         start_time = $4,
         end_time = $5,
         status = $6,
         repeat_weekdays = $7,
         updated_at = now()
     WHERE id = $8
     RETURNING id, title, description, job_date, start_time, end_time, status, repeat_weekdays`,
    [
      typeof input.title === "string" ? input.title.trim() : "",
      typeof input.description === "string" ? input.description.trim() : "",
      typeof input.job_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.job_date)
        ? input.job_date
        : null,
      typeof input.start_time === "string" ? input.start_time : null,
      typeof input.end_time === "string" ? input.end_time : null,
      typeof input.status === "string" ? input.status : "planned",
      parseWeekdays(input.repeat_weekdays),
      id,
    ],
  );
  return r.rowCount === 0 ? null : toJob(r.rows[0]);
}

/** Delete a job. Returns true if a row was removed. */
export async function deleteJob(id: number): Promise<boolean> {
  const r = await db.query(`DELETE FROM calendar_jobs WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}