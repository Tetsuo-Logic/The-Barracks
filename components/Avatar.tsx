// Circle avatar — the one exception to the 3px radius (§4.2). Falls back to
// the player's initials on their ink colour when there's no photo.
export function Avatar({
  name,
  avatarUrl,
  colour = "#2F6B4C",
  size = 32,
}: {
  name: string;
  avatarUrl?: string | null;
  colour?: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    // Avatars are Supabase signed URLs that rotate; next/image's optimiser
    // buys nothing here and needs remotePatterns config. Plain <img> is right.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-narrow font-semibold text-paper"
      style={{
        width: size,
        height: size,
        backgroundColor: colour,
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
