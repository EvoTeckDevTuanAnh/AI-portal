import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
};

export const db =
  globalForPg.pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://planner:planner_dev_password@127.0.0.1:5433/ai_portal",
    max: 5,
    connectionTimeoutMillis: 3000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = db;