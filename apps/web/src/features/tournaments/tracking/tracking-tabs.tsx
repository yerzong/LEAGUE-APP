'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@league/ui';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

export interface TrackingTab {
  id: string;
  label: string;
  content: ReactNode;
}

/** Tabs of the event page; the active one lives in `?tab=` so it survives a refresh. */
export function TrackingTabs({ tabs, initial }: { tabs: TrackingTab[]; initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      defaultValue={initial}
      onValueChange={(value) => {
        router.replace(`${pathname}?tab=${value}`, { scroll: false });
      }}
      className="flex flex-col gap-6"
    >
      <div className="overflow-x-auto">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="flex flex-col gap-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
