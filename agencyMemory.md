# Agency Memory

## Project Identity

PROJECT_NAME: AI Portal
PURPOSE: Personal AI portal — chat with ChatGPT via browser automation, calendar manager.
PLATFORM: Windows
LANGUAGE: Node.js / TypeScript (Next.js 15, React 19)
RUNTIME: Node + Next.js dev server, custom `server.mjs`
PRIMARY_ENTRY_POINT: `scripts/start.mjs` (launched by AI-Portal.exe via `npm run start:all`)

---

## Architecture

- `AI-Portal.exe` (C# launcher, built via `scripts/build-exe.ps1`) runs `cmd /c npm run start:all`.
- `scripts/start.mjs` = single launcher. Kills stale dev servers, clears corrupt `.next`, starts bridge + web, opens browser.
- `server.mjs` = custom Next.js server + WebSocket heartbeat at `/ws`, probes bridge `/ready`, stores `bridge_heartbeat` in Postgres.
- `src/modules/chatgpt/server/bridge.mjs` = bridge driving Brave browser profile → chatgpt.com.
- DB: PostgreSQL via docker-compose, port **5433** (local PG18 owns 5432), db `ai_portal`.

## Important Modules

### scripts/start.mjs
PURPOSE: Single launch entry point; guarantees exactly ONE bridge + ONE web server.
RESPONSIBILITIES: kill stale node procs, clear .next, spawn bridge + server.mjs, wait for ports, open browser.
DEPENDS_ON: node, wmic (for process enumeration), bridge.mjs, server.mjs, .next
IMPORTANT_BEHAVIOR: Must kill stale `server.mjs` too, not just `next dev` chains.

### server.mjs
PURPOSE: Serve Next.js app + /ws heartbeat loop.
IMPORTANT_BEHAVIOR: Binds WEB_PORT (3000); dies with EADDRINUSE if port already held.

## Known Traps

### TRAP-001
PROBLEM: Stale `node server.mjs` survives between runs and holds :3000; new server crashes EADDRINUSE; stale one serves 404 after .next cleared.
WHY_IT_HAPPENS: launcher only filtered `next dev`/`AI-portal` cmdlines; `server.mjs` cmdline has neither.
AVOID_BY: killStaleDevServers() matches `server.mjs` (excluding `bridge.mjs`).
RELATED_FILES: scripts/start.mjs

## Bugs Worth Remembering

### BUGMEM-001
SYMPTOM: exe launches, website does not work (404 / connection refused).
ROOT_CAUSE: port 3000 held by stale `server.mjs`; EADDRINUSE on new one.
FIX: scripts/start.mjs now kills stale `server.mjs`.
FILES: scripts/start.mjs

---

MEMORY_BOOTSTRAP_SOURCE: existing repository inspection
LAST_REVIEWED: 2026-08-10
LAST_UPDATED: 2026-08-10
MEMORY_VERSION: 1