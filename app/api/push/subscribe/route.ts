import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Store one PushSubscription per device (§3), upserting on endpoint so the
// re-subscribe on every launch is idempotent (§6.3).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sub = await request.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      player_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: request.headers.get("user-agent") ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
