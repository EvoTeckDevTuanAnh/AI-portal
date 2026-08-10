// Single-instance AI-Portal launcher for Windows and local development.
import net from "node:net";
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3456);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);
const LOCK_PATH = path.join(root, ".ai-portal.start.lock");

function log(...args) { console.log(new Date().toISOString(), ...args); }

function isListening(port, host = "127.0.0.1", timeout = 1200) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(timeout, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

async function waitForReady(port, tries, label) {
  for (let i = 0; i < tries; i += 1) {
    if (await isListening(port)) {
      log(`${label} ready on :${port}`);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}

function acquireLauncherLock() {
  try {
    const fd = fs.openSync(LOCK_PATH, "wx");
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      const record = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
      process.kill(Number(record.pid), 0);
      log(`Already running (launcher pid ${record.pid}); duplicate start ignored.`);
      return false;
    } catch {
      try { fs.rmSync(LOCK_PATH, { force: true }); } catch {}
      return acquireLauncherLock();
    }
  }
}

function releaseLauncherLock() {
  try {
    const record = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    if (Number(record.pid) === process.pid) fs.rmSync(LOCK_PATH, { force: true });
  } catch {}
}

function clearNextCache() {
  const nextDir = path.join(root, ".next");
  if (!fs.existsSync(nextDir)) return;
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
    log("Cleared .next cache");
  } catch (error) {
    log("WARN: could not clear .next:", error.message);
  }
}

(async () => {
  if (!acquireLauncherLock()) return;
  process.on("exit", releaseLauncherLock);

  const webAlreadyUp = await isListening(WEB_PORT);
  if (!webAlreadyUp) clearNextCache();

  if (await isListening(BRIDGE_PORT)) {
    log(`Bridge already running on :${BRIDGE_PORT}; reusing it.`);
  } else {
    log(`Starting bridge on :${BRIDGE_PORT}...`);
    const bridge = spawn(process.execPath, [path.join(root, "src", "modules", "chatgpt", "server", "bridge.mjs")], {
      cwd: root, stdio: "inherit", windowsHide: true,
    });
    bridge.once("error", (error) => {
      log("FATAL bridge start:", error.message);
      releaseLauncherLock();
      process.exit(1);
    });
    bridge.once("exit", (code) => {
      if (code !== 0) {
        log(`bridge exited with code ${code}`);
        releaseLauncherLock();
        process.exit(code || 1);
      }
    });
  }

  let webReady = false;
  const web = webAlreadyUp ? null : spawn(process.execPath, [path.join(root, "server.mjs")], {
    cwd: root, stdio: "inherit", windowsHide: true,
  });
  if (web) {
    web.once("error", (error) => {
      log("FATAL web start:", error.message);
      releaseLauncherLock();
      process.exit(1);
    });
    web.on("exit", (code) => {
      log(`server.mjs exited with code ${code}`);
      if (!webReady) log("FATAL: web app exited before becoming ready.");
      releaseLauncherLock();
      process.exit(code || 1);
    });
  } else {
    log(`Web app already running on :${WEB_PORT}; reusing it.`);
  }

  const gotWeb = await waitForReady(WEB_PORT, 60, "Web app");
  webReady = gotWeb;
  const gotBridge = await waitForReady(BRIDGE_PORT, 120, "Bridge");
  if (!gotWeb) log("WARN: web app did not become reachable in time.");
  if (!gotBridge) log("WARN: bridge did not become reachable in time.");

  if (process.env.OPEN_BROWSER !== "0") {
    const browser = spawn("cmd.exe", ["/c", "start", "", `http://localhost:${WEB_PORT}`], {
      cwd: root, windowsHide: true, shell: false,
    });
    browser.once("error", (error) => log("WARN: could not open browser:", error.message));
  }

  const shutdown = () => {
    try { web?.kill(); } catch {}
    releaseLauncherLock();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((error) => {
  log("FATAL start:", error.message);
  releaseLauncherLock();
  process.exit(1);
});
