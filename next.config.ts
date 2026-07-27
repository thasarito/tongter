import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the Docker runtime stage stays small
  // and does not need node_modules or a package manager.
  output: "standalone",
};

export default nextConfig;
