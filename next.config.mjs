/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['better-sqlite3', 'pdf-parse', 'imapflow', 'mailparser'],
  },
};

export default nextConfig;
