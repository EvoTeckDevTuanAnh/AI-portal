# AI Portal API Reference

Tài liệu này được tổng hợp từ các route đang có trong `src/app/api`.

## Base URL

| Nhóm | URL mặc định |
|---|---|
| Web API | `http://localhost:3000` |
| Bridge API | `http://localhost:3456` |
| WebSocket | `ws://localhost:3000/ws` |

Các API hiện chưa yêu cầu authentication header trong codebase.

## Tổng quan API theo chức năng

| Chức năng | API |
|---|---|
| AI Chat / Bridge control | `GET /api/bridge`, `POST /api/bridge` |
| Bridge health check | `GET http://localhost:3456/health`, `GET http://localhost:3456/ready` |
| Gửi prompt tới ChatGPT | `POST http://localhost:3456/chat` |
| Calendar Job | `GET|POST /api/calendar`, `GET|PUT|DELETE /api/calendar/:id` |
| Daily Routine template | `GET|POST /api/routines` |
| Daily Routine theo ngày | `GET /api/routines/daily?date=YYYY-MM-DD` |
| Cập nhật task trong routine | `PATCH /api/routine-step-runs/:id` |
| Bridge heartbeat realtime | `ws://localhost:3000/ws` |
| Conversation history | `GET|POST /api/conversations`, `GET|PATCH|DELETE /api/conversations/:id` |
| Conversation messages | `POST /api/conversations/:id/messages` |
| Agent task orchestration | `POST /api/agent/tasks` |

Lưu ý: codebase chưa có `POST /api/chat`; chức năng gửi chat đi trực tiếp qua Bridge API `POST /chat` trên port `3456`.

Conversation history được lưu trong PostgreSQL; message user được ghi trước khi gọi Bridge và message assistant được ghi sau khi nhận kết quả. Cleanup định kỳ dùng `npm.cmd run cleanup:conversations`, mặc định chỉ xóa conversation đã archive quá 90 ngày và chỉ thực thi vào Chủ nhật theo `CONVERSATION_CLEANUP_TZ`.

## 1. Conversation History API

### `GET /api/conversations?search=&includeArchived=false`

Lấy danh sách conversation, sắp xếp theo `updated_at` giảm dần. `search` tìm trong title và message; `includeArchived=true` bao gồm cả conversation đã archive.

### `POST /api/conversations`

Request có thể kèm `external_conversation_id` là UUID hoặc URL dạng `https://chatgpt.com/c/<uuid>`; hệ thống lưu UUID chuẩn hóa để liên kết với conversation ChatGPT.

Tạo conversation mới:

```json
{ "title": "New conversation" }
```

### `GET /api/conversations/:id`

Lấy conversation cùng toàn bộ messages theo thứ tự thời gian.

### `PATCH /api/conversations/:id`

Cập nhật title hoặc trạng thái:

```json
{ "title": "Project planning", "status": "archived" }
```

`status` nhận `active` hoặc `archived`.

### `DELETE /api/conversations/:id`

Xóa vĩnh viễn conversation và messages liên quan. Response `200` `{ "ok": true }`.

### `POST /api/conversations/:id/messages`

Lưu message vào conversation:

```json
{
  "role": "user",
  "content": "Hãy lập kế hoạch công việc",
  "status": "completed",
  "metadata": {}
}
```

`role` nhận `user`, `assistant`, `system`; `status` nhận `pending`, `completed`, `failed`. Conversation mới sẽ tự lấy title từ user prompt đầu tiên nếu title còn mặc định.

## 2. Calendar Job API

### `GET /api/calendar`

Lấy danh sách Calendar Job.

Query tùy chọn:

| Tên | Kiểu | Mô tả |
|---|---|---|
| `month` | `string` | Định dạng `YYYY-MM`; lấy job trong tháng và job lặp theo tuần. |

Response `200`:

