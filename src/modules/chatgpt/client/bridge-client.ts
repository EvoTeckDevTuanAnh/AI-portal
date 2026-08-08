"use client";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

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
// if the port dies mid-flight.
export async function askChatGPT(
  prompt: string,
  onStatus?: (status: string) => void,
): Promise<string> {
  let tries = 0;
  while (tries < 6) {
    tries += 1;
    onStatus?.(tries === 1 ? "Đang chuẩn bị ChatGPT…" : `Bridge được khởi động lại, chuẩn bị gửi lại… (${tries})`);
    await bridgeEnsure(onStatus);

    try {
      const ctrl = new AbortController();
      const idle = setTimeout(() => ctrl.abort(), 200000);
      let res: Response | null = null;
      try {
        res = await fetch(`${BRIDGE_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(idle);
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) return (data.reply as string) ?? "";
      const err = (data.error as string) || `Bridge error ${res.status}`;
      // Business error (not logged in) — report immediately, no point retrying.
      if (res.status >= 400 && res.status < 500 && res.status !== 408) throw new Error(err);
    } catch {
      onStatus?.("Cổng bridge bị ngắt giữa chừng, đang mở lại trình duyệt…");
      // Force-restart the bridge via the web server, then loop back and re-send.
      await fetch(`/api/bridge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw new Error("Could not complete the chat after retries. Check that ChatGPT is open and logged in.");
}