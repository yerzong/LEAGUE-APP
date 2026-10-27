import type { ReactNode } from 'react';

/** What a component hands to the app's router link (e.g. next/link). */
export interface LinkProps {
  href: string;
  children: ReactNode;
  className?: string | undefined;
  'aria-current'?: 'page' | undefined;
  onClick?: () => void;
  target?: string | undefined;
  rel?: string | undefined;
}

export type RenderLink = (props: LinkProps) => ReactNode;

export const defaultRenderLink: RenderLink = (props) => <a {...props} />;
