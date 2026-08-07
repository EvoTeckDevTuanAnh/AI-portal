import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const TMP = path.join(os.tmpdir(), "opencode-cookie-scan");
fs.mkdirSync(TMP, { recursive: true });

const CANDIDATES = [
  {
    name: "Brave",
    exe: "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
    base: "BraveSoftware\\Brave-Browser\\User Data",
  },
  {
    name: "Edge",
    exe: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    base: "Microsoft\\Edge\\User Data",
  },
  {
    name: "Chrome",
    exe: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    base: "Google\\Chrome\\User Data",
  },
];

const SESSION_COOKIE = "__Secure-next-auth.session-token";

// Copy a running-browser Cookies DB (with WAL) to a temp path we can read, then check session.
function browserHasSession(userDataDir) {
  const src = path.join(userDataDir, "Default", "Network", "Cookies");
  if (!fs.existsSync(src)) return false;
  const copy = path.join(TMP, `scan-${path.basename(userDataDir)}.db`);
  try {
    fs.copyFileSync(src, copy);
    for (const ext of ["-wal", "-shm"]) {
      const f = src + ext;
      if (fs.existsSync(f)) {
        try { fs.copyFileSync(f, copy + ext); } catch {}
      }
    }
  } catch {
    return false;
  }
  try {
    const db = new DatabaseSync(copy, { readOnly: true });
    const rows = db.prepare(`SELECT name FROM cookies WHERE name LIKE '%session-token%'`).all();
    db.close();
    return rows.some((r) => r.name.startsWith(SESSION_COOKIE));
  } catch {
    return false;
  }
}

// Returns { name, exe, userDataDir, hasSession } for each installed browser.
export function detectBrowsers() {
  return CANDIDATES.filter((c) => {
    if (!fs.existsSync(c.exe)) return false;
    const baseDir = path.join(LOCAL, c.base);
    return (
      fs.existsSync(baseDir) &&
      fs.existsSync(path.join(baseDir, "Default", "Network", "Cookies"))
    );
  }).map((c) => {
    const userDataDir = path.join(LOCAL, c.base);
    return { ...c, userDataDir, hasSession: browserHasSession(userDataDir) };
  });
}