```json
[
  {
    "id": 1,
    "title": "Team meeting",
    "description": "Weekly sync",
    "job_date": "2026-08-10",
    "start_time": "09:00",
    "end_time": "10:00",
    "status": "planned",
    "repeat_weekdays": ["mon", "wed"]
  }
]
```

### `POST /api/calendar`

Tạo Calendar Job.

Request body:

```json
{
  "title": "Gửi báo cáo",
  "description": "",
  "job_date": "2026-08-12",
  "start_time": "08:00",
  "end_time": null,
  "status": "planned",
  "repeat_weekdays": ["fri"]
}
```

Response: `201` + object `CalendarJob`.

Lỗi: `400` nếu thiếu `title` hoặc `job_date` không đúng `YYYY-MM-DD`; `500` nếu lỗi database.

### `GET /api/calendar/:id`

Lấy một job theo ID. Response `200` + `CalendarJob`; `400` nếu ID không hợp lệ; `404` nếu không tồn tại.

### `PUT /api/calendar/:id`

Cập nhật job. Body dùng cùng cấu trúc với `POST`; các trường rỗng được giữ hoặc cập nhật theo logic service hiện tại. Response `200` + `CalendarJob`; `400`, `404`, `500` tùy lỗi.

### `DELETE /api/calendar/:id`

Xóa job. Response `200`:

```json
{ "ok": true }
```

## 3. Daily Routine API

Daily Routine gồm template, steps, daily run và step runs. Run được tạo lazy khi truy vấn một ngày, không generate trước hàng trăm ngày.

### `GET /api/routines`

Lấy toàn bộ routine template cùng danh sách steps.

Response `200`:

```json
[
  {
    "id": 1,
    "name": "Workday routine",
    "description": "",
    "repeat_type": "daily",
    "weekdays": [],
    "start_date": "2026-08-10",
    "end_date": null,
    "timezone": "Asia/Ho_Chi_Minh",
    "is_active": true,
    "steps": [
      {
        "id": 1,
        "title": "Check messages",
        "description": null,
        "start_time": "08:00",
        "duration_minutes": 15,
        "sort_order": 0
      }
    ]
  }
]
```

### `POST /api/routines`

Tạo routine template và toàn bộ steps trong một transaction.

Request body:

```json
{
  "name": "Workday routine",
  "description": "Daily work plan",
  "repeat_type": "daily",
  "weekdays": [],
  "start_date": "2026-08-10",
  "end_date": null,
  "timezone": "Asia/Ho_Chi_Minh",
  "steps": [
    {
      "title": "Check messages",
      "description": "",
      "start_time": "08:00",
      "duration_minutes": 15
    }
  ]
}
```

`repeat_type` nhận `daily`, `weekdays` hoặc `custom`. Với `custom`, `weekdays` là mảng số từ `0` đến `6` theo quy ước JavaScript: Chủ nhật `0`, Thứ hai `1`, ..., Thứ bảy `6`.

Response: `201` + routine vừa tạo; `400` nếu dữ liệu không hợp lệ; `500` nếu lỗi database.

Validation chính: `name`, `start_date`, ít nhất một step, title step, `start_time` dạng `HH:mm`, duration là số nguyên dương nếu có, và `end_date` không trước `start_date`.

### `GET /api/routines/daily?date=YYYY-MM-DD`

Lấy routine áp dụng cho ngày chỉ định và tạo lazy `routine_run`/`routine_step_runs` nếu chưa tồn tại. Request lặp lại không tạo duplicate nhờ unique constraint.

Nếu bỏ `date`, API dùng ngày hiện tại của server.

Response `200`:

```json
[
  {
    "id": 1,
    "name": "Workday routine",
    "run": {
      "id": 10,
      "run_date": "2026-08-10",
      "status": "in_progress"
    },
    "step_runs": [
      {
        "run_id": 101,
        "title": "Check messages",
        "start_time": "08:00",
        "status": "completed",
        "started_at": "2026-08-10T01:00:00.000Z",
        "completed_at": "2026-08-10T01:15:00.000Z",
        "note": null
      }
    ]
  }
]
```

