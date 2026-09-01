"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/u/button";

function SimpleCard({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border p-6 ${className || ""}`}>
      {title && <h3 className="text-lg font-medium mb-4">{title}</h3>}
      <div className="">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [insights, setInsights] = useState<string | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const accountsRef = collection(db, "users", user.uid, "accounts");
    const accountsQuery = query(accountsRef, orderBy("connectedAt", "desc"));

    const unsubscribe = onSnapshot(accountsQuery, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accountsData);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const sessionsRef = collection(db, "users", user.uid, "doomscrollSessions");
    const sessionsQuery = query(sessionsRef, orderBy("timestamp", "desc"), limit(10));

    const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(sessionsData);
    });

    return unsubscribe;
  }, [user]);

  const generateInsights = async () => {
    if (!user) return;
    setGeneratingInsights(true);

    try {
      const res = await fetch("/api/personal/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          dataTypes: ["github", "youtube", "strava", "doomscroll"],
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SimpleCard title="Sign In Required">
          <p className="text-center">Please sign in to view your dashboard.</p>
          <div className="mt-4 text-center">
            <Button onClick={() => window.location.href = "/login"}>Sign In</Button>
          </div>
        </SimpleCard>
      </div>
    );
  }

  const totalDoomscrollMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const totalSessions = sessions.length;
  const doomscrollHours = Math.round(totalDoomscrollMinutes / 60);
  const accountTypes = accounts.reduce((acc: any, a: any) => {
    acc[a.provider] = (acc[a.provider] || 0) + 1;
    return acc;
  }, {});

  const githubCount = accountTypes?.github || 0;
  const googleCount = accountTypes?.google || 0;
  const stravaCount = accountTypes?.strava || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex bg-primary/10 border-b border-primary/20 p-4">
        <div className="flex-1 text-primary">NextAgent</div>
        <div className="flex space-x-4">
          {accounts.map((account: any) => (
            <span key={account.id} className="text-sm opacity-70">
              {account.provider}: connected
            </span>
          ))}
        </div>
      </header>

      <main className="p-6">
        <SimpleCard title="Your Profile">
          <p className="mt-2">{user.displayName || user.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">Member since {user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "Unknown"}</p>
        </SimpleCard>

        {accounts.length > 0 && (
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

        {sessions.length > 0 && (
          <SimpleCard title="Recent Doomscroll Sessions">
            <div className="space-y-2">
              {sessions.slice(0, 5).map((session: any) => (
                <div key={session.id} className="p-2 rounded bg-gray-50">
                  <div className="text-xs">{session.appsUsed?.join(", ") || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(session.timestamp).toLocaleDateString()}</div>
                  <div className="mt-1">
                    <span className="text-primary font-medium">{session.durationMinutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          </SimpleCard>
        )}

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
                onClick={generateInsights}
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