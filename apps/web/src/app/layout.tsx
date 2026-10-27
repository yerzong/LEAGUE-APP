import { Toaster, TooltipProvider } from '@league/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { brand } from '@/config/brand';
import { locale, messages } from '@/config/i18n';
import { publicEnv } from '@/config/public-env';
import { baseOpenGraph } from '@/features/site/metadata';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: messages.meta.description,
  applicationName: brand.name,
  openGraph: { ...baseOpenGraph, title: brand.name, description: messages.meta.description },
  twitter: { card: 'summary' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={locale}>
      <body className="min-h-dvh antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
