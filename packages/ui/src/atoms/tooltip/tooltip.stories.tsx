import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../button/button.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip.js';

const meta = { title: 'Atoms/Tooltip', component: Tooltip } satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="secondary">KP</Button>
        </TooltipTrigger>
        <TooltipContent>Participación en kills</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
