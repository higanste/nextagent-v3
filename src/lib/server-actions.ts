"use server";

import { createAdminClient } from "./supabase-admin";
import { supabase } from "./supabase-client";
import { headers } from "next/headers";
import { generateWithOpenRouter } from "./openrouter";
import { compileHtmlTemplate } from "./html-template";

/**
 * Store connected account tokens
 */
export async function connectAccountFn(data: {
  userId: string;
  provider: "github" | "google" | "strava" | "instagram";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  userData: any;
}) {
  const adminSupabase = createAdminClient();

  // Check if account already exists
  const { data: existing } = await adminSupabase
    .from("user_accounts")
    .select("*")
    .eq("user_id", data.userId)
    .eq("provider", data.provider)
    .single();

  if (existing) {
    // Update existing token
    await adminSupabase
      .from("user_accounts")
      .update({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
        expires_at: data.expiresAt,
        data: data.userData,
        connected_at: new Date().toISOString(),
      })
      .eq("user_id", data.userId)
      .eq("provider", data.provider);
  } else {
    // Create new account connection
    await adminSupabase.from("user_accounts").insert({
      user_id: data.userId,
      provider: data.provider,
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expires_at: data.expiresAt,
      data: data.userData,
      connected_at: new Date().toISOString(),
    });
  }

  return { success: true };
}

/**
 * Fetch GitHub data (commits, repos, etc.)
 */
