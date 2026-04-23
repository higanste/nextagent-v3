import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbInstance | null = null;

export function getDb(): DbInstance {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}
