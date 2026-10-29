import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from '@league/ui';
import { HeartIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { listMyFollows } from '@/features/stats/api';
import { FollowButton } from '@/features/stats/components/follow-button';
import { formatDate, initials } from '@/lib/ui/dates';

const t = messages.stats.follow;

export const metadata: Metadata = { title: t.page.title };

export default async function FollowingPage() {
  const result = await listMyFollows();
  if (!result.ok) return <LoadError code={result.code} />;
  const { items } = result.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.page.title} description={t.page.description} />
      <p className="text-xs text-text-muted">{t.privacy}</p>
      {items.length === 0 ? (
        <EmptyState icon={<HeartIcon />} title={t.page.empty} description={t.page.emptyHint} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={`${item.type}-${item.key}`}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <Avatar size="lg" className="rounded-md">
                    {item.imageUrl && (
                      <AvatarImage src={item.imageUrl} alt="" className="rounded-md" />
                    )}
                    <AvatarFallback className="rounded-md">{initials(item.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={item.href} className="truncate font-display text-lg">
                      {item.name}
                    </Link>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <Badge variant="blue">{t.page.types[item.type]}</Badge>
                      {format(t.page.since, { date: formatDate(item.followedAt) })}
                    </span>
                  </span>
                  <FollowButton
                    type={item.type}
                    targetKey={item.key}
                    name={item.name}
                    initial={{ followers: 0, following: true }}
                    compact
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
