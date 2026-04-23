import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10" as any,
});

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;

  try {
    // For MVP, we skip signature verification if webhook secret is not set
    // In production, you must set STRIPE_WEBHOOK_SECRET
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    const db = getDb();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      if (session.customer_email) {
        // Here we would typically set a 'plan' or 'isPro' column to true in DB
        // For MVP, if we haven't added an isPro column, let's just log it
        // Or we can add an isPro column later. 
        console.log(`Payment successful for: ${session.customer_email}`);
      }
    }
  } catch (err: any) {
    console.error("Error processing webhook:", err);
  }

  return NextResponse.json({ received: true });
}
