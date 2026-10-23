import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4">{children}</main>;
}
