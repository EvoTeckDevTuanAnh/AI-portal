# Agency Diary

## D-0001 — Fix exe launch bug (website not working)

- User reported "lỗi khi khởi chạy file exe website không hoạt động".
- Reproduced: `npm run start:all` hung; direct `node server.mjs` → `EADDRINUSE 127.0.0.1:3000`.
- Found stale `node server.mjs` (PID 20076) from a previous run holding :3000, serving 404 (its .next was cleared by launcher while it ran).
- `scripts/start.mjs` killStaleDevServers() only killed `next dev` chains + required "AI-portal" in cmdline; `server.mjs` cmdline matched neither.
- Fixed: filter now kills any `server.mjs` process (excluding `bridge.mjs`), or `AI-portal` + `next` chains.
- Killed stale processes (PIDs 20076, 21912, 6664), verified:
  - `node scripts/start.mjs` → killed stale, started bridge + web, both ready.
  - GET / = 200, GET /calender = 200; :3000 and :3456 listening.
- Cleaned up test node processes afterward.
- Bootstrap: created agencyRule.md, agencyStatus.md, agencyMemory.md, agencyDiary.md.
- Note: `src/components/sidebar.tsx` had pre-existing uncommitted edits (untouched).