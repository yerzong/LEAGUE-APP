import { format } from '@league/i18n';
import { PublicFooter } from '@league/ui';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { BrandMark } from '@/features/shell/brand-mark';
import { renderRouterLink } from '@/lib/ui/router-link';

import { legalDocs } from '../legal';

const t = messages.footer;
const nav = messages.publicNav;

export function SiteFooter() {
  return (
    <PublicFooter
      brand={<BrandMark href="/" />}
      tagline={t.tagline}
      groups={[
        {
          title: t.explore,
          links: [
            { label: nav.tournaments, href: '/torneos' },
            { label: nav.teams, href: '/equipos' },
            { label: nav.players, href: '/jugadores' },
            { label: t.sponsor, href: '/patrocinadores' },
          ],
        },
        {
          title: t.legal,
          links: legalDocs.map((doc) => ({ label: doc.title, href: `/legal/${doc.slug}` })),
        },
        // League social accounts: placeholders until they exist.
        { title: t.community, links: t.social.map((label) => ({ label })) },
      ]}
      disclaimer={format(t.riotDisclaimer, { brand: brand.name })}
      legalLine={format(t.copyright, { year: new Date().getFullYear(), brand: brand.name })}
      labels={{ navigation: t.navigation, soon: nav.soon }}
      renderLink={renderRouterLink}
    />
  );
}
