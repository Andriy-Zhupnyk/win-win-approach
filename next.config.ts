import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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

// Spec 0004 — wires up next-intl's Server Component plugin, which points
// at ./i18n/request.ts for per-request locale/message resolution.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
