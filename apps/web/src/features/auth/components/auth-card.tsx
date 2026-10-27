import type { ReactNode } from 'react';

export interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex flex-1 flex-col px-4">
      <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-12">
        <header className="text-center">
          <h1 className="font-display text-3xl font-extrabold uppercase text-brand">{title}</h1>
          <p className="mt-1 text-text-muted">{subtitle}</p>
        </header>
        <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-md">
          {children}
        </div>
        <p className="text-center text-sm text-text-muted">{footer}</p>
      </section>
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase text-text-muted">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
