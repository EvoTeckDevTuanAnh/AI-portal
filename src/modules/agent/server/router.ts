import path from "node:path";
import { createCliProvider, type AgentProvider } from "./provider";
import { createOpenCodeServerProvider } from "./opencode-server";

const workspace = path.resolve(process.env.AGENT_WORKSPACE || process.cwd());

function configured(name: string, fallback: string) {
  return process.env[`AGENT_${name.toUpperCase().replace(/ /g, "_")}_BIN`] || fallback;
}

export function getProviders(): AgentProvider[] {
  const providers: AgentProvider[] = [createOpenCodeServerProvider()];
  const cliProviders = [
    ["OpenCode", configured("OpenCode", process.platform === "win32" ? "opencode.cmd" : "opencode")],
    ["Kilo", process.env.AGENT_KILO_BIN || "kilo"],
    ["Freebuff", process.env.AGENT_FREEBUFF_BIN || "freebuff"],
  ] as const;
  providers.push(...cliProviders.filter(([, binary]) => !!binary).map(([name, binary]) => {
    if (name === "Kilo") return createCliProvider(name, binary!, workspace, (prompt) => ["run", "--auto", prompt]);
    return createCliProvider(name, binary!, workspace);
  }));
  return providers;
}

export async function executeWithFallback(prompt: string) {
  for (const provider of getProviders()) {
    if (!(await provider.isAvailable())) continue;
    const result = await provider.execute(prompt);
    if (result.ok) return result;
  }
  return null;
}

export async function getProviderHealth() {
  return Promise.all(getProviders().map(async (provider) => ({ name: provider.name, available: await provider.isAvailable() })));
}
