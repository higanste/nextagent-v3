"use server";

import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { generateWithOpenRouter } from "@/lib/openrouter";

export async function connectAccountFn(data: {
  userId: string;
  provider: "github" | "google" | "strava" | "instagram";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  userData: any;
}) {
  await adminDb
    .collection("users")
    .doc(data.userId)
    .collection("accounts")
    .doc(data.provider)
    .set({
      provider: data.provider,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      data: data.userData,
      connectedAt: new Date().toISOString(),
    }, { merge: true });

  return { success: true };
}

export async function fetchGitHubDataFn(userId: string) {
  const accountDoc = await adminDb
    .collection("users")
    .doc(userId)
    .collection("accounts")
    .doc("github")
    .get();

  if (!accountDoc.exists || !accountDoc.data()?.accessToken) {
    return { error: "GitHub account not connected" };
  }

  const accountData = accountDoc.data() as { accessToken: string; data?: any; refreshToken?: string; expiresAt?: string };
  const { accessToken, data } = accountData;
  const username = data?.username || "arslan";

  try {
    const eventsRes = await fetch(`https://api.github.com/users/${username}/events/public`, {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "NextAgent/1.0",
      },
    });

    if (!eventsRes.ok) {
      const errData = await eventsRes.json();
      return { error: errData.message || "Failed to fetch GitHub data" };
    }

    const events = await eventsRes.json();

    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=10`, {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "NextAgent/1.0",
      },
    });

    let repos = [];
    if (reposRes.ok) {
      repos = await reposRes.json();
    }

    const userRes = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "NextAgent/1.0",
      },
    });

    let userData = {};
    if (userRes.ok) {
      userData = await userRes.json();
    }

    return { success: true, events, repos, userData, username };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch GitHub data" };
  }
}

export async function fetchYouTubeDataFn(userId: string) {
  const accountDoc = await adminDb
    .collection("users")
    .doc(userId)
    .collection("accounts")
    .doc("google")
    .get();

  if (!accountDoc.exists || !accountDoc.data()?.accessToken) {
    return { error: "Google account not connected" };
  }

  const { accessToken } = accountDoc.data() as { accessToken: string; refreshToken?: string; expiresAt?: string };

  try {
    const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let channelData = {};
    if (channelRes.ok) {
      channelData = await channelRes.json();
    }

    const watchHistoryRes = await fetch(`https://www.googleapis.com/youtube/v3/history?part=contentDetails&maxResults=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let watchHistory = [];
    if (watchHistoryRes.ok) {
      const whData = await watchHistoryRes.json();
      watchHistory = whData.items || [];
    }

    const subsRes = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&maxResults=20`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let subscriptions = [];
    if (subsRes.ok) {
      const subsData = await subsRes.json();
      subscriptions = subsData.items || [];
    }

    return { success: true, channelData, watchHistory, subscriptions };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch YouTube data" };
  }
}

export async function fetchStravaDataFn(userId: string) {
  const accountDoc = await adminDb
    .collection("users")
    .doc(userId)
    .collection("accounts")
    .doc("strava")
    .get();

  if (!accountDoc.exists || !accountDoc.data()?.accessToken) {
    return { error: "Strava account not connected" };
  }

  const accountData = accountDoc.data() as { accessToken: string; refreshToken?: string; expiresAt?: string };
  const { accessToken, refreshToken, expiresAt } = accountData;
  const now = Date.now();
  const expires = expiresAt ? new Date(expiresAt).getTime() : now + 86400000;

  let token = accessToken;
  if (now > expires && refreshToken) {
    try {
      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();
      if (refreshRes.ok) {
        await adminDb
          .collection("users")
          .doc(userId)
          .collection("accounts")
          .doc("strava")
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || refreshToken,
            expires_at: refreshData.expires_at || expiresAt,
          });
        token = refreshData.access_token;
      }
    } catch (err) {
      console.error("Strava token refresh failed:", err);
    }
  }

  try {
    const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${token}` },
    });

    let athleteData = {};
    if (athleteRes.ok) {
      athleteData = await athleteRes.json();
    }

    const activitiesRes = await fetch("https://www.strava.com/api/v3/activities/stream", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ride run",
        resolution: "seconds",
        before: Math.floor(now / 1000),
        after: Math.floor(now / 1000) - 2592000,
      }),
    });

    let activities = [];
    if (activitiesRes.ok) {
      activities = await activitiesRes.json();
    }

    return { success: true, athleteData, activities };
  } catch (err: any) {
    return { error: err.message || "Failed to fetch Strava data" };
  }
}

