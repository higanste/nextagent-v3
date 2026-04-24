import { neon } from '@neondatabase/serverless';
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Creating drops table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "drops" (
      "code" varchar(4) PRIMARY KEY NOT NULL,
      "content" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "expires_at" timestamp NOT NULL
    );
  `;
  console.log("Migration complete!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
