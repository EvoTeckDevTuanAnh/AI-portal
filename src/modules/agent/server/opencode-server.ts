import type { AgentProvider } from "./provider";
import type { TaskResult } from "../contracts";

const workspace = process.env.AGENT_WORKSPACE || process.cwd();
const baseUrl = process.env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096";

async function request(path: string, init?: RequestInit) {
  const signal = AbortSignal.timeout(2500);
  return fetch(`${baseUrl}${path}`, { ...init, signal, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
}

export function createOpenCodeServerProvider(): AgentProvider {
  return {
    name: "OpenCode Server",
    isAvailable: async () => {
      try { const response = await request("/global/health"); return response.ok && (await response.json()).healthy === true; } catch { return false; }
    },
    execute: async (prompt): Promise<TaskResult> => {
      const started = Date.now();
      try {
        const sessionResponse = await request("/session", { method: "POST", body: JSON.stringify({ title: "AI Portal task" }) });
        if (!sessionResponse.ok) throw new Error(`OpenCode session failed (${sessionResponse.status})`);
        const session = await sessionResponse.json() as { id: string };
        const response = await request(`/session/${session.id}/message`, { method: "POST", body: JSON.stringify({ parts: [{ type: "text", text: `${prompt}\n\nWorkspace: ${workspace}` }] }) });
        const body = await response.text();
        if (!response.ok) throw new Error(`OpenCode message failed (${response.status}): ${body}`);
        return { provider: "OpenCode Server", ok: true, output: body, duration_ms: Date.now() - started, workspace };
      } catch (error) {
        return { provider: "OpenCode Server", ok: false, output: "", error: error instanceof Error ? error.message : String(error), duration_ms: Date.now() - started, workspace };
      }
    },
  };
}
