import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import net from "node:net";
import path from "node:path";

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3456);
const BRIDGE_SCRIPT = path.join(process.cwd(), "scripts", "chatgpt-bridge.mjs");

function portOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    const done = (ok: boolean) => { s.destroy(); resolve(ok); };
    s.setTimeout(1200, () => done(false));
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
  });
}

async function bridgeHealth(): Promise<{ pageOpen: boolean; composerReady: boolean } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/ready`);
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return { pageOpen: !!d.pageOpen, composerReady: !!d.composerReady };
  } catch {
    return null;
  }
}

export async function GET() {
  const up = await portOpen(BRIDGE_PORT);
  const health = up ? await bridgeHealth() : null;
  return Response.json({ port: BRIDGE_PORT, up, health });
}

export async function POST(req: NextRequest) {
  // force=1: always (re)spawn the bridge process. default: only spawn if port is down.
  const body = await req.json().catch(() => ({}));
  const force = body.force === true;

  const alreadyUp = await portOpen(BRIDGE_PORT);
  if (alreadyUp && !force) {
    return Response.json({ started: false, reason: "already-running", port: BRIDGE_PORT });
  }

  // Kill any stale bridge node process bound to the port before respawning.
  if (alreadyUp && force) {
    try {
      await new Promise<void>((resolve) => {
        execFile("powershell.exe", [
          "-NoProfile", "-Command",
          `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'chatgpt-bridge' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
        ], () => resolve());
      });
    } catch {}
    await new Promise((r) => setTimeout(r, 1200));
  }

  try {
    const child = execFile(
      "node",
      [BRIDGE_SCRIPT],
      { cwd: process.cwd(), detached: true, windowsHide: true, stdio: "ignore" } as never,
    );
    if (child.pid) child.unref();
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    return Response.json({ started: false, error: e instanceof Error ? e.message : String(e) });
  }

  return Response.json({ started: true, port: BRIDGE_PORT });
}