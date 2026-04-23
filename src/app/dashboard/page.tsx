import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Check if user is pro (dummy check for MVP, can hook to stripe later)
  const isPro = false;

  return <DashboardClient user={session.user} isPro={isPro} />;
}
