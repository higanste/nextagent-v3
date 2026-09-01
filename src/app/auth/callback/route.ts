"use server";

import { createClient } from "./supabase-server";
import { headers } from "next/headers";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Strava from "next-auth/providers/strava";
import { NextResponse } from "next/server";

const supabase = createClient();

// OAuth providers configuration
const providers = {
  google: {
    id: "google",
    name: "Google",
    description: "Connect YouTube, Google Fit, and other Google services",
  },
  github: {
    id: "github",
    name: "GitHub",
    description: "Connect your GitHub account for commit history and repos",
  },
  strava: {
    id: "strava",
    name: "Strava",
    description: "Connect Strava for activity and running data",
  },
};

// Initiate OAuth sign-in
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") || "google";

  if (!Object.prototype.hasOwnProperty.call(providers, provider)) {
    return new NextResponse(`Invalid provider: ${provider}`, { status: 400 });
  }

  // Auth sign-in with the selected provider
  const authSignIn = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/auth/callback`,
    },
  });

  if (authSignIn.error) {
    return new NextResponse(`Auth error: ${authSignIn.error.message}`, {
      status: 500,
    });
  }

  return NextResponse.redirect(authSignIn.data.url!);
}

// OAuth callback handler
export async function GET_callback(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const provider = searchParams.get("provider") || "google";

  if (!code) {
    return new NextResponse("Authorization code missing", { status: 400 });
  }

  try {
    // Exchange the authorization code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return new NextResponse(`Session error: ${error.message}`, { status: 500 });
    }

    // Get user profile info
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Store provider-specific tokens and data
    await storeProviderTokens(user.user.id, provider, data);

    // Redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (err: any) {
    return new NextResponse(`Error: ${err.message}`, { status: 500 });
  }
}

// Store provider tokens and data in Supabase
async function storeProviderTokens(
  userId: string,
  provider: string,
  authData: any
) {
  const adminSupabase = createAdminClient();

  switch (provider) {
    case "google":
      // Store Google tokens for YouTube, Google Fit, etc.
      await adminSupabase.from("user_accounts").upsert({
        user_id: userId,
        provider: "google",
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at,
        scope: authData.session?.scope,
        data: {
          email: authData.user?.email,
          name: authData.user?.user_metadata?.full_name,
        },
      }, { onConflict: "user_id,provider" });
      break;

    case "github":
      // Store GitHub tokens for commit history, repos, etc.
      await adminSupabase.from("user_accounts").upsert({
        user_id: userId,
        provider: "github",
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at,
        scope: authData.session?.scope,
        data: {
          username: authData.user?.user_metadata?.username,
          email: authData.user?.email,
        },
      }, { onConflict: "user_id,provider" });
      break;

    case "strava":
      // Store Strava tokens for activity data
      await adminSupabase.from("user_accounts").upsert({
        user_id: userId,
        provider: "strava",
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at,
        scope: authData.session?.scope,
        data: {
          athlete_id: authData.user?.user_metadata?.athlete_id,
          username: authData.user?.user_metadata?.username,
        },
      }, { onConflict: "user_id,provider" });
      break;
  }
}

// Helper to create admin client
function createAdminClient() {
  // In production, use service role key
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export { storeProviderTokens };