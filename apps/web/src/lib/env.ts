// Public (browser-safe) configuration. NEXT_PUBLIC_* values are inlined at
// build time, so they must be provided when running `next build`.
// Never put secrets or database credentials here.
export const publicEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
} as const;
