export const ROUTINE_STATUSES = ["pending", "in_progress", "completed", "skipped"] as const;
export const STEP_STATUSES = ["pending", "in_progress", "completed", "skipped", "missed"] as const;
export type RoutineStatus = (typeof ROUTINE_STATUSES)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];

export type RoutineStepInput = {
  title: string;
  description?: string | null;
  start_time: string;
  duration_minutes?: number | null;
};

export type RoutineInput = {
  name: string;
  description?: string;
  repeat_type: "daily" | "weekdays" | "custom";
  weekdays?: number[];
  start_date: string;
  end_date?: string | null;
  timezone?: string;
  steps: RoutineStepInput[];
};

export function validateRoutine(input: RoutineInput): void {
  if (!input || typeof input.name !== "string" || !input.name.trim()) throw new Error("name is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) throw new Error("start_date must be YYYY-MM-DD");
  if (input.end_date && (!/^\d{4}-\d{2}-\d{2}$/.test(input.end_date) || input.end_date < input.start_date)) throw new Error("end_date is invalid");
  if (!Array.isArray(input.steps) || input.steps.length === 0) throw new Error("at least one step is required");
  if (input.repeat_type === "custom" && (!input.weekdays?.length || input.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new Error("custom weekdays are required");
  for (const step of input.steps) {
    if (!step || typeof step.title !== "string" || !step.title.trim()) throw new Error("step title is required");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(step.start_time)) throw new Error("step start_time is invalid");
    if (step.duration_minutes != null && (!Number.isInteger(step.duration_minutes) || step.duration_minutes <= 0)) throw new Error("duration_minutes is invalid");
  }
}

export function appliesOnDate(repeatType: RoutineInput["repeat_type"], weekdays: number[], date: string): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (repeatType === "daily") return true;
  if (repeatType === "weekdays") return day >= 1 && day <= 5;
  return weekdays.includes(day);
}

export function nextStep(statuses: StepStatus[], times: string[]): number | null {
  const current = statuses.findIndex((status) => status === "in_progress");
  if (current >= 0) return current;
  let candidate: number | null = null;
  statuses.forEach((status, index) => {
    if (status === "pending" && (candidate === null || times[index] < times[candidate])) candidate = index;
  });
  return candidate;
}

export function overlaps(start: string, durationMinutes: number | null, jobStart: string | null, jobEnd: string | null): boolean {
  if (!durationMinutes || !jobStart || !jobEnd) return false;
  const toMinutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
  const routineStart = toMinutes(start);
  return routineStart < toMinutes(jobEnd) && routineStart + durationMinutes > toMinutes(jobStart);
}
