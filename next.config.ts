import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  reactStrictMode: true,
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "puppeteer-extra-plugin-recaptcha",
  ],
  trailingSlash: false,
  images: {
    remotePatterns: [
      { hostname: "media.kitsu.app" },
      { hostname: "img.anili.st" },
    ],
  },
};

export default nextConfig;
