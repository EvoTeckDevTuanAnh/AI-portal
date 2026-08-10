"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import type { CalendarJob } from "@/lib/calendar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()];
}

const STATUSES = ["planned", "done", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_COLORS: Record<Status, string> = {
  planned: "bg-accent/10 text-accent",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

type ModalState = {
  mode: "create" | "edit";
  date: string; // YYYY-MM-DD
  job?: CalendarJob;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function fmtTime(t: string | null) {
  if (!t) return "";
  const [h, min] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${min} ${ampm}`;
}

function todayStr() {
  const n = new Date();
  return toDateStr(n.getFullYear(), n.getMonth(), n.getDate());
}

export default function CalendarPage() {
  const today = todayStr();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [jobs, setJobs] = useState<CalendarJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);

  const monthParam = `${year}-${pad(month + 1)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar?month=${monthParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setJobs((await res.json()) as CalendarJob[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu lịch.");
    } finally {
      setLoading(false);
    }
  }, [monthParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: number[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push(daysInPrev - i);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const total = cells.length;
  const padEnd = (7 - (total % 7)) % 7;
  for (let i = 1; i <= padEnd; i++) cells.push(i);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, CalendarJob[]>();
    const recurring: CalendarJob[] = [];
    for (const j of jobs) {
      if (j.repeat_weekdays?.length) {
        recurring.push(j);
        continue;
      }
      const arr = map.get(j.job_date) ?? [];
      arr.push(j);
      map.set(j.job_date, arr);
    }
    return { map, recurring };
  }, [jobs]);

  /** Jobs shown on a specific grid cell (direct + recurring matches). */
  const cellJobs = useCallback(
    (dateKey: string) => {
      const direct = jobsByDate.map.get(dateKey) ?? [];
      const fromRecurring = jobsByDate.recurring.filter(
        (j) =>
          j.job_date <= dateKey && j.repeat_weekdays?.includes(weekdayOf(dateKey)),
      );
      return [...direct, ...fromRecurring].sort((a, b) =>
        (a.start_time ?? "").localeCompare(b.start_time ?? ""),
      );
    },
    [jobsByDate],
  );

  const upcoming = useMemo(
    () =>
      jobs
        .filter((j) => j.status !== "cancelled")
        .filter((j) => j.repeat_weekdays?.length || j.job_date >= today)
        .sort((a, b) => {
          const aKey = (a.repeat_weekdays?.length ? "0000-00-00" : a.job_date).localeCompare(
            b.repeat_weekdays?.length ? "0000-00-00" : b.job_date,
          );
          if (aKey !== 0) return aKey;
          return (a.start_time ?? "").localeCompare(b.start_time ?? "");
        }),
    [jobs, today],
  );

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const monthJobs = useMemo(
    () =>
      jobs.filter((j) => j.status !== "cancelled" && j.job_date >= today).length,
    [jobs, today],
  );

  const save = async (payload: Record<string, unknown>, id?: number) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(id ? `/api/calendar/${id}` : `/api/calendar`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d.error as string) ?? "Lưu thất bại");
      }
      await load();
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d.error as string) ?? "Xóa thất bại");
      }
      await load();
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xóa thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const isToday = (d: number) =>
    toDateStr(year, month, d) === today;
  const isPrevTail = (d: number, idx: number) => idx < firstDay;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-card px-6">
          <div>
            <h1 className="text-lg font-semibold text-ink">Calendar Job</h1>
            <p className="text-xs text-ink-faint">Plan and track scheduled jobs</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setYear(now.getFullYear());
                setMonth(now.getMonth());
              }}
              className="rounded-md border border-line bg-card px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-gray-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: "create", date: today })}
              className="rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-card transition-opacity hover:opacity-90"
            >
              + New Job
            </button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shift(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-gray-50 hover:text-ink"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shift(1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-gray-50 hover:text-ink"
            >
              ›
            </button>
            <span className="ml-1 w-44 text-right text-[15px] font-semibold text-ink">
              {MONTHS[month]} {year}
            </span>
          </div>
        </header>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-1 gap-6 p-6">
          {/* Grid */}
          <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-line bg-card p-4">
            <div className="grid grid-cols-7 gap-px border-b border-line pb-2">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-px">
              {cells.map((d, idx) => {
                const leading = isPrevTail(d, idx);
                const dateKey = leading
                  ? `${year}-${month}-prev-${d}`
                  : toDateStr(year, month, d);
                const jobsHere = leading ? [] : cellJobs(dateKey);
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() =>
                      !leading && setModal({ mode: "create", date: dateKey })
                    }
                    className={`flex min-h-[72px] flex-col items-stretch gap-1 border-b border-line p-1.5 text-left transition-colors ${
                      leading
                        ? "bg-surface/60 text-ink-faint"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-[12px] font-medium ${
                        isToday(d)
                          ? "bg-ink text-card"
                          : "text-ink"
                      }`}
                    >
                      {d}
                    </span>
                    {jobsHere.slice(0, 3).map((j) => (
                      <span
                        key={j.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ mode: "edit", date: dateKey, job: j });
                        }}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[j.status as Status] ?? "bg-gray-100 text-gray-500"}`}
                        title={`${j.title}${j.start_time ? ` (${j.start_time})` : ""}${j.repeat_weekdays?.length ? " — weekly" : ""}`}
                      >
                        {j.repeat_weekdays?.length ? "↻ " : ""}
                        {j.start_time ? `${fmtTime(j.start_time)} ` : ""}
                        {j.title}
                      </span>
                    ))}
                    {jobsHere.length > 3 && (
                      <span className="px-1.5 text-[10px] text-ink-faint">
                        +{jobsHere.length - 3} more
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {loading && (
              <div className="flex items-center justify-center py-4 text-[13px] text-ink-faint">
                Đang tải lịch…
              </div>
            )}
          </div>

          {/* Side details */}
          <aside className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
            <div className="rounded-xl border border-line bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">Upcoming jobs</h2>
              {upcoming.length === 0 ? (
                <p className="text-xs text-ink-faint">No upcoming jobs.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcoming.slice(0, 8).map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() =>
                        setModal({ mode: "edit", date: j.job_date, job: j })
                      }
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <p className="truncate text-[13px] font-medium text-ink">
                        {j.repeat_weekdays?.length ? "↻ " : ""}{j.title}
                      </p>
                      <p className="text-[11px] text-ink-faint">
                        {j.repeat_weekdays?.length
                          ? WEEKDAY_KEYS.filter((k) => j.repeat_weekdays?.includes(k))
                              .map((k) => WEEKDAYS[WEEKDAY_KEYS.indexOf(k)])
                              .join(", ")
                          : `${MONTHS[month]} ${Number(j.job_date.slice(8, 10))}`}
                        {j.start_time ? `, ${fmtTime(j.start_time)}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-line bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink">Total jobs</h2>
              <p className="text-3xl font-semibold text-ink">{monthJobs}</p>
              <p className="text-xs text-ink-faint">this month</p>
            </div>
          </aside>
        </div>
      </main>

      {/* Modal */}
      {modal && (
        <JobModal
          modal={modal}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function JobModal({
  modal,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  modal: ModalState;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(modal.job?.title ?? "");
  const [description, setDescription] = useState(modal.job?.description ?? "");
  const [date, setDate] = useState(modal.date);
  const [startTime, setStartTime] = useState(modal.job?.start_time ?? "");
  const [endTime, setEndTime] = useState(modal.job?.end_time ?? "");
  const [status, setStatus] = useState<Status>(
    (modal.job?.status as Status) ?? "planned",
  );
  const [repeatWeekdays, setRepeatWeekdays] = useState<string[]>(
    modal.job?.repeat_weekdays ?? [],
  );

  const toggleWeekday = (k: string) =>
    setRepeatWeekdays((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );

  const disabled = saving || !title.trim();

  const submit = () => {
    if (disabled) return;
    const days = repeatWeekdays.length ? repeatWeekdays.sort() : null;
    void onSave(
      {
        title: title.trim(),
        description: description.trim(),
        job_date: date,
        start_time: startTime || null,
        end_time: endTime || null,
        status,
        repeat_weekdays: days,
      },
      modal.job?.id,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={saving ? undefined : onClose}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border border-line bg-card p-5 text-ink shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {modal.mode === "create" ? "New Job" : "Edit Job"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-gray-100 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-muted">Title *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deploy AI Portal"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-ink-muted">Date *</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-ink-muted">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-ink-muted">Start time</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-ink-muted">End time</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
              />
            </label>
          </div>

          {/* Weekly repeat */}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-muted">
              Repeat weekly
            </span>
            <div className="flex gap-1.5">
              {WEEKDAY_KEYS.map((k, i) => {
                const active = repeatWeekdays.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleWeekday(k)}
                    className={`flex h-9 w-9 flex-1 items-center justify-center rounded-lg border text-[12px] font-medium transition-colors ${
                      active
                        ? "border-ink bg-ink text-card"
                        : "border-line bg-surface text-ink-muted hover:bg-gray-50 hover:text-ink"
                    }`}
                  >
                    {WEEKDAY_SHORT[i]}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-ink-faint">
              {repeatWeekdays.length
                ? `Lặp hằng tuần vào: ${WEEKDAY_KEYS.filter((k) => repeatWeekdays.includes(k))
                    .map((k) => WEEKDAYS[WEEKDAY_KEYS.indexOf(k)])
                    .join(", ")}`
                : "Không lặp — job chạy 1 lần vào ngày đã chọn."}
            </span>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-muted">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
              className="resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {modal.mode === "edit" && modal.job ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void onDelete(modal.job!.id)}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-line px-4 py-1.5 text-[13px] font-medium text-ink hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={disabled}
              className="rounded-md bg-ink px-4 py-1.5 text-[13px] font-medium text-card transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : modal.mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}