import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { brand } from '@/config/brand';
import { locale, messages } from '@/config/i18n';

import './globals.css';

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: messages.meta.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={locale}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
