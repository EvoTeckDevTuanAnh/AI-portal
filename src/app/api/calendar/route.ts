import { NextRequest } from "next/server";
import { createJob, listJobs } from "@/lib/calendar";

/** GET /api/calendar?month=YYYY-MM — list jobs (optionally for one month). */
export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month");
    return Response.json(await listJobs(month));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "DB error" },
      { status: 500 },
    );
  }
}

/** POST /api/calendar — create a job. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const job = await createJob(body);
    return Response.json(job, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return Response.json({ error: msg }, { status: msg === "title is required" || msg.startsWith("job_date") ? 400 : 500 });
  }
}