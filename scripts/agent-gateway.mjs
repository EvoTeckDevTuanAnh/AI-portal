import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = Number(process.env.AGENT_GATEWAY_PORT || 3777);
const WORKSPACE = path.resolve(process.env.AGENT_WORKSPACE || process.cwd());
const queue = [];
let busy = false;

const providers = {
  opencode: { label: "OpenCode", command: process.env.AGENT_OPENCODE_BIN || "opencode", args: (prompt) => ["run", prompt] },
  kilo: { label: "Kilo", command: process.env.AGENT_KILO_BIN || "kilo", args: (prompt) => ["run", "--auto", prompt] },
  freebuff: { label: "Freebuff", command: process.env.AGENT_FREEBUFF_BIN || "freebuff", args: (prompt) => ["run", prompt] },
};

function json(res, status, value) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); }

function runPowerShell(command, env, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoLogo", "-NonInteractive", "-Command", command], { cwd: WORKSPACE, windowsHide: true, env: { ...process.env, ...env } });
    let output = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("gateway command timeout")); }, timeoutMs);
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => { clearTimeout(timer); resolve({ code, output: output.trim() }); });
  });
}

async function checkProvider(provider) {
  try {
    const result = await runPowerShell("if (Test-Path $PROFILE) { . $PROFILE }; & $env:AGENT_COMMAND --version", { AGENT_COMMAND: provider.command });
    return { name: provider.label, key: Object.entries(providers).find(([, value]) => value === provider)?.[0], available: result.code === 0, detail: result.output.slice(-500) };
  } catch (error) { return { name: provider.label, available: false, detail: error instanceof Error ? error.message : String(error) }; }
}

async function health() {
  const statuses = await Promise.all(Object.values(providers).map(checkProvider));
  return { ok: true, workspace: WORKSPACE, providers: statuses };
}

async function execute(providerKey, prompt) {
  const provider = providers[providerKey];
  if (!provider) throw new Error(`unknown provider: ${providerKey}`);
  const started = Date.now();
  const command = "if (Test-Path $PROFILE) { . $PROFILE }; $args = @($env:AGENT_ARGS_JSON | ConvertFrom-Json); & $env:AGENT_COMMAND @args | Out-String";
  const args = provider.args(prompt);
  const result = await runPowerShell(command, { AGENT_COMMAND: provider.command, AGENT_ARGS_JSON: JSON.stringify(args) }, 10 * 60 * 1000);
  return { provider: provider.label, ok: result.code === 0, output: result.output, error: result.code === 0 ? undefined : result.output, duration_ms: Date.now() - started, workspace: WORKSPACE };
}

async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const job = queue.shift();
  try { json(job.res, 200, await execute(job.provider, job.prompt)); }
  catch (error) { json(job.res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }); }
  finally { busy = false; void pump(); }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === "GET" && url.pathname === "/health") return health().then((value) => json(res, 200, value));
  if (req.method !== "POST" || url.pathname !== "/execute") return json(res, 404, { ok: false, error: "not found" });
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    try {
      const value = JSON.parse(body || "{}");
      if (typeof value.prompt !== "string" || !value.prompt.trim()) return json(res, 400, { ok: false, error: "prompt is required" });
      const provider = value.provider || "opencode";
      if (!providers[provider]) return json(res, 400, { ok: false, error: "unsupported provider" });
      queue.push({ res, provider, prompt: value.prompt.trim() });
      void pump();
    } catch { json(res, 400, { ok: false, error: "invalid JSON" }); }
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`[agent-gateway] http://127.0.0.1:${PORT} workspace=${WORKSPACE}`));
