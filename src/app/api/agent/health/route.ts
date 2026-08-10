import { getProviderHealth } from "@/modules/agent/server/router";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ workspace: process.env.AGENT_WORKSPACE || process.cwd(), providers: await getProviderHealth() });
}
