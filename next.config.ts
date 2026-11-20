import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development only: lets a phone on the same local Wi-Fi (192.168.x.x) use the
  // dev server. Has no effect on a deployed (production) build.
  allowedDevOrigins: ["192.168.*.*"],
  // Signed agreement scans are up to 10 MB; allow that plus form overhead.
  experimental: {
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
