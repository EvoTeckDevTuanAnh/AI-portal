"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import type { DailyRoutine } from "@/lib/routines";

const dateNow = () => new Date().toISOString().slice(0, 10);

export default function DailyRoutinePage() {
  const [date, setDate] = useState(dateNow);
  const [data, setData] = useState<DailyRoutine[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch(`/api/routines/daily?date=${date}`); if (!response.ok) throw new Error(`HTTP ${response.status}`); setData(await response.json()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load routines"); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);
  const steps = useMemo(() => data.flatMap((routine) => routine.step_runs), [data]);
  const update = async (id: number, status: string) => { const response = await fetch(`/api/routine-step-runs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); if (!response.ok) { setError("Could not update task"); return; } await load(); };
  return <div className="flex h-screen w-screen overflow-hidden bg-surface"><Sidebar /><main className="min-w-0 flex-1 overflow-y-auto"><header className="flex h-16 items-center justify-between border-b border-line bg-card px-6"><div><h1 className="text-lg font-semibold text-ink">Daily Routine</h1><p className="text-xs text-ink-faint">Plan your recurring daily schedule</p></div><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" /></header><div className="mx-auto max-w-3xl space-y-5 p-6"><section className="rounded-xl border border-line bg-card p-5"><p className="text-sm font-semibold text-ink">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`))}</p><p className="mt-1 text-xs text-ink-faint">{steps.filter((step) => step.status === "completed" || step.status === "skipped").length} / {steps.length} completed</p></section>{error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{loading ? <p className="rounded-xl border border-line bg-card p-8 text-center text-sm text-ink-faint">Loading...</p> : data.length === 0 ? <section className="rounded-xl border border-line bg-card p-8 text-center"><p className="text-sm font-semibold text-ink">No daily routine yet.</p><p className="mt-1 text-xs text-ink-faint">Create a routine through POST /api/routines.</p></section> : data.map((routine) => <section key={routine.id} className="rounded-xl border border-line bg-card p-5"><div className="mb-4"><h2 className="text-sm font-semibold text-ink">{routine.name}</h2><p className="text-xs text-ink-faint">{routine.description}</p></div><div className="space-y-2">{routine.step_runs.map((step) => <div key={step.run_id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"><span className="w-12 text-xs text-ink-faint">{step.start_time}</span><span className="flex-1 text-sm text-ink">{step.title}</span><span className="text-xs text-ink-faint">{step.status}</span>{step.status !== "completed" && step.status !== "skipped" && <button type="button" onClick={() => void update(step.run_id, "completed")} className="rounded-md border border-line px-2 py-1 text-xs text-ink">Mark Done</button>}</div>)}</div></section>)}</div></main></div>;
}
