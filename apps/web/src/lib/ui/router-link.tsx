import type { RenderLink } from '@league/ui';
import Link from 'next/link';

/** `renderLink` for design-system components: client-side navigation with next/link. */
export const renderRouterLink: RenderLink = ({ href, ...props }) => <Link href={href} {...props} />;
