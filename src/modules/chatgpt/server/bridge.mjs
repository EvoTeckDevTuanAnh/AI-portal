import http from "node:http";
import { chromium } from "playwright";
import { detectBrowsers } from "./detect-browser.mjs";

const PORT = Number(process.env.BRIDGE_PORT || 3456);
const HEADLESS = process.env.BRIDGE_HEADLESS === "1";
// Keep the browser window tucked away (minimized) so it never pops up over the
// user's work. Set BRIDGE_MINIMIZED=0 to show it again.
const MINIMIZED = process.env.BRIDGE_MINIMIZED !== "0";

const LAST_ASSISTANT = '[data-message-author-role="assistant"]';

let browser;
let page;
let queue = [];
let busy = false;

function log(...a) { console.log(new Date().toISOString(), ...a); }

function pageAlive(p) {
  try {
    return !!(p && !p.isClosed());
  } catch {
    return false;
  }
}

// `browser` here is the BrowserContext returned by launchPersistentContext. It has
// no `.isClosed()`. A context whose browser process died (user closed the window)
// must be treated as dead — otherwise we keep returning a dead session forever.
function browserAlive() {
  try {
    if (!browser) return false;
    const b = typeof browser.browser === "function" ? browser.browser() : browser;
    return !!(b && typeof b.isConnected === "function" && b.isConnected());
  } catch {
    return false;
  }
}

// Hard-tear-down the whole Playwright session and drop the profile lock so a fresh
// launch can actually start a new browser process.
async function resetSession() {
  log("Reset bridge session (closing browser)");
  try {
    if (pageAlive(page)) await page.close();
  } catch {}
  try {
    if (browserAlive()) await browser.close();
  } catch {}
  if (page) page = null;
  if (browser) browser = null;
  await new Promise((r) => setTimeout(r, 1200));
}

// Launch a persistent browser context for a ChatGPT session, trying each detected
// browser in turn. If one fails (e.g. profile already in use), fall through to the
// next valid browser immediately.
async function ensureBrowser() {
  if (browserAlive()) return browser;
  // Teardown the dead session so the same userDataDir/profile is no longer locked.
  await resetSession();
  const list = detectBrowsers();
  if (list.length === 0) throw new Error("No supported browser found on this machine.");
  const preferred = (process.env.BRIDGE_BROWSER || "").toLowerCase();
  const ordered = preferred
    ? [...list.filter((b) => b.name.toLowerCase() === preferred), ...list.filter((b) => b.name.toLowerCase() !== preferred)]
    : list;
  let lastErr = "";
  for (const chosen of ordered) {
    const isChrome = chosen.name.toLowerCase() === "chrome";
    log("Launching", chosen.name, "profile:", chosen.userDataDir, "session=", chosen.hasSession);
    try {
      const ctx = await chromium.launchPersistentContext(chosen.userDataDir, {
        executablePath: chosen.exe,
        headless: HEADLESS,
        channel: isChrome ? "chrome" : undefined,
        viewport: { width: 1280, height: 900 },
        args: MINIMIZED ? ["--start-minimized"] : [],
      });
      browser = ctx;
      page = null; // never reuse a user's existing tab
      if (MINIMIZED) await minimizeWindow(ctx);
      return browser;
    } catch (e) {
      lastErr = e.message;
      log(`Launch failed for ${chosen.name}:`, (e.message || "").split("\n")[0]);
    }
  }
  throw new Error(`All browsers failed to launch. ${lastErr}`);
}

// Minimize the browser window (best-effort). Falls back to the Chromium
// --start-minimized launch flag; this CDP path re-asserts it after a page exists.
async function minimizeWindow() {
  if (!MINIMIZED) return;
  try {
    const p = page || (browser && typeof browser.pages === "function" && browser.pages()[0]);
    if (!p || typeof browser.newCDPSession !== "function") return;
    const cdp = await browser.newCDPSession(p);
    const { windowId } = await cdp.send("Browser.getWindowForTarget", {});
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
    await cdp.detach().catch(() => {});
    log("Browser window minimized");
  } catch (e) {
    log("Minimize skipped (harmless):", (e.message || "").split("\n")[0]);
  }
}

// Return the bridge's single chat tab. Opens ONE tab on first use, then reuses it
// for every subsequent chat (avoids piling up tabs / stray browser windows). Only
// re-navigates if the tab drifted away from chatgpt.com.
async function getChatPage() {
  const ctx = await ensureBrowser();
  if (pageAlive(page)) {
    try {
      const u = new URL(page.url());
      if (u.hostname.includes("chatgpt.com")) return page;
    } catch {}
    // tab at about:blank or a different host — get back to ChatGPT
    await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" }).catch(() => {});
    return page;
  }
  // no page yet — create the single chat tab
  const p = await ctx.newPage();
  p.setDefaultTimeout(3 * 60 * 1000);
  p.setDefaultNavigationTimeout(60 * 1000);
  await p.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" }).catch(() => {});
  page = p;
  await minimizeWindow();
  return p;
}

async function ensureComposer(p, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 30000);
  while (Date.now() < deadline) {
    try {
      await p.locator("#prompt-textarea").first().waitFor({ state: "attached", timeout: 5000 });
      return true;
    } catch {
      // maybe on login page — reload chat page periodically until user signs in
      try {
        const u = new URL(p.url());
        if (!u.hostname.includes("chatgpt.com")) {
          await p.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });
        }
      } catch {}
    }
  }
  return false;
}

