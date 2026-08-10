// Apply all pending .sql files from migrations/ that haven't been run yet.
// Tracks applied files in a migration_log table.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const migrationsDir = join(root, "migrations");

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://planner:planner_dev_password@127.0.0.1:5433/ai_portal",
});

async function main() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS migration_log (
       file TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await pool.query("SELECT file FROM migration_log");
  const done = new Set(rows.map((r) => r.file));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip  ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO migration_log (file) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  console.log("migrations done.");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error("migration failed:", e.message);
    process.exit(1);
  });