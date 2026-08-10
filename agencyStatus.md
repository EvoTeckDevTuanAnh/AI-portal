# Agency Status

CURRENT_TASK:
Fix AI-Portal.exe launch bug — website not working.

STATUS:
DONE — root cause fixed and verified.

ROOT_CAUSE:
Stale `node server.mjs` process from a previous run kept listening on :3000 and
served 404 (its `.next` had been cleared while it ran). `scripts/start.mjs`
only killed `next dev` chains, never `node server.mjs`, so the new server died
with EADDRINUSE and the stale one served a broken 404 page.

FIX:
`scripts/start.mjs` `killStaleDevServers()` now also kills `server.mjs`
processes (still excludes `bridge.mjs`).

VERIFIED:
- `node scripts/start.mjs` kills stale server, starts bridge + web.
- GET / = 200, GET /calender = 200.
- :3000 (web) + :3456 (bridge) both listening.

BUILD/ENTRY POINTS:
- exe `AI-Portal.exe` → `cmd /c npm run start:all` → `scripts/start.mjs`
- web server: `server.mjs` (Next.js + /ws heartbeat)
- bridge: `src/modules/chatgpt/server/bridge.mjs` (Brave/chatgpt.com)
- DB: PostgreSQL docker-compose port 5433, db `ai_portal`

NOTE: `src/components/sidebar.tsx` has uncommitted human/AI edits (pre-existing,
not touched this session).