### `PATCH /api/routine-step-runs/:id`

Cập nhật trạng thái một step run.

Request body:

```json
{
  "status": "completed",
  "note": "Finished early"
}
```

`status` nhận `pending`, `in_progress`, `completed`, `skipped` hoặc `missed`. Khi chuyển sang `in_progress`, hệ thống lưu `started_at`; khi chuyển sang `completed`, hệ thống lưu `completed_at` và cập nhật trạng thái `routine_run`.

Response `200` + step run; `400` nếu ID/status không hợp lệ; `404` nếu không tồn tại.

## 4. Bridge API

### `GET /api/bridge`

Lấy trạng thái bridge ChatGPT.

Response `200`:

```json
{
  "port": 3456,
  "up": true,
  "health": {
    "pageOpen": true,
    "composerReady": true
  }
}
```

### `POST /api/bridge`

Khởi động bridge nếu chưa chạy.

Request body tùy chọn:

```json
{ "force": false }
```

`force: true` yêu cầu restart bridge hiện tại. Response:

```json
{
  "started": true,
  "port": 3456
}
```

## 5. Bridge trực tiếp trên port 3456

### `GET /health` và `GET /ready`

Kiểm tra bridge, browser page và composer ChatGPT.

```json
{
  "ok": true,
  "pageOpen": true,
  "composerReady": true
}
```

### `POST /chat`

Request có thể kèm `conversation_id` là UUID ChatGPT. Bridge sẽ mở đúng URL `/c/<uuid>` trước khi gửi prompt; UI chấp nhận cả URL đầy đủ và tự chuẩn hóa.

Gửi prompt tới ChatGPT qua Playwright/Brave.

Không stream:

```json
{ "prompt": "Soạn email xác nhận lịch hẹn" }
```

Response `200`:

```json
{ "reply": "Nội dung phản hồi từ ChatGPT" }
```

Stream SSE:

```json
{ "prompt": "Soạn email xác nhận lịch hẹn", "stream": true }
```

Các event SSE: `prepare`, `sending`, `thinking`, `stall`, `ready`, `typing`, `done`, `error`. Event `done` chứa câu trả lời hoàn chỉnh; event `error` chứa thông báo lỗi.

## 6. WebSocket heartbeat

### `ws://localhost:3000/ws`

Nhận trạng thái bridge theo thời gian thực. Payload mẫu:

```json
{
  "type": "bridge-status",
  "at": "2026-08-10T03:00:00.000Z",
  "status": {
    "bridgeUp": true,
    "pageOpen": true,
    "composerReady": true,
    "busy": false,
    "queued": 0,
    "headless": false
  }
}
```

Server ghi heartbeat vào PostgreSQL trong bảng `bridge_heartbeat` và giữ dữ liệu mặc định 7 ngày.

## 7. Quy ước lỗi chung

Lỗi API trả JSON dạng:

```json
{ "error": "error message" }
```

Mã thường dùng:

| Mã | Ý nghĩa |
|---|---|
| `200` | Thành công |
| `201` | Tạo resource thành công |
| `400` | Request hoặc tham số không hợp lệ |
| `404` | Resource không tồn tại |
| `500` | Lỗi server/database |

## 8. Source và database

- Route API: `src/app/api/**/route.ts`
- Calendar service: `src/lib/calendar.ts`
- Daily Routine domain: `src/lib/routine-domain.ts`
- Daily Routine service: `src/lib/routines.ts`
- Database connection: `src/lib/db.ts`
- Routine migration: `migrations/004_create_daily_routines.sql`
- Client chat bridge: `src/modules/chatgpt/client/bridge-client.ts`

Chạy migration bằng `node scripts/migrate.mjs`; kiểm tra type/build bằng `npm.cmd run typecheck` và `npm.cmd run build`.
