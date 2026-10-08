/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // wagmi/RainbowKit requieren transpilación explícita para algunos navegadores
    transpilePackages: ["@rainbow-me/rainbowkit"],
};

export default nextConfig;
