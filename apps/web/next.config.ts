import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root (apps/web -> ../..). Used by Turbopack to resolve hoisted
// workspace dependencies and by output tracing to build the standalone bundle.
const monorepoRoot = path.join(__dirname, "../..");

// Opt-in file polling for `next dev` inside Docker Desktop (Windows/macOS bind
// mounts do not propagate file events). Only set by the development compose.
const pollIntervalMs = Number(process.env.WATCH_POLL_INTERVAL_MS) || undefined;

const nextConfig: NextConfig = {
  // Self-contained server (.next/standalone) for the production Docker image.
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
  transpilePackages: ["@modaflow/ui"],
  ...(pollIntervalMs ? { watchOptions: { pollIntervalMs } } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        // Reset links carry a token in the query string: never leak it via Referer.
        source: "/restablecer-contrasena",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  turbopack: {
    root: monorepoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
