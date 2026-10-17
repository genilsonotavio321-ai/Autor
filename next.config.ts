import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // O service worker atrapalha o desenvolvimento (cache de HMR); só roda no build.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // PWA offline-first via Serwist (plan §8.1).
};

export default withSerwist(nextConfig);
