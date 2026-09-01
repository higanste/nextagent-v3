import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accountsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("accounts")
      .orderBy("connectedAt", "desc")
      .get();

    const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const sessionsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("doomscrollSessions")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    const sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      userId,
      user: userDoc.data(),
      accounts,
      sessions,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching personal data:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, dataTypes, context } = body;

    if (!userId || !dataTypes || !Array.isArray(dataTypes)) {
      return NextResponse.json(
        { error: "Missing required fields: userId, dataTypes, context" },
        { status: 400 }
      );
    }

    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accountsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("accounts")
      .get();

    const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const insights = await generateInsights(userId, dataTypes, accounts, context || "");

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}

async function generateInsights(userId: string, dataTypes: string[], accounts: any[], context: string) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const accountSummary = accounts
    .map(a => `${a.provider}: ${JSON.stringify(a.data || {})}`)
    .join("\n");

  const prompt = `
User personal data analysis request:
Context: ${context || "Generate personal insights and recommendations"}

Connected accounts:
${accountSummary}

Please provide:
1. Key patterns and anomalies
2. Personalized recommendations for productivity/sleep/etc.
3. Creative insights based on the data
4. Brutally honest assessment of time usage (doomscroll analysis)

Format as a structured report with headings and bullet points.
  `.trim();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
      "X-Title": "NextAgent",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a personal data analyst AI. Help users understand their digital habits and provide actionable insights. Be insightful, honest, and creative."
        },
        { role: "user", content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "No insights generated";
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, provider, accessToken, refreshToken, expiresAt, userData } = body;

    if (!userId || !provider) {
      return NextResponse.json({ error: "Missing required fields: userId, provider" }, { status: 400 });
    }

    await adminDb
      .collection("users")
      .doc(userId)
      .collection("accounts")
      .doc(provider)
      .set({
        provider,
        accessToken,
        refreshToken,
        expiresAt,
        data: userData,
        connectedAt: new Date().toISOString(),
      }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Connect account error:", error);
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 });
  }
}