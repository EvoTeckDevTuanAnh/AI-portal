import { NextRequest } from "next/server";
import { deleteJob, getJobById, parseId, updateJob } from "@/lib/calendar";

type Params = { params: Promise<{ id: string }> };

/** GET /api/calendar/[id] — fetch one job. */
export async function GET(_req: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (id == null) return Response.json({ error: "invalid id" }, { status: 400 });
  try {
    const job = await getJobById(id);
    if (!job) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(job);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "DB error" },
      { status: 500 },
    );
  }
}

/** PUT /api/calendar/[id] — update a job. */
export async function PUT(req: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (id == null) return Response.json({ error: "invalid id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  try {
    const job = await updateJob(id, body);
    if (!job) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(job);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "DB error" },
      { status: 500 },
    );
  }
}

/** DELETE /api/calendar/[id] — remove a job. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (id == null) return Response.json({ error: "invalid id" }, { status: 400 });
  try {
    const ok = await deleteJob(id);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "DB error" },
      { status: 500 },
    );
  }
}