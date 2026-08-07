import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Hold recently-viewed tabs in the client router cache so switching back to
    // one is instant instead of refetching. Next's default for dynamic routes
    // is 0 (no caching) — this is the main reason tab-switching felt slow.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
