'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Mount once per app. Colors come from tokens (see `[data-sonner-toaster]` in styles). */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'font-body shadow-lg',
          title: 'font-semibold',
          description: 'text-text-muted',
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
