/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@yge/shared', 'pdfjs-dist'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'app.youngge.com'] },
  },
};

export default nextConfig;
