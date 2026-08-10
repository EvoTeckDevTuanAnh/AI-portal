// AI-Portal custom Next.js server + WebSocket heartbeat loop.
// - Serves the Next.js app (dev or prod) exactly like `next dev`/`next start`.
// - Opens a WebSocket endpoint at /ws.
// - Every BRIDGE_INTERVAL_MS probes the ChatGPT bridge /ready, stores a row in
//   bridge_heartbeat (Postgres via DATABASE_URL) and broadcasts the status JSON
//   to every connected WS client, so the frontend knows the browser stays alive
//   (or recovers) in near-real-time.
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import pg from "pg";
import { WebSocketServer, WebSocket } from "ws";
import next from "next";
import { runWeeklyConversationCleanup } from "./scripts/cleanup-conversations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dev = process.env.NODE_ENV !== "production";
const HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const WEB_PORT = Number(process.env.WEB_PORT || 3000);
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3456);
const BRIDGE_INTERVAL_MS = Number(process.env.BRIDGE_INTERVAL_MS || 5000);
const HEARTBEAT_PATH = process.env.BRIDGE_WS_PATH || "/ws";
const DB_URL =
  process.env.DATABASE_URL ||
  "postgres://planner:planner_dev_password@127.0.0.1:5433/ai_portal";
const RETENTION_MS = process.env.HEARTBEAT_RETENTION_MS
  ? Number(process.env.HEARTBEAT_RETENTION_MS)
  : 7 * 24 * 60 * 60 * 1000;

function log(...a) { console.log(new Date().toISOString(), "[server.mjs]", ...a); }

const pool = new pg.Pool({
  connectionString: DB_URL,
  max: 5,
  connectionTimeoutMillis: 3000,
});
pool.on("error", (e) => log("pg pool error:", e.message));

function portOpen(port, host = HOST, timeout = 1500) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    const done = (ok) => { s.destroy(); resolve(ok); };
    s.setTimeout(timeout, () => done(false));
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
  });
}

/** Probe the bridge /ready endpoint. Returns a snapshot object, never throws. */
async function readBridgeStatus() {
  try {
    const res = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/ready`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { bridgeUp: false, error: `http ${res.status}` };
    const d = await res.json().catch(() => ({}));
    return {
      bridgeUp: true,
      pageOpen: !!d.pageOpen,
      composerReady: !!d.composerReady,
      busy: !!d.busy,
      queued: Number(d.queued || 0),
      headless: !!d.headless,
      detail: d,
    };
  } catch (e) {
    return { bridgeUp: false, error: e instanceof Error ? e.message : String(e) };
  }
}

let lastHeartbeat = null;
let dbOk = false;

async function persistHeartbeat(status) {
  try {
    await pool.query(
      `INSERT INTO bridge_heartbeat (port, up, page_open, composer_ready, queued, busy, headless, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        BRIDGE_PORT,
        !!status.bridgeUp,
        !!status.pageOpen,
        !!status.composerReady,
        Number(status.queued || 0),
        !!status.busy,
        !!status.headless,
        JSON.stringify(status.detail || { error: status.error || null }),
      ],
    );
    dbOk = true;
  } catch (err) {
    if (dbOk) {
      dbOk = false;
      log("DB write failed:", err.message);
    }
  }
}

async function expireHeartbeats() {
  try {
    const hours = Math.max(1, Math.floor(RETENTION_MS / 3600000));
    await pool.query("DELETE FROM bridge_heartbeat WHERE recorded_at < now() - make_interval(hours => $1)", [hours]);
  } catch (err) {
    if (dbOk) {
      dbOk = false;
      log("heartbeat retention failed:", err.message);
    }
  }
}

let tick = 0;

async function heartbeatLoop() {
  tick += 1;
  const status = await readBridgeStatus();
  lastHeartbeat = { type: "bridge-status", at: new Date().toISOString(), status };
  broadcast(JSON.stringify(lastHeartbeat));
  void persistHeartbeat(status);
  if (tick % 120 === 0) void expireHeartbeats(); // ~every 10min at 5s interval
}

// --- WebSocket ------------------------------------------------------------
const clients = new Set();

function broadcast(payload) {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch { /* noop */ }
    }
  }
}

// --- HTTP server ----------------------------------------------------------
const app = next({ dev, dir: __dirname, hostname: HOST, port: WEB_PORT });
const handle = app.getRequestHandler();

(async () => {
  await app.prepare();
  const server = http.createServer((req, res) => handle(req, res));

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, sock, head) => {
    const p = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (p.pathname !== HEARTBEAT_PATH) {
      sock.destroy();
      return;
    }
    wss.handleUpgrade(req, sock, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws) => {
    clients.add(ws);
    if (lastHeartbeat) {
      try { ws.send(JSON.stringify(lastHeartbeat)); } catch { /* noop */ }
    }
    const closed = () => clients.delete(ws);
    ws.on("close", closed);
    ws.on("error", closed);
  });

  server.listen(WEB_PORT, HOST, () => {
    log(`Next.js  http://${HOST}:${WEB_PORT}${dev ? "  [dev]" : ""}`);
    log(`WebSocket ws://${HOST}:${WEB_PORT}${HEARTBEAT_PATH}`);
  });

  void pool
    .query("SELECT 1")
    .then(() => {
      dbOk = true;
      log("Postgres connected (bridge_heartbeat table ready)");
    })
    .catch((e) => log("WARN: Postgres not reachable yet:", e.message));

  void runWeeklyConversationCleanup()
    .then((result) => log("conversation cleanup:", result))
    .catch((e) => log("WARN: conversation cleanup skipped:", e.message));
  const cleanupTimer = setInterval(() => {
    void runWeeklyConversationCleanup().catch((e) => log("WARN: conversation cleanup skipped:", e.message));
  }, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();

  const timer = setInterval(heartbeatLoop, BRIDGE_INTERVAL_MS);
  void heartbeatLoop(); // first snapshot right away

  const shutdown = async () => {
    clearInterval(timer);
    clearInterval(cleanupTimer);
    for (const ws of clients) { try { ws.close(); } catch { /* noop */ } }
    wss.close();
    await pool.end().catch(() => {});
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((e) => {
  console.error("FATAL server.mjs:", e);
  process.exit(1);
});
