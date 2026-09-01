import { createAdminClient } from "./lib/supabase-admin";
import { headers } from "next/headers";
import { fetchGitHubDataFn } from "./server-actions";
import { fetchYouTubeDataFn } from "./server-actions";
import { fetchStravaDataFn } from "./server-actions";
import { fetchDoomscrollDataFn } from "./server-actions";
import { generateInsightsFn } from "./server-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/personal/life
 * Aggregated personal data from all connected accounts
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return new Response("User ID required", { status: 400 });
    }

    // Fetch data from all connected sources using server actions
    const fetchPromises: Promise<any>[] = [];

    // Check what providers are connected and fetch accordingly
    const adminSupabase = createAdminClient();

    // Check GitHub
    const { data: githubAccount } = await adminSupabase
      .from("user_accounts")
      .select("provider")
      .eq("user_id", userId)
      .eq("provider", "github")
      .single();

    if (githubAccount) {
      fetchPromises.push(fetchGitHubDataFn(userId));
    }

    // Check Google/YouTube
    const { data: googleAccount } = await adminSupabase
      .from("user_accounts")
      .select("provider")
      .eq("user_id", userId)
      .eq("provider", "google")
      .single();

    if (googleAccount) {
      fetchPromises.push(fetchYouTubeDataFn(userId));
    }

    // Check Strava
    const { data: stravaAccount } = await adminSupabase
      .from("user_accounts")
      .select("provider")
      .eq("user_id", userId)
      .eq("provider", "strava")
      .single();

    if (stravaAccount) {
      fetchPromises.push(fetchStravaDataFn(userId));
    }

    // Check screen time (iOS or Android)
    const { data: screenTimeAccount } = await adminSupabase
      .from("user_accounts")
      .select("provider")
      .eq("user_id", userId)
      .or("provider=iosScreenTime,provider=androidWellbeing")
      .single();

    if (screenTimeAccount) {
      fetchPromises.push(fetchDoomscrollDataFn(userId));
    }

    // Wait for all data fetches
    const results = await Promise.allSettled(fetchPromises);

    const aggregatedData = {
      userId,
      fetchedAt: new Date().toISOString(),
      data: {},
    };

    // Map results to aggregated data
    const typeMap: Record<string, string> = {
      github: "githubData",
      youtube: "youtubeData",
      strava: "stravaData",
      doomscroll: "doomscrollData",
    };

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const resolvedValue = result.value;
        if (resolvedValue?.success) {
          // Add to aggregated data based on the type
          const typeKey = Object.entries(typeMap)[index % Object.keys(typeMap).length];
          if (typeKey) {
            aggregatedData.data = {
              ...aggregatedData.data,
              [typeKey[0]]: resolvedValue,
            };
          }
        }
      }
    });

    return new Response(JSON.stringify(aggregatedData), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

/**
 * POST /api/personal/...
 * Handles both insights generation and account connection based on body parameters
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, dataTypes, context, provider, accessToken, refreshToken, expiresAt, userData } = body;

    // If provider is provided, handle account connection
    if (provider) {
      return await handleConnectAccount(body);
    }

    // Otherwise, handle insights generation
    if (!userId || !dataTypes || !Array.isArray(dataTypes)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, dataTypes, context" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Generate insights using OpenRouter/LLM via server action
    const result = await generateInsightsFn({
      userId,
      dataTypes,
      context,
    });

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ insights: result.insights }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

async function handleConnectAccount(body: any) {
  const { userId, provider, accessToken, refreshToken, expiresAt, userData } = body;

  if (!userId || !provider) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: userId, provider" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }

  // Store connected account tokens using admin Supabase client
  const adminSupabase = createAdminClient();

  // Check if account already exists
  const { data: existing } = await adminSupabase
    .from("user_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (existing) {
    // Update existing token
    await adminSupabase
      .from("user_accounts")
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        data: userData,
        connected_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", provider);
  } else {
    // Create new account connection
    await adminSupabase.from("user_accounts").insert({
      user_id: userId,
      provider: provider,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      data: userData,
      connected_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}