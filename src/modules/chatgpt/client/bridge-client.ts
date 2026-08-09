"use client";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

export type ChatProgressStage =
  | "ready"
  | "prepare"
  | "sending"
  | "thinking"
  | "typing";

export type BridgeState = {
  port: number;
  up: boolean;
  health?: { pageOpen?: boolean; composerReady?: boolean } | null;
};

export const BRIDGE_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_CHATGPT_BRIDGE_URL
    ? process.env.NEXT_PUBLIC_CHATGPT_BRIDGE_URL
    : "http://localhost:3456";

// Ensure the bridge browser + ChatGPT composer are ready before sending a prompt.
// Fast path: if the browser is already stable (port up + composer loaded), return
// immediately and run the send flow. Slow path: if it's NOT ready, start/open a
// browser, wait for the composer — and if it still isn't ready within a few seconds,
// force-restart the bridge (kills the dead session so a fresh browser is launched).
export async function bridgeEnsure(onStatus?: (s: string) => void): Promise<BridgeState> {
  const alreadyStable = await fetch(`/api/bridge`).then((r) => r.json()).catch(() => null) as BridgeState | null;
  if (alreadyStable && alreadyStable.up && alreadyStable.health?.composerReady) {
    return alreadyStable; // browser ok + ChatGPT ready → go straight to the send flow
  }

  // Not ready → only now start/open a fresh browser session.
  onStatus?.("ChatGPT chưa sẵn sàng, đang mở trình duyệt khởi tạo phiên mới…");
  await fetch(`/api/bridge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: false }) }).catch(() => {});

  const startup = 60; // wait up to ~60s for the browser + composer after launch
  for (let i = 1; i <= startup; i++) {
    onStatus?.(`Đang khởi động ChatGPT, chờ ô nhập… (${i}/${startup})`);
    const st = await fetch(`/api/bridge`).then((r) => r.json()).catch(() => null) as BridgeState | null;
    if (st && st.up && st.health?.composerReady) return st;
    // Force-restart the bridge after a few wasted polls: the fresh spawned process
    // opens a brand-new browser window.
    if (i >= 8) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Still not ready (stale session where the browser was closed) → kill + spawn the
  // whole bridge; its startup routine opens ChatGPT in a new browser automatically.
  onStatus?.("Trình duyệt đã đóng, đang khởi động lại phiên…");
  await fetch(`/api/bridge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));

  for (let i = 1; i <= startup; i++) {
    onStatus?.(`Đang mở lại trình duyệt ChatGPT, chờ ô nhập… (${i}/${startup})`);
    const st = await fetch(`/api/bridge`).then((r) => r.json()).catch(() => null) as BridgeState | null;
    if (st && st.up && st.health?.composerReady) return st;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Bridge not ready: ChatGPT web did not load its input box in time.");
}

// Bridge /chat itself warms up the composer, sends the prompt, waits for the reply.
// This function guarantees the bridge is running + input ready, then sends — retries
// if the port dies mid-flight. When `onProgress` is given we request the SSE stream
// (`{ prompt, stream: true }`) so the UI sees live status + the reply appearing
// as it types, instead of a hard-to-guess 3-minute wait with no feedback.
export async function askChatGPT(
  prompt: string,
  onStatus?: (status: string) => void,
  onProgress?: (stage: ChatProgressStage, detail?: string) => void,
): Promise<string> {
  let tries = 0;
  while (tries < 6) {
    tries += 1;
    onStatus?.(tries === 1 ? "Đang chuẩn bị ChatGPT…" : `Bridge được khởi động lại, chuẩn bị gửi lại… (${tries})`);
    await bridgeEnsure(onStatus);

    try {
      const stream = typeof onProgress === "function";
      const ctrl = new AbortController();
      // REALTIME: with SSE the client stream keeps the request alive while the
      // browser is active, so this is only a hard ceiling for a totally frozen bridge.
      let idle: ReturnType<typeof setTimeout> | undefined;
      const armIdle = (ms: number) => {
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => ctrl.abort(), ms);
      };
      armIdle(60000);
      let res: Response | null = null;
      try {
        res = await fetch(`${BRIDGE_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stream ? { prompt, stream: true } : { prompt }),
          signal: ctrl.signal,
        });
      } finally {
        if (idle) clearTimeout(idle);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = (data.error as string) || `Bridge error ${res.status}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 408) throw new Error(err);
      }

      if (stream && res) {
        // SSE: incoming events → progress / done. Also refresh the abort window on
        // every event so a long but alive generation is never killed.
        let done = "";
        let errText = "";
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Bridge did not open a stream.");
        const decoder = new TextDecoder();
        let buf = "";
        let eventName = "message";
        while (true) {
          const { done: end, value } = await reader.read();
          if (end) break;
          clearTimeout(idle);
          armIdle(120000);
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            if (t.startsWith(":")) continue; // keepalive comment
            if (t.startsWith("event:")) { eventName = t.slice(6).trim(); continue; }
            if (t.startsWith("data:")) {
              const payload = t.slice(5).trim();
              if (eventName === "done") done = payload;
              else if (eventName === "error") errText = payload;
              else if (eventName === "typing") onProgress?.("typing", payload);
              else if (eventName === "prepare") onStatus?.("Đang chờ ô nhập của ChatGPT…");
              else if (eventName === "sending") onStatus?.("Đang gửi câu hỏi…");
              else if (eventName === "thinking") onStatus?.("ChatGPT đang trả lời…");
              else if (eventName === "ready") onStatus?.("Đã chuẩn bị xong, chờ trả lời…");
              else if (eventName !== "message") onProgress?.(eventName as ChatProgressStage, payload);
              eventName = "message";
            }
          }
          if (done) break;
          if (errText) throw new Error(errText.replace(/^"|"$/g, ""));
        }
        if (done) return JSON.parse(done);
        if (!done && !errText) throw new Error("Bridge stream ended without a reply.");
      } else if (res) {
        const data = await res.json().catch(() => ({}));
        if (res.ok) return (data.reply as string) ?? "";
        const err = (data.error as string) || `Bridge error ${res.status}`;
        throw new Error(err);
      }
    } catch {
      onStatus?.("Cổng bridge bị ngắt giữa chừng, đang mở lại trình duyệt…");
      // If the bridge is still processing (busy) do NOT force-restart it — that would
      // kill a long-running generation mid-stream. Only restart when it's truly gone.
      await forceRestartBridgeIfDead(onStatus);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw new Error("Could not complete the chat after retries. Check that ChatGPT is open and logged in.");
}

async function forceRestartBridgeIfDead(onStatus?: (s: string) => void) {
  const st = await fetch(`/api/bridge`).then((r) => r.json()).catch(() => null) as BridgeState | null;
  if (st && st.up && st.health?.composerReady) {
    // alive and ready → transient error, keep the session; don't kill the browser.
  } else {
    onStatus?.("Đang khởi động lại phiên ChatGPT…");
    await fetch(`/api/bridge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) }).catch(() => {});
  }
}