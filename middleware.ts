import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Headquarters is the widescreen interface over the same Barracks platform. It
// lives at /hq inside this app (same auth, same Supabase, same domain layer),
// and we run a second dev server on :3001 for it. This rewrite makes the root
// of :3001 land on Headquarters instead of the mobile board — port-guarded, so
// nothing about the mobile app on :3000 changes.
const HQ_PORT = "3001";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isHqOrigin = host.endsWith(`:${HQ_PORT}`);

  if (isHqOrigin && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/hq";
    return NextResponse.rewrite(url);
  }

  return updateSession(request);
}

export const config = {
  // Run on everything except static assets, the service worker and icons.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
