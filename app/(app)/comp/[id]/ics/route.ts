import { NextResponse } from "next/server";
import { getCompetition } from "@/lib/queries";
import { buildIcs } from "@/lib/ics";
import { compHeading } from "@/lib/games";

// Serves the tee time as a .ics so it lands in Apple/Google Calendar with its
// own alarm — the date then exists outside the app (§5).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comp = await getCompetition(id);
  if (!comp) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(buildIcs(comp), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${compHeading(comp).replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics"`,
    },
  });
}
