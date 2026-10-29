import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows Playwright (running against the dev server on 127.0.0.1) to load
  // HMR resources without the cross-origin warning.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
