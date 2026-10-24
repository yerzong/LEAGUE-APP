import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

const meta = { title: 'Molecules/Popover', component: Popover } satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Detalle del rango</Button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Peak: Diamante II</span>
        <span className="text-text-muted">Actual: Esmeralda I · 64 LP</span>
      </PopoverContent>
    </Popover>
  ),
};
