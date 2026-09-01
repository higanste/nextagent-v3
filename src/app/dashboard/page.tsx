"use client";

import { supabase } from "./lib/supabase-client";
import { useEffect, useState } from "react";

// Simple card wrapper - no shadcn/ui dependency
function SimpleCard({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border p-6 ${className || ""}`}>
      <h3 className="text-lg font-medium mb-4">{title}</h3>
      <div className="">{children}</div>
    </div>
  );
}

function SimpleProgress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const percentage = (value / max) * 100;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Progress</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="bg-gray-200 rounded-full h-2.5 w-full overflow-hidden">
        <div 
          className="bg-primary rounded-full h-full w-full/4 transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [personalData, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        // Fetch connected accounts
        const { data: accounts } = await supabase
          .from("user_accounts")
          .select("*")
          .eq("user_id", session.user.id);

        // Fetch doomscroll sessions
        const { data: sessions } = await supabase
          .from("doomscroll_sessions")
          .select("*")
          .eq("user_id", session.user.id)
          .order("timestamp", { ascending: false })
          .limit(10);

        // Calculate aggregate stats
        let totalDoomscrollMinutes = 0;
        let totalSessions = 0;
        if (sessions) {
          totalSessions = sessions.length;
          for (const session of sessions) {
            totalDoomscrollMinutes += session.duration_minutes || 0;
          }
        }

        // Count connected accounts by type
        const accountTypes: any = {};
        if (accounts) {
          for (const account of accounts) {
            accountTypes[account.provider] = (accountTypes[account.provider] || 0) + 1;
          }
        }

        setData({
          profile,
          accounts: accounts || [],
          sessions: sessions || [],
          totalDoomscrollMinutes,
          totalSessions,
          accountTypes,
        });
      } catch (err: any) {
        setError(err.message || "Failed to fetch personal data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  // Generate insights from OpenRouter
  const generateInsights = async (dataTypes: string[]) => {
    setGeneratingInsights(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch("/api/personal/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          dataTypes,
          context: "Generate personal insights and recommendations based on my connected data",
        }),
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setInsights(result.insights);
    } catch (err: any) {
      setInsights(`Error: ${err.message}`);
    } finally {
      setGeneratingInsights(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <SimpleCard title="Error">{error}</SimpleCard>
      </div>
    );
  }

  if (!personalData) {
    return <div className="p-6">No data available</div>;
  }

  const {
    profile,
    accounts,
    sessions,
    totalDoomscrollMinutes,
    totalSessions,
    accountTypes,
  } = personalData;

  // Calculate stats
  const avgSessionMinutes = totalSessions > 0 ? Math.round(totalDoomscrollMinutes / totalSessions) : 0;
  const doomscrollHours = Math.round(totalDoomscrollMinutes / 60);
  const githubCount = accountTypes?.github || 0;
  const googleCount = accountTypes?.google || 0;
  const stravaCount = accountTypes?.strava || 0;

  // Generate initial insights on first load
  useEffect(() => {
    if (personalData && !insights && !generatingInsights) {
      generateInsights(["github", "youtube", "strava", "doomscroll"]).then();
    }
  }, [personalData, insights, generatingInsights]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex bg-primary/10 border-b border-primary/20 p-4">
        <div className="flex-1 text-primary">NextAgent</div>
        <div className="flex space-x-4">
          {accounts?.map((account: any) => (
            <span key={account.provider} className="text-sm opacity-70">
              {account.provider}: connected
            </span>
          ))}
        </div>
      </header>

      <main className="p-6">
        {/* Profile Section */}
        {profile?.display_name && (
          <SimpleCard title="Your Profile">
            <p className="mt-2">{profile.display_name}</p>
            <p className="mt-2 text-sm text-muted-foreground">Member since</p>
          </SimpleCard>
        )}

        {/* Connected Accounts Section */}
        {accounts?.length > 0 && (
          <SimpleCard title="Connected Accounts">
            <div className="grid grid-cols-3 gap-2">
              {accounts.map((account: any) => (
                <div key={account.id} className="px-3 py-2 rounded text-xs bg-gray-100">
                  {account.provider}
                </div>
              ))}
            </div>
          </SimpleCard>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <SimpleCard>
            <div className="text-3xl font-bold">{doomscrollHours}h</div>
            <div className="text-sm text-muted-foreground">Doomscroll hours</div>
          </SimpleCard>
          <SimpleCard>
            <div className="text-3xl font-bold">{totalSessions}</div>
            <div className="text-sm text-muted-foreground">Sessions</div>
          </SimpleCard>
          <SimpleCard>
            <div className="text-3xl font-bold">{githubCount}</div>
            <div className="text-sm text-muted-foreground">GitHub</div>
          </SimpleCard>
          <SimpleCard>
            <div className="text-3xl font-bold">{googleCount}</div>
            <div className="text-sm text-muted-foreground">Google/YouTube</div>
          </SimpleCard>
        </div>

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <SimpleCard title="Recent Doomscroll Sessions">
            <div className="space-y-2">
              {sessions.slice(0, 5).map((session: any) => (
                <div key={session.id} className="p-2 rounded bg-gray-50">
                  <div className="text-xs">{session.apps_used?.join(", ") || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(session.timestamp).toLocaleDateString()}</div>
                  <div className="mt-1">
                    <span className="text-primary font-medium">{session.duration_minutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          </SimpleCard>
        )}

        {/* AI Insights Section */}
        <div className="mt-6">
          <SimpleCard title="AI Insights">
            {generatingInsights ? (
              <div className="h-20 flex items-center justify-center">
                <span className="spinner-border text-sm me-2" role="status" />
                Generating insights...
              </div>
            ) : insights ? (
              <pre className="text-xs text-muted-foreground overflow-auto max-h-64">{insights}</pre>
            ) : (
              <p className="text-muted-foreground">Generate insights below</p>
            )}
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateInsights(["github", "youtube", "strava", "doomscroll"])}
                disabled={generatingInsights}
              >
                {generatingInsights ? "Generating..." : "Generate Insights"}
              </Button>
            </div>
          </SimpleCard>
        </div>
      </main>
    </div>
  );
}