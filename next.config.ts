import type { NextConfig } from "next";

const config: NextConfig = {
  cacheComponents: true,
  distDir: process.env.SURO_ADMIN_PREVIEW === "1" ? ".next-admin-preview" : ".next",
  // background chooser (?bg) everywhere except the production deploy
  env: { BG_LAB: process.env.VERCEL_ENV === "production" ? "" : "1" },
  partialPrefetching: true,
  poweredByHeader: false,
  // basic hardening; no frames anywhere (the editor can't be clickjacked)
  headers: async () => [{
    source: "/:path*",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ],
  }],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.convex.cloud", pathname: "/api/storage/**" }],
    minimumCacheTTL: 31536000, // storage ids are immutable: a new photo is a new URL
  },
};

export default config;
