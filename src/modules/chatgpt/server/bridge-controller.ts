import { execFile } from "node:child_process";
import net from "node:net";
import path from "node:path";

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3456);
const BRIDGE_SCRIPT = path.join(
  process.cwd(),
  "src",
  "modules",
  "chatgpt",
  "server",
  "bridge.mjs",
);

export type BridgeHealth = { pageOpen: boolean; composerReady: boolean } | null;

export type BridgeState = {
  port: number;
  up: boolean;
  health?: BridgeHealth;
};

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

async function bridgeHealth(): Promise<BridgeHealth> {
  try {
    const res = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/ready`);
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return { pageOpen: !!d.pageOpen, composerReady: !!d.composerReady };
  } catch {
    return null;
  }
}

export async function getBridgeState(): Promise<BridgeState> {
  const up = await portOpen(BRIDGE_PORT);
  return { port: BRIDGE_PORT, up, health: up ? await bridgeHealth() : undefined };
}

export async function startBridge(force: boolean): Promise<{ started: boolean; reason?: string; port: number }> {
  const alreadyUp = await portOpen(BRIDGE_PORT);
  if (alreadyUp && !force) {
    return { started: false, reason: "already-running", port: BRIDGE_PORT };
  }

  // Kill any stale bridge node process bound to the port before respawning.
  if (alreadyUp && force) {
    try {
      await new Promise<void>((resolve) => {
        execFile("powershell.exe", [
          "-NoProfile", "-Command",
          `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'bridge.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
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
    return { started: false, port: BRIDGE_PORT, reason: e instanceof Error ? e.message : String(e) };
  }

  return { started: true, port: BRIDGE_PORT };
}