export async function fetchDoomscrollDataFn(userId: string) {
  const sessionsSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("doomscrollSessions")
    .orderBy("timestamp", "desc")
    .limit(50)
    .get();

  const sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<{ id: string; appsUsed?: string[]; durationMinutes?: number; timestamp?: string }>;

  const socialMediaApps = ["Instagram", "Twitter", "TikTok", "Facebook", "Reddit", "Snapchat"];
  let totalDoomscrollMinutes = 0;

  for (const session of sessions) {
    if (session.appsUsed) {
      for (const app of session.appsUsed) {
        if (socialMediaApps.includes(app)) {
          totalDoomscrollMinutes += session.durationMinutes || 0;
        }
      }
    }
  }

  return {
    success: true,
    sessions,
    totalDoomscrollMinutes,
    doomscrollHours: Math.round(totalDoomscrollMinutes / 60),
  };
}

export async function generateInsightsFn(data: {
  userId: string;
  dataTypes: ("github" | "youtube" | "strava" | "doomscroll")[];
  context?: string;
}) {
  const { userId, dataTypes, context } = data;

  const accountsSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("accounts")
    .get();

  const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const insightsPromises: Promise<any>[] = [];

  if (dataTypes.includes("github")) {
    insightsPromises.push(fetchGitHubDataFn(userId));
  }
  if (dataTypes.includes("youtube")) {
    insightsPromises.push(fetchYouTubeDataFn(userId));
  }
  if (dataTypes.includes("strava")) {
    insightsPromises.push(fetchStravaDataFn(userId));
  }
  if (dataTypes.includes("doomscroll")) {
    insightsPromises.push(fetchDoomscrollDataFn(userId));
  }

  const results = await Promise.allSettled(insightsPromises);

  const contextParts: string[] = [];
  results.forEach((result, index) => {
    const type = dataTypes[index];
    if (result.status === "fulfilled") {
      contextParts.push(`## ${type.toUpperCase()} DATA\n${JSON.stringify(result.value, null, 2)}`);
    } else {
      contextParts.push(`## ${type.toUpperCase()} DATA\nError: ${result.reason.message}`);
    }
  });

  const fullContext = [
    `User personal data analysis request:`,
    `Context: ${context || "Generate personal insights and recommendations"}`,
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

export async function fetchPersonalLifeFn(userId: string) {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return { error: "User not found" };
  }

  const accountsSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("accounts")
    .get();

  const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<{ id: string; provider: string; data?: any }>;

  const fetchPromises: Promise<any>[] = [];

  if (accounts.some(a => a.provider === "github")) {
    fetchPromises.push(fetchGitHubDataFn(userId));
  }
  if (accounts.some(a => a.provider === "google")) {
    fetchPromises.push(fetchYouTubeDataFn(userId));
  }
  if (accounts.some(a => a.provider === "strava")) {
    fetchPromises.push(fetchStravaDataFn(userId));
  }
  if (accounts.some(a => a.provider === "iosScreenTime" || a.provider === "androidWellbeing")) {
    fetchPromises.push(fetchDoomscrollDataFn(userId));
  }

  const results = await Promise.allSettled(fetchPromises);

  const aggregated = {
    profile: userDoc.data(),
    accounts,
    data: {},
    fetchedAt: new Date().toISOString(),
  };

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value?.success) {
      aggregated.data = { ...aggregated.data, ...result.value };
    }
  });

  return { success: true, aggregated };
}

export async function trackDoomscrollSessionFn(data: {
  userId: string;
  sessionDuration: number;
  appsUsed: string[];
  timestamp: string;
}) {
  await adminDb
    .collection("users")
    .doc(data.userId)
    .collection("doomscrollSessions")
    .add({
      durationMinutes: data.sessionDuration,
      appsUsed: data.appsUsed,
      timestamp: data.timestamp,
    });

  const hours = Math.round(data.sessionDuration / 60);
  const socialMedia = data.appsUsed.filter(a =>
    ["Instagram", "Twitter", "TikTok", "Facebook"].includes(a)
  );

  const report = {
    sessionDuration: `${hours} hours`,
    appsUsed: data.appsUsed.join(", "),
    socialMediaPercent: Math.round((socialMedia.length / data.appsUsed.length) * 100),
    whatCouldHaveBeen: `
${hours} hours of screen time${hours > 1 ? " were" : " was"} spent${data.appsUsed.length > 0 ? " on " + data.appsUsed.join(", ") : ""}.

Those ${hours} hours could have become:
- ${Math.round(hours * 2)} blog posts written
- ${Math.round(hours * 3)} workouts completed
- ${Math.round(hours * 0.5)} new skills learned
- ${Math.round(hours * 1.5)} pages of a book read
- Quality time with friends and family
    `.trim(),
  };

  return { success: true, report };
}

export async function updateProfileFn(data: {
  userId: string;
  displayName?: string;
  theme?: "light" | "dark" | "system";
  timezone?: string;
}) {
  const updates: any = {};
  if (data.displayName) updates.displayName = data.displayName;
  if (data.theme) updates.theme = data.theme;
  if (data.timezone) updates.timezone = data.timezone;

  await adminDb.collection("users").doc(data.userId).update(updates);

  if (data.displayName) {
    await adminAuth.updateUser(data.userId, { displayName: data.displayName });
  }

  return { success: true };
}