// AI-Portal launcher: single entry point. Guarantees exactly ONE bridge and ONE
// web dev server. Kills stale/orphaned "next dev" instances from this project and
// clears a corrupt `.next` before starting, so two dev servers can never race on
// the same `.next` directory (the cause of 404/ENOENT asset errors).
import net from "node:net";
import fs from "node:fs";
import { spawn, execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3456);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);

const NEXT_MARKERS = ["next","dist\\bin\\next","\\next\\dev","chatgpt-bridge"];

function log(...a) { console.log(new Date().toISOString(), ...a); }

function isListening(port, host = "127.0.0.1", timeout = 1200) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    const done = (ok) => { s.destroy(); resolve(ok); };
    s.setTimeout(timeout, () => done(false));
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
  });
}

async function waitForReady(port, tries, label) {
  for (let i = 0; i < tries; i++) {
    if (await isListening(port)) {
      log(`${label} ready on :${port}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

// Kill stale net filter. Enumerate node.exe, keep the bridge, kill next-dev chains
// that belong to this project.
function listNodeProcs() {
  return new Promise((resolve, reject) => {
    execFile("wmic", ["process", "where", "Name='node.exe'", "get", "ProcessId,CommandLine", "/format:csv"],
      { windowsHide: true }, (err, stdout) => {
        if (err) return reject(err);
        const rows = [];
        for (const line of (stdout || "").split(/\r?\n/)) {
          if (!line || !line.includes(",")) continue;
          const m = line.match(/(\d+)\s*$/);
          const cmd = line.split(",").slice(1, -1).join(",");
          if (!m) continue;
          rows.push({ pid: Number(m[1]), cmd });
        }
        resolve(rows);
      });
  });
}

function killStaleDevServers() {
  return new Promise((resolve, reject) => {
    listNodeProcs().then((rows) => {
      const stale = rows.filter((r) =>
        r.cmd.includes("next") &&
        (r.cmd.includes("next dev") || r.cmd.includes("next\\dev") || r.cmd.includes("start-server.js")) &&
        r.cmd.includes("AI-portal") &&
        !r.cmd.includes("chatgpt-bridge.mjs")
      );
      if (stale.length === 0) { log("No stale dev server found."); return resolve([]); }
      for (const s of stale) {
        try { process.kill(s.pid); log(`Killed stale dev server (pid ${s.pid})`); } catch {}
      }
      setTimeout(resolve, 800, stale);
    }, () => resolve([]));
  });
}

function clearNextCache() {
  const dir = path.join(root, ".next");
  if (!fs.existsSync(dir)) { log("No .next cache to clear."); return; }
  try { fs.rmSync(dir, { recursive: true, force: true }); log("Cleared corrupt .next"); }
  catch (e) { log("WARN: could not clear .next:", e.message); }
}

(async () => {
  // 1. Never let two dev servers write the same .next.
  await killStaleDevServers();
  clearNextCache();

  // 2. Bridge (keep running instance, else start one).
  if (await isListening(BRIDGE_PORT)) {
    log(`Bridge already running on :${BRIDGE_PORT} — reusing it.`);
  } else {
    log(`Starting bridge on :${BRIDGE_PORT}...`);
    spawn("node", [path.join("scripts", "chatgpt-bridge.mjs")], { cwd: root, stdio: "inherit", windowsHide: true });
  }

  // 3. Web app — now with a free, clean .next, start exactly one dev server.
  const web = spawn("npm", ["run", "dev"], { cwd: root, stdio: "inherit", windowsHide: true, shell: true });
  web.on("exit", (code) => log(`next dev exited with code ${code}`));

  const gotWeb = await waitForReady(WEB_PORT, 60, "Web app");
  const gotBridge = await waitForReady(BRIDGE_PORT, 120, "Bridge");
  if (!gotWeb) log("WARN: web app did not become reachable in time.");
  if (!gotBridge) log("WARN: bridge did not become reachable in time (is ChatGPT logged in?).");

  if (process.env.OPEN_BROWSER !== "0") {
    try {
      spawn("cmd", ["/c", "start", `http://localhost:${WEB_PORT}`], { cwd: root, windowsHide: true, shell: false });
      log(`Opening browser at http://localhost:${WEB_PORT}`);
    } catch (e) {
      log("WARN: could not open browser:", e.message);
    }
  }

  const shutdown = () => { try { web.kill(); } catch {} };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((e) => { log("FATAL start:", e.message); process.exit(1); });