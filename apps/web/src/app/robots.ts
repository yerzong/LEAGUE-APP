import type { MetadataRoute } from 'next';

import { publicEnv } from '@/config/public-env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/app', '/admin', '/auth'] },
    sitemap: new URL('/sitemap.xml', publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
  };
}
