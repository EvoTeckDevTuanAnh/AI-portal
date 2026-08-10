import { runAgentTask } from "@/modules/agent/server/orchestrator";
import type { TaskRequest } from "@/modules/agent/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const task = await request.json().catch(() => null) as TaskRequest | null;
  if (!task || typeof task.prompt !== "string") return Response.json({ error: "prompt is required" }, { status: 400 });
  const result = await runAgentTask(task);
  return Response.json(result, { status: result.status === "failed" ? 503 : 200 });
}
