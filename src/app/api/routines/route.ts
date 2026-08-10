import { createRoutine, listRoutines } from "@/lib/routines";

export async function GET() { try { return Response.json(await listRoutines()); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "DB error" }, { status: 500 }); } }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try { return Response.json(await createRoutine(body), { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "invalid routine"; return Response.json({ error: message }, { status: message.includes("required") || message.includes("invalid") ? 400 : 500 }); }
}
