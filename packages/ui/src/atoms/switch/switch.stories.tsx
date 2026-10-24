import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from '../label/label.js';
import { Switch } from './switch.js';

const meta = { title: 'Atoms/Switch', component: Switch } satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="fearless" {...args} />
      <Label htmlFor="fearless">Draft Fearless</Label>
    </div>
  ),
};
export const On: Story = { args: { defaultChecked: true, 'aria-label': 'Activo' } };
export const Disabled: Story = { args: { disabled: true, 'aria-label': 'Bloqueado' } };
