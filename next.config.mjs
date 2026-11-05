/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next's request log prints full URLs, and the OAuth callback's URL holds the
  // authorization code. Codes must never be logged.
  logging: { incomingRequests: false },
};
export default nextConfig;
