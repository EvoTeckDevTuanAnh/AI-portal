import pg from "pg";

const DB_URL = process.env.DATABASE_URL || "postgres://planner:planner_dev_password@127.0.0.1:5433/ai_portal";
const RETENTION_DAYS = Math.max(1, Number(process.env.CONVERSATION_RETENTION_DAYS || 90));
const TIMEZONE = process.env.CONVERSATION_CLEANUP_TZ || "Asia/Ho_Chi_Minh";
const TASK_KEY = "weekly_conversation_cleanup";

export async function runWeeklyConversationCleanup() {
  const pool = new pg.Pool({ connectionString: DB_URL, max: 1, connectionTimeoutMillis: 3000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`, [TASK_KEY]);
    if (!lock.rows[0].locked) { await client.query("ROLLBACK"); return { skipped: true, deleted: 0 }; }
    const due = await client.query(`SELECT EXTRACT(DOW FROM (now() AT TIME ZONE $1)) = 0 AND NOT EXISTS (SELECT 1 FROM maintenance_runs WHERE task_key = $2 AND last_run_at >= date_trunc('day', now() AT TIME ZONE $1)) AS due`, [TIMEZONE, TASK_KEY]);
    if (!due.rows[0].due) { await client.query("COMMIT"); return { skipped: true, deleted: 0 }; }
    const removed = await client.query(`DELETE FROM conversations WHERE status = 'archived' AND updated_at < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
    await client.query(`INSERT INTO maintenance_runs (task_key, last_run_at) VALUES ($1, now()) ON CONFLICT (task_key) DO UPDATE SET last_run_at = EXCLUDED.last_run_at`, [TASK_KEY]);
    await client.query("COMMIT");
    return { skipped: false, deleted: removed.rowCount ?? 0 };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); await pool.end(); }
}

if (process.argv[1]?.endsWith("cleanup-conversations.mjs")) {
  runWeeklyConversationCleanup().then((result) => { console.log(JSON.stringify(result)); }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
