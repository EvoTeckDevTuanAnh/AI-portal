import { spawn } from "node:child_process";
import type { TaskResult } from "../contracts";

export type AgentProvider = {
  name: string;
  isAvailable: () => Promise<boolean>;
  execute: (prompt: string) => Promise<TaskResult>;
};

export function createCliProvider(name: string, binary: string, workspace: string, buildArgs: (prompt: string) => string[] = (prompt) => ["run", prompt], healthArgs = ["--version"]): AgentProvider {
  const powershellQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const run = (args: string[], timeoutMs: number) => new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const useWindowsProfile = process.platform === "win32";
    const commandArgs = useWindowsProfile
      ? ["-NoLogo", "-NonInteractive", "-Command", `if (Test-Path $PROFILE) { . $PROFILE }; & $env:AGENT_BINARY ${args.map(powershellQuote).join(" ")}`]
      : args;
    const child = spawn(useWindowsProfile ? "powershell.exe" : binary, commandArgs, {
      cwd: workspace,
      windowsHide: true,
      shell: false,
      env: { ...process.env, AGENT_BINARY: binary },
    });
    let output = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${name} timeout`)); }, timeoutMs);
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => { clearTimeout(timer); resolve({ code, output: output.trim() }); });
  });

  return {
    name,
    isAvailable: async () => { try { return (await run(healthArgs, 10000)).code === 0; } catch { return false; } },
    execute: async (prompt) => {
      const started = Date.now();
      try {
        const result = await run(buildArgs(prompt), 10 * 60 * 1000);
        return { provider: name, ok: result.code === 0, output: result.output, error: result.code === 0 ? undefined : result.output, duration_ms: Date.now() - started, workspace };
      } catch (error) {
        return { provider: name, ok: false, output: "", error: error instanceof Error ? error.message : String(error), duration_ms: Date.now() - started, workspace };
      }
    },
  };
}
