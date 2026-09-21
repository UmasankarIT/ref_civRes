/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-mounting map containers in dev
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
