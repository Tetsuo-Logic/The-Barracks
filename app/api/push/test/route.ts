import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";

// "Send me a test notification" (§5) — essential for debugging on someone
// else's phone. Sends only to the caller.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await sendToPlayers([user.id], "results", {
    title: "The Threeball",
    body: "Notifications are working. You're all set.",
    url: "/",
    tag: "test",
  });

  return NextResponse.json({ ok: true });
}
