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
  ...(pollIntervalMs ? { watchOptions: { pollIntervalMs } } : {}),
  cacheComponents: true,
  partialPrefetching: true,
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
