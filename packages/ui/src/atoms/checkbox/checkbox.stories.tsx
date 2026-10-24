import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from '../label/label.js';
import { Checkbox } from './checkbox.js';

const meta = { title: 'Atoms/Checkbox', component: Checkbox } satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" {...args} />
      <Label htmlFor="terms">Acepto el reglamento</Label>
    </div>
  ),
};
export const Checked: Story = { args: { defaultChecked: true, 'aria-label': 'Activo' } };
export const Disabled: Story = { args: { disabled: true, 'aria-label': 'Bloqueado' } };