async function setPrompt(p, prompt) {
  const el = p.locator("#prompt-textarea").first();
  await el.waitFor({ state: "attached" });
  await el.click();
  await p.evaluate((txt) => {
    const el = document.querySelector("#prompt-textarea");
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(document.createTextNode(txt));
    el.focus();
  }, prompt);
  await p.waitForTimeout(250);
  const written = await p.evaluate(() => document.querySelector("#prompt-textarea")?.textContent || "");
  if (written.trim() !== prompt) {
    await p.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await p.keyboard.type(prompt, { delay: 6 });
  }
}

async function stopBtnGone(p) {
  const c = await p.locator(
    "[id='stop-button'], [data-testid='stop-button'], [aria-label*='Stop generating'], [aria-label*='Stop streaming']"
  ).count();
  return c === 0;
}

// ChatGPT returns the answer as a scrolling list of assistant bubbles. We wait for
// N+1 bubbles (the +1 is our reply), re-reading the last one until its text stops
// changing (streaming finished).
async function waitForAnswer(p, before, onProgress) {
  const target = before + 1;
  let answer = "";
  let stable = 0;
  const deadline = Date.now() + 150 * 1000;
  let lastReport = 0;
  while (Date.now() < deadline) {
    const count = await p.locator(LAST_ASSISTANT).count();
    if (count >= target) {
      const text = (await p.locator(LAST_ASSISTANT).nth(count - 1).innerText().catch(() => "")) || "";
      if (text.trim()) {
        if (text === answer) stable += 1;
        else { answer = text; stable = 0; }
        // report growing answer every ~1s so the UI shows the reply appearing
        const now = Date.now();
        if (now - lastReport > 1000) {
          lastReport = now;
          onProgress?.("typing", answer);
        }
      }
    }
    const stopGone = await stopBtnGone(p);
    if (answer.trim() && stopGone && stable >= 2) return answer;
    await p.waitForTimeout(400);
  }
  return answer.trim() ? answer : "";
}

async function chat(prompt, onProgress) {
  let lastErr = "";
  // One retry with a full browser relaunch covers the case where the browser window
  // was closed (and reopened by the user) while the bridge still held a dead session.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      onProgress?.("ready", "Đang chuẩn bị trình duyệt…");
      const p = await getChatPage();
      onProgress?.("prepare", "Đang chờ ô nhập của ChatGPT…");
      const ready = await ensureComposer(p, 120 * 1000);
      if (!ready) throw new Error("Not logged in / ChatGPT composer not found. Log in in the open browser window, then try again.");
      if (!pageAlive(p)) throw new Error("Chat tab was closed while preparing.");
      onProgress?.("sending", "Đang gửi câu hỏi…");
      const before = await p.locator(LAST_ASSISTANT).count();
      await setPrompt(p, prompt);
      await p.keyboard.press("Enter");
      onProgress?.("thinking", "ChatGPT đang trả lời…");
      const answer = await waitForAnswer(p, before, onProgress);
      if (answer) return answer;
      throw new Error("No completion received from ChatGPT in time.");
    } catch (e) {
      lastErr = e.message;
      log(`chat attempt ${attempt} failed:`, e.message);
      if (attempt === 1) {
        // Tear the dead session down so the next iteration launches a brand-new browser.
        await resetSession();
      }
    }
  }
  if (!lastErr) lastErr = "Chat failed.";
  throw new Error(lastErr);
}

function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  log(">> chat:", job.prompt);
  const onProgress = job.stream
    ? (stage, detail) => {
        try {
          job.res.write(`event: ${stage}\ndata: ${JSON.stringify(detail ?? "")}\n\n`);
        } catch {}
      }
    : undefined;
  chat(job.prompt, onProgress)
    .then((reply) => {
      log("<< done:", reply.slice(0, 50));
      if (job.stream) {
        job.res.write(`event: done\ndata: ${JSON.stringify(reply)}\n\n`);
        job.res.end();
      } else {
        job.res.writeHead(200, { "Content-Type": "application/json" });
        job.res.end(JSON.stringify({ ok: true, reply }));
      }
    })
    .catch((e) => {
      log("!! error:", e.message);
      if (job.stream) {
        job.res.write(`event: error\ndata: ${JSON.stringify(e.message)}\n\n`);
        job.res.end();
      } else {
        job.res.writeHead(500, { "Content-Type": "application/json" });
        job.res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    })
    .finally(() => { busy = false; setImmediate(pump); });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const u = new URL(req.url, "http://localhost");

  if (req.method === "GET" && (u.pathname === "/health" || u.pathname === "/ready")) {
    // /ready: report whether the ChatGPT composer (input box) is loaded yet.
    const pageOpen = pageAlive(page);
    let composerReady = false;
    if (pageOpen) {
      try {
        const c = await page.locator("#prompt-textarea").first().count();
        composerReady = c > 0;
      } catch {}
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      ok: true,
      queued: queue.length,
      busy,
      headless: HEADLESS,
      pageOpen,
      composerReady,
    }));
  }

  if (req.method === "POST" && u.pathname === "/chat") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let prompt = "";
      let stream = false;
      try {
        const parsed = JSON.parse(body || "{}");
        prompt = (parsed.prompt || "").toString();
        stream = !!parsed.stream;
      } catch {}
      if (!prompt.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "prompt is required" }));
      }
      if (stream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.write(": ok\n\n"); // keepalive comment so proxies don't buffer
      }
      queue.push({ prompt, res, stream });
      pump();
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

(async () => {
  try {
    await getChatPage(); // open the single chat tab (boots browser if needed)
  } catch (e) {
    log("Startup page open failed (will retry on first chat):", e.message);
  }
  log("Bridge ready on http://localhost:" + PORT);
  log("Login prompt: open the visible browser window, sign in to chatgpt.com (once), then send prompts from the portal.");
  server.listen(PORT);
})().catch((e) => {
  log("FATAL startup:", e.message);
  process.exit(1);
});