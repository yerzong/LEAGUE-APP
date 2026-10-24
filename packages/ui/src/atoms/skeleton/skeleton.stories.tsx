import type { Meta, StoryObj } from '@storybook/react-vite';

import { Skeleton } from './skeleton.js';

const meta = { title: 'Atoms/Skeleton', component: Skeleton } satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MatchCard: Story = {
  render: () => (
    <div className="flex w-72 items-center gap-3">
      <Skeleton className="size-12 rounded-sm" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  ),
};
