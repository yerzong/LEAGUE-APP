import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Always defined, so the dev-tools flag is inlined as a literal and, when it is
  // not "true", the autofill chunks are dropped from the build (docs/specs/m0dev).
  env: { NEXT_PUBLIC_DEV_TOOLS: process.env.NEXT_PUBLIC_DEV_TOOLS ?? 'false' },
};

export default nextConfig;
