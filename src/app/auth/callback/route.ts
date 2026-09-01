import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") || "google";

  const redirectUrl = `${process.env.NEXT_PUBLIC_URL}/auth/callback?provider=${provider}`;

  try {
    if (provider === "google") {
      const actionCodeSettings = {
        url: redirectUrl,
        handleCodeInApp: true,
      };

      const link = await adminAuth.generateSignInWithEmailLink("user@example.com", actionCodeSettings);
      return NextResponse.redirect(link);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=auth_failed`);
  }
}

export async function POST(request: Request) {
  const { idToken, provider } = await request.json();

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    await adminDb.collection("users").doc(uid).set({
      provider,
      lastLogin: new Date().toISOString(),
    }, { merge: true });

    const response = NextResponse.json({ success: true });
    response.cookies.set("session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}