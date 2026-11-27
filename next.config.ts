import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // fotos dos serviços/salão (já chegam reduzidas pelo navegador)
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
