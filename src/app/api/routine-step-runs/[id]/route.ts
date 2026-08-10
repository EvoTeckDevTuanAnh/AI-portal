import { updateStepRun } from "@/lib/routines";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "invalid id" }, { status: 400 });
  try { const result = await updateStepRun(id, body.status, body.note); return result ? Response.json(result) : Response.json({ error: "not found" }, { status: 404 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "invalid request" }, { status: 400 }); }
}
