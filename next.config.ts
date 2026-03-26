import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // PWA manifest served as static file — handled by public/manifest.json
  experimental: {
    // React 19 + Next 15 stable features
  },
};

export default withNextIntl(nextConfig);
