import { NextRequest } from "next/server";
import { getBridgeState, startBridge } from "@/modules/chatgpt/server/bridge-controller";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getBridgeState());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const force = body.force === true;
  return Response.json(await startBridge(force));
}
