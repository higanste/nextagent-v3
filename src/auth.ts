import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import authConfig from "./auth.config";
import { getDb } from "./db";
import * as schema from "./db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
    session: { strategy: "jwt" },
    secret: process.env.AUTH_SECRET,
    ...authConfig,
  };
});
