import { cookies } from "next/headers";

// The CO can "preview as player" — a cookie that drops their admin/president
// powers in the UI so they see exactly what a normal player sees.
export async function previewingAsPlayer(): Promise<boolean> {
  const c = await cookies();
  return c.get("preview-player")?.value === "1";
}
