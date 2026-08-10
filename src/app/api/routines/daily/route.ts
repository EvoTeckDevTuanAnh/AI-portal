import { getDailyRoutine } from "@/lib/routines";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);
  try { return Response.json(await getDailyRoutine(date)); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "DB error" }, { status: 400 }); }
}