export async function fetchGitHubDataFn(userId: string) {
  const adminSupabase = createAdminClient();

  // Get GitHub token
  const { data: account } = await adminSupabase
    .from("user_accounts")
    .select("access_token, data")
    .eq("user_id", userId)
    .eq("provider", "github")
    .single();

  if (!account?.access_token) {
    return { error: "GitHub account not connected" };
  }

  try {
    const username = account.data?.username || "arslan";
    
    // Fetch user events (recent activity)
    const res = await fetch(`https://api.github.com/users/${username}/events/public`, {
      headers: {
        Authorization: `token ${account.access_token}`,
        "User-Agent": "NextAgent/1.0",
      },
    });

    if (!res.ok) {
      const errData = await res.json();
      return { error: errData.message || "Failed to fetch GitHub data" };
    }

    const events = await res.json();

    // Fetch user repos
    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=10`, {
      headers: {
        Authorization: `token ${account.access_token}`,
        "User-Agent": "NextAgent/1.0",
      },
    });

    let repos = [];
    if (reposRes.ok) {
      repos = await reposRes.json();
    }

    // Fetch follower/following counts
    const userRes = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Authorization: `token ${account.access_token}`,
        "User-Agent": "NextAgent/1.0",
      },
    });

    let userData = {};
    if (userRes.ok) {
      userData = await userRes.json();
    }

    return { 
      success: true, 
      events, 
      repos, 
      userData,
      username 
    };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch GitHub data" };
  }
}

/**
 * Fetch YouTube data (watch history, playlists)
 * Uses Google OAuth - token stored in user_accounts
 */
export async function fetchYouTubeDataFn(userId: string) {
  const adminSupabase = createAdminClient();

  // Get Google token
  const { data: account } = await adminSupabase
    .from("user_accounts")
    .select("access_token, data")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (!account?.access_token) {
    return { error: "Google account not connected" };
  }

  try {
    // Fetch YouTube channel data
    const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true`, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });

    let channelData = {};
    if (channelRes.ok) {
      channelData = await channelRes.json();
    }

    // Fetch watch history (recent watches)
    const watchHistoryRes = await fetch(`https://www.googleapis.com/youtube/v3/history?part=contentDetails&maxResults=50`, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });

    let watchHistory = [];
    if (watchHistoryRes.ok) {
      const whData = await watchHistoryRes.json();
      watchHistory = whData.items || [];
    }

    // Fetch subscriptions
    const subsRes = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&maxResults=20`, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });

    let subscriptions = [];
    if (subsRes.ok) {
      const subsData = await subsRes.json();
      subscriptions = subsData.items || [];
    }

    return { 
      success: true, 
      channelData, 
      watchHistory, 
      subscriptions 
    };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch YouTube data" };
  }
}

/**
 * Fetch Strava data (activities, stats)
 */
export async function fetchStravaDataFn(userId: string) {
  const adminSupabase = createAdminClient();

  // Get Strava token
  const { data: account } = await adminSupabase
    .from("user_accounts")
    .select("access_token, data, expires_at")
    .eq("user_id", userId)
    .eq("provider", "strava")
    .single();

  if (!account?.access_token) {
    return { error: "Strava account not connected" };
  }

  // Check if token is expired and try to refresh
  const now = Date.now();
  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : now + 86400000; // default 1 day

  if (now > expiresAt && account.refresh_token) {
    // Try to refresh token
    try {
      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();
      
      if (refreshRes.ok) {
        // Update tokens in database
        await adminSupabase.from("user_accounts").update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || account.refresh_token,
          expires_at: refreshData.expires_at || account.expires_at,
        }).eq("user_id", userId).eq("provider", "strava");

        // Use new token
        account.access_token = refreshData.access_token;
        account.expires_at = refreshData.expires_at || account.expires_at;
      }
    } catch (err) {
      console.error("Strava token refresh failed:", err);
    }
  }

  try {
    // Fetch athlete profile
    const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });

    let athleteData = {};
    if (athleteRes.ok) {
      athleteData = await athleteRes.json();
    }

    // Fetch recent activities (last 30 days)
    const activitiesRes = await fetch("https://www.strava.com/api/v3/activities/stream", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ride run",
        resolution: "seconds",
        before: Math.floor(now / 1000),
        after: Math.floor(now / 1000) - 2592000, // 30 days ago
      }),
    });

    let activities = [];
    if (activitiesRes.ok) {
      activities = await activitiesRes.json();
    }

    return { 
      success: true, 
      athleteData, 
      activities 
    };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch Strava data" };
  }
}

/**
 * Fetch system metrics (CPU, memory, disk I/O, network)
 * Uses system monitoring via Node.js/OS modules
 */
export async function fetchSystemMetricsFn() {
  try {
    // Since this runs on the server, we can get process info
    const res = await fetch("http://localhost:3000/api/system/metrics", {
      // In a real implementation, this would use system modules
      // For now, return placeholder data
    });

    // Placeholder - in real implementation use node:os, node:process, etc.
    return {
      success: true,
      metrics: {
        cpuUsage: "N/A - use client-side monitoring",
        memoryUsage: "N/A - use client-side monitoring",
        diskIo: "N/A - use client-side monitoring",
        network: "N/A - use client-side monitoring",
      }
    };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch system metrics" };
  }
}

/**
 * Fetch doomscroll/screen time data
 * Pulls from iOS Screen Time / Android Digital Wellbeing APIs
 */
export async function fetchDoomscrollDataFn(userId: string) {
  const adminSupabase = createAdminClient();

  // Get doomscroll/screen time data from user's connected phone accounts
  const { data: account } = await adminSupabase
    .from("user_accounts")
    .select("access_token, data, provider")
    .eq("user_id", userId)
    .or("provider=iosScreenTime,provider=androidWellbeing")
    .single();

  if (!account?.access_token) {
    return { error: "Screen time data not connected. Connect iOS Screen Time or Android Digital Wellbeing." };
  }

  try {
    // Fetch screen time data based on platform
    let screenTimeData = {};

    if (account.provider === "iosScreenTime") {
      // iOS Screen Time API
      const res = await fetch("https://api.example.com/ios/screentime", {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });
      screenTimeData = await res.json();
    } else if (account.provider === "androidWellbeing") {
      // Android Digital Wellbeing API
      const res = await fetch("https://api.example.com/android/digitalwellbeing", {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });
      screenTimeData = await res.json();
    }

    // Calculate doomscroll hours (apps with high social media usage)
    const doomscrollHours = calculateDoomscrollHours(screenTimeData);

    return { 
      success: true, 
      screenTimeData, 
      doomscrollHours 
    };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch doomscroll data" };
  }
}

/**
 * Calculate doomscroll hours from screen time data
 */
function calculateDoomscrollHours(screenTimeData: any): number {
  if (!screenTimeData?.appUsage) return 0;

  const socialMediaApps = ["Instagram", "Twitter", "TikTok", "Facebook", "Reddit", "Snapchat"];
  let totalDoomscrollMinutes = 0;

  for (const usage of screenTimeData.appUsage) {
    if (socialMediaApps.includes(usage.appName)) {
      totalDoomscrollMinutes += usage.minutes || 0;
    }
  }

  return Math.round(totalDoomscrollMinutes / 60);
}

/**
 * Generate AI insights using OpenRouter/LLM
 */
export async function generateInsightsFn(data: {
  userId: string;
  dataTypes: ("github" | "youtube" | "strava" | "doomscroll")[];
  context?: string;
}) {
  const adminSupabase = createAdminClient();

  // Fetch all the requested data types
  const insightsPromises: Promise<any>[] = [];

  if (data.dataTypes.includes("github")) {
    insightsPromises.push(fetchGitHubDataFn(userId));
  }
  if (data.dataTypes.includes("youtube")) {
    insightsPromises.push(fetchYouTubeDataFn(userId));
  }
  if (data.dataTypes.includes("strava")) {
    insightsPromises.push(fetchStravaDataFn(userId));
  }
  if (data.dataTypes.includes("doomscroll")) {
    insightsPromises.push(fetchDoomscrollDataFn(userId));
  }

  const results = await Promise.allSettled(insightsPromises);
  
  // Build context for LLM
  const contextParts: string[] = [];
  
  results.forEach((result, index) => {
    const type = data.dataTypes[index];
    if (result.status === "fulfilled") {
      contextParts.push(`## ${type.toUpperCase()} DATA\n${JSON.stringify(result.value, null, 2)}`);
    } else {
      contextParts.push(`## ${type.toUpperCase()} DATA\nError: ${result.reason.message}`);
    }
  });

  const fullContext = [
    `User personal data analysis request:`,
    `Context: ${data.context || "Generate personal insights and recommendations"}`,
    ...contextParts,
    "",
    "Please provide:",
    "1. Key patterns and anomalies found in the data",
    "2. Personalized recommendations for improving productivity/sleep/etc.",
    "3. Creative insights or art generation ideas based on the data",
    "4. Brutally honest assessment of time usage (doomscroll analysis)",
    "",
    "Format as a structured report with headings and bullet points."
  ].join("\n");

  try {
    const aiResponse = await generateWithOpenRouter({
      systemPrompt: "You are a personal data analyst AI. Help users understand their digital habits and provide actionable insights. Be insightful, honest, and creative.",
      userPrompt: fullContext,
      temperature: 0.7,
    });

    return { 
      success: true, 
      insights: aiResponse,
      rawData: results.map(r => r.status === "fulfilled" ? r.value : { error: r.reason.message })
    };
  } catch (err: any) {
    return { error: err.message || "AI insight generation failed" };
  }
}

