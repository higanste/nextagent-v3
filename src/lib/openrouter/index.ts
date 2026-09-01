/**
 * OpenRouter API client for AI insight generation
 * 
 * Uses the OPENROUTER_API_KEY environment variable
 * https://openrouter.ai/docs/quickstart
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn(
    "OPENROUTER_API_KEY not set. AI insights will not work. " +
    "Set the OPENROUTER_API_KEY environment variable to enable AI features."
  );
}

/**
 * Generate AI response using OpenRouter
 * 
 * @param options System prompt, user prompt, and optional temperature
 * @returns AI response text
 */
export async function generateWithOpenRouter({
  systemPrompt,
  userPrompt,
  temperature = 0.7,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
      "X-Title": "NextAgent",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet", // Best model for analysis
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error("OpenRouter API returned no response");
  }

  return data.choices[0].message.content || "";
}

/**
 * Generate personal insights based on user data
 * 
 * @param userId The user's Supabase ID
 * @param dataTypes The types of data to analyze
 * @param context Additional context for the AI
 * @returns Structured insights string
 */
export async function generatePersonalInsights(
  userId: string,
  dataTypes: string[],
  context: string = ""
): Promise<string> {
  // Build a comprehensive context summary for the AI
  const dataSummaries: Record<string, string> = {
    github: "GitHub commit history, repository activity, contribution patterns",
    youtube: "YouTube watch history, subscriptions, channel statistics",
    strava: "Strava activities, running/cycling metrics, fitness progress",
    doomscroll: "Screen time, app usage patterns, social media engagement hours",
  };

  const typesSummary = dataTypes
    .filter(type => dataSummaries[type])
    .map(type => `- ${dataSummaries[type]}`)
    .join("\n");

  const prompt = `
You are a personal data analyst AI helping user ${userId} understand their digital habits.

Available data types:
${typesSummary}

User context: ${context || "Generate personal insights and recommendations based on the user's connected data"}

Please provide a structured report with the following sections:
1. KEY PATTERNS - What recurring patterns do you see in the data?
2. ANOMALIES - Any unusual or unexpected findings?
3. PERSONALIZED RECOMMENDATIONS - Specific actions the user could take
4. PRODUCTIVITY INSIGHTS - How can they optimize their time?
5. CREATIVE IDEAS - If applicable, ideas for art, writing, or projects based on their data
6. DOOMSCROLL ANALYSIS - If screen time data is included, a "brutally honest" assessment of what those hours could have become

Keep the tone insightful, honest, and constructive. Avoid generic advice - make it specific to the data patterns observed.
`.trim();

  return generateWithOpenRouter({
      systemPrompt: "You are a personal data analyst AI. Help users understand their digital habits and provide actionable insights. Be insightful, honest, and creative.",
      userPrompt: prompt,
      temperature: 0.7,
    });
}

export default { generateWithOpenRouter, generatePersonalInsights };