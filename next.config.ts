import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Pins the workspace root so a stray lockfile in a parent directory cannot
  // change how modules are resolved.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