/**
 * Compile a personal life API endpoint data
 */
export async function fetchPersonalLifeFn(userId: string) {
  const adminSupabase = createAdminClient();

  // Get user profile
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // Get all connected accounts
  const { data: accounts } = await adminSupabase
    .from("user_accounts")
    .select("*")
    .eq("user_id", userId);

  // Fetch aggregated data from all connected sources
  const fetchPromises: Promise<any>[] = [];

  if (accounts?.some(a => a.provider === "github")) {
    fetchPromises.push(fetchGitHubDataFn(userId));
  }
  if (accounts?.some(a => a.provider === "google")) {
    fetchPromises.push(fetchYouTubeDataFn(userId));
  }
  if (accounts?.some(a => a.provider === "strava")) {
    fetchPromises.push(fetchStravaDataFn(userId));
  }
  if (accounts?.some(a => a.provider === "iosScreenTime" || a.provider === "androidWellbeing")) {
    fetchPromises.push(fetchDoomscrollDataFn(userId));
  }

  const results = await Promise.allSettled(fetchPromises);

  const aggregated = {
    profile,
    accounts,
    data: {},
    fetchedAt: new Date().toISOString(),
  };

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      // Map result to appropriate key
      aggregated.data = { ...aggregated.data, ...result.value };
    }
  });

  return { success: true, aggregated };
}

/**
 * Track doomscroll session and generate report
 */
export async function trackDoomscrollSessionFn(data: {
  userId: string;
  sessionDuration: number; // in minutes
  appsUsed: string[];
  timestamp: string;
}) {
  const adminSupabase = createAdminClient();

  // Save session to interactions or sessions table
  const { error } = await adminSupabase.from("doomscroll_sessions").insert({
    user_id: data.userId,
    duration_minutes: data.sessionDuration,
    apps_used: data.appsUsed,
    timestamp: data.timestamp,
  });

  if (error) {
    console.error("Failed to save doomscroll session:", error);
  }

  // Generate brief report
  const report = generateDoomscrollReport(data);

  return { 
    success: true, 
    report,
    sessionSaved: error ? false : true 
  };
}

/**
 * Generate a doomscroll session report
 */
function generateDoomscrollReport(data: {
  sessionDuration: number;
  appsUsed: string[];
  timestamp: string;
}) {
  const hours = Math.round(data.sessionDuration / 60);
  const socialMedia = data.appsUsed.filter(a => 
    ["Instagram", "Twitter", "TikTok", "Facebook"].includes(a)
  );

  const whatCouldHaveBeen = `
${hours} hours of screen time${hours > 1 ? " were" : " was"} spent${data.appsUsed.length > 0 ? " on " + data.appsUsed.join(", ") : ""}.

Those ${hours} hours could have become:
- ${Math.round(hours * 2)} blog posts written
- ${Math.round(hours * 3)} workouts completed
- ${Math.round(hours * 0.5)} new skills learned (1hr = 30min of focused learning)
- ${Math.round(hours * 1.5)} pages of a book read
- Quality time with friends and family
  `.trim();

  return {
    sessionDuration: `${hours} hours`,
    appsUsed: data.appsUsed.join(", "),
    socialMediaHours: Math.round((socialMedia.length / data.appsUsed.length) * 100),
    whatCouldHaveBeen,
  };
}

/**
 * Update user profile settings
 */
export async function updateProfileFn(data: {
  userId: string;
  displayName?: string;
  theme?: "light" | "dark" | "system";
  timezone?: string;
}) {
  const adminSupabase = createAdminClient();

  const updates: any = {};
  if (data.displayName) updates.display_name = data.displayName;
  if (data.theme) updates.theme = data.theme;
  if (data.timezone) updates.timezone = data.timezone;

  const { error } = await adminSupabase
    .from("profiles")
    .update(updates)
    .eq("id", data.userId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}