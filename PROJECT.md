# AI-Portal — Kiến trúc hệ thống

Tài liệu giúp đọc & hiểu nhanh toàn bộ dự án. Về API chi tiết xem [`api.md`](./api.md).

## Tổng quan

Desktop app quản lý **AI assistant** + **lịch công việc (Calendar Job)**.

- Nhập văn bản → gửi lên ChatGPT thật thông qua trình duyệt Brave (bridge).
- Quản lý công việc theo ngày/tháng, hỗ trợ **công việc lặp theo thứ trong tuần** (`repeat_weekdays`).

## Kiến trúc (Clean Architecture, tinh gọn)

```
stack: Next.js 14 (App Router) + TypeScript + PostgreSQL (local, port 5433) + Playwright (Brave)
```

| Tầng | Thư mục | Trách nhiệm |
|---|---|---|
| **Presentation / UI** | `src/components/`, `src/app/**/page.tsx` | Component giao diện ("use client"), state local, gọi API bằng `fetch` |
| **HTTP adapter (routes)** | `src/app/api/**/route.ts` | Mỏng — nhận HTTP request, gọi service, map lỗi → HTTP status |
| **Service (domain)** | `src/lib/calendar.ts` | Model + nghiệp vụ + truy vấn DB (không nhận biết HTTP) |
| **Infrastructure** | `src/lib/db.ts` | pg connection pool duy nhất |
| **Feature module** | `src/modules/chatgpt/` | Đóng gói riêng tính năng ChatGPT: client UI, bridge external (Playwright), controller |
| **Runtime entry** | `server.mjs`, `scripts/start.mjs` | Custom Next server + WebSocket; khởi động toàn hệ thống |
| **Data** | `migrations/*.sql` | Migrations PostgreSQL (track bằng bảng `migration_log`) |

### Cây thư mục

```
AI-portal/
├── server.mjs                     # Next server + WebSocket /ws (heartbeat Postgres)
├── next.config.ts, tsconfig.json, package.json
├── scripts/
│   ├── start.mjs                  # Entry: spawn bridge + server (double-click exe)
│   └── migrate.mjs                # Apply migrations/*.sql chưa chạy
├── migrations/                    # 001, 002, 003...
├── .env                           # API_TOKEN, PLANNER_TOKEN, các PORT...
└── src/
    ├── app/
    │   ├── page.tsx               # Trang chính: AI Chat
    │   ├── layout.tsx, globals.css
    │   ├── calendar/page.tsx      # Trang Calendar Job (job one-off + lặp theo thứ)
    │   └── api/
    │       ├── calendar/route.ts  # GET list, POST create
    │       ├── calendar/[id]/route.ts  # GET/PUT/DELETE một job
    │       └── bridge/route.ts    # GET state, POST start bridge
    ├── components/
    │   └── sidebar.tsx            # Nav trái (AI Chat, Calendar Job)
    ├── lib/
    │   ├── db.ts                  # pg Pool (infra)
    │   └── calendar.ts            # Service layer calendar (domain + DB)
    └── modules/
        └── chatgpt/
            ├── index.ts           # Barrel export
            ├── client/
            │   ├── chat-panel.tsx     # UI chat
            │   └── bridge-client.ts   # askChatGPT() / bridgeEnsure()
            └── server/
                ├── bridge-controller.ts  # Đọc state, spawn/kill bridge
                ├── bridge.mjs            # HTTP bridge :3456 điều khiển Brave + ChatGPT
                └── detect-browser.mjs    # Tìm profile Brave
```

## Luồng khởi động

```
AI-Portal.exe
  → cmd /c npm run start:all
  → scripts/start.mjs
      1. killStaleDevServers(): kill server.mjs + next dev còn sót, giữ nguyên bridge
      2. clear .next nếu corrupt
      3. spawn bridge → src/modules/chatgpt/server/bridge.mjs (port 3456)
         · mở Brave profile riêng, tới chatgpt.com
         · đợi user đăng nhập ChatGPT (1 lần)
      4. spawn server.mjs (port 3000): custom Next server + WebSocket /ws
         · kết nối Postgres, check bảng bridge_heartbeat
      5. mở trình duyệt http://localhost:3000
```

## Ports & môi trường

| Port | Vai trò |
|---|---|
| `3000` | Web app (Next.js + custom server + WS `/ws`) |
| `3456` | Bridge (Playwright ↔ Brave ↔ ChatGPT), mặc định `BRIDGE_PORT` |
| `5433` | PostgreSQL (overridden từ port 5432) |

Biến `.env`: `DATABASE_URL` (fallback mặc định trong code), `API_PORT=4000`,
`PLANNER_PORT=4100`, `API_TOKEN`, `PLANNER_TOKEN`, `PLANNER_OWNER_ID=1`,
`BRIDGE_PORT` (mặc định 3456).

## Database & migrations

- Postgres: db `ai_portal`, user `planner`. Kết nối qua `src/lib/db.ts`.
- Bảng: `calendar_jobs`, `bridge_heartbeat`, `migration_log`.
- Chạy migration: `node scripts/migrate.mjs` (áp các file `.sql` mới, ghi log vào `migration_log`)
- Migrations hiện có:
  - `001_create_bridge_heartbeat.sql` — heartbeat WS bridge
  - `002_create_calendar_jobs.sql` — bảng `calendar_jobs`
  - `003_add_repeat_weekdays.sql` — cột `repeat_weekdays TEXT[]` + GIN index

### Mô hình `calendar_jobs`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | serial PK | |
| `title` | text NOT NULL | |
| `description` | text DEFAULT '' | |
| `job_date` | date NOT NULL | ngày gốc của job |
| `start_time` / `end_time` | time/timestamp NULL | |
| `status` | text DEFAULT 'planned' | |
| `repeat_weekdays` | text[] NULL | `NULL` = job 1 lần; `['mon','wed']` = lặp hằng tuần |

## Luồng dữ liệu

### Chat (AI Chat)
```
chat-panel.tsx → POST /api/bridge (ensure bridge) → bridge.mjs :3456
                 → (POST /chat browser ChatGPT) → trả về nội dung phản hồi
```
Bridge state query: `GET /api/bridge` → `bridge-controller.getBridgeState()` → ping `:3456/ready`.

### Calendar
```
calendar/page.tsx → GET /api/calendar?month=YYYY-MM  → lib/calendar.listJobs()
                      → SQL (trả cả job one-off trong tháng + job lặp repeat_weekdays)
JobModal (thêm/sửa) → POST /api/calendar | PUT /api/calendar/[id] → createJob/updateJob
Grid hiển thị: job lặp xuất hiện ở mọi ngày có weekday khớp (date >= job_date), badge "↻"
```
`repeat_weekdays` validate bằng `parseWeekdays()`: lọc key `sun..sat`, dedupe, nếu rỗng → null.

## WebSocket `/ws`

- `server.mjs` phát dữ liệu bridge heartbeat qua WS.
- Client bảo trì kết nối, nhận trạng thái bridge; server ghi heartbeat vào
  `bridge_heartbeat` (giữ 7 ngày).

## Quy ước phát triển

- **Service layer** chứa model/nghiệp vụ/vừa DB; **routes** chỉ là HTTP adapter;
  **UI** không gọi SQL trực tiếp.
- Người dùng nói tiếng Việt — UI copy & thông báo bằng tiếng Việt.
- Verify trước khi xong: `npx tsc --noEmit`, `npx next lint --file <file>`,
  chạy `node scripts/start.mjs`.
- Visual route `/calendar` (đã đổi tên từ `/calender`).