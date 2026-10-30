import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { listAchievements } from '@/features/stats/api';
import { AchievementsTable } from '@/features/stats/components/admin/achievements-table';

const t = messages.stats.admin.achievements;

export const metadata: Metadata = { title: t.title };

export default async function AdminAchievementsPage() {
  const result = await listAchievements();
  if (!result.ok) return <LoadError code={result.code} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.description} />
      <AchievementsTable items={result.data.items} />
    </div>
  );
}
