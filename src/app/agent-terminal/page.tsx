"use client";

import { useEffect, useState } from "react";

type Provider = { name: string; available: boolean };

export default function AgentTerminalPage() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("Agent Terminal ready.\n");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [running, setRunning] = useState(false);

  const checkHealth = async () => {
    const response = await fetch("/api/agent/health").catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    setProviders(data.providers || []);
    setOutput((current) => `${current}\n[health] workspace: ${data.workspace}\n${(data.providers || []).map((p: Provider) => `[${p.available ? "up" : "down"}] ${p.name}`).join("\n")}\n`);
  };

  useEffect(() => { void checkHealth(); }, []);

  const execute = async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setOutput((current) => `${current}\n> ${prompt}\n`);
    try {
      const response = await fetch("/api/agent/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, auto_execute: true }) });
      const data = await response.json();
      setOutput((current) => `${current}${JSON.stringify(data, null, 2)}\n`);
    } catch (error) {
      setOutput((current) => `${current}${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      setRunning(false);
      setPrompt("");
      void checkHealth();
    }
  };

  return (
    <main className="min-h-screen bg-[#101114] p-6 text-[#e5e7eb]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col rounded-xl border border-[#30343b] bg-[#17191e] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#30343b] px-5 py-3">
          <div><h1 className="font-semibold">AI Portal Agent Terminal</h1><p className="text-xs text-[#9ca3af]">Workspace: C:\dự án\code\AI-portal</p></div>
          <button type="button" onClick={() => void checkHealth()} className="rounded border border-[#454b55] px-3 py-1.5 text-xs hover:bg-[#242832]">Check health</button>
        </header>
        <div className="flex gap-2 border-b border-[#30343b] px-5 py-2 text-xs">
          {providers.map((provider) => <span key={provider.name} className={provider.available ? "text-emerald-400" : "text-amber-400"}>{provider.available ? "●" : "○"} {provider.name}</span>)}
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-5 font-mono text-sm leading-6">{output}</pre>
        <form onSubmit={(event) => { event.preventDefault(); void execute(); }} className="flex gap-3 border-t border-[#30343b] p-4">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Gửi yêu cầu cho coding agent..." className="min-w-0 flex-1 rounded border border-[#454b55] bg-[#101114] px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <button type="submit" disabled={running || !prompt.trim()} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{running ? "Running..." : "Run"}</button>
        </form>
      </div>
    </main>
  );
}
