import type { Meta, StoryObj } from '@storybook/react-vite';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.js';

const meta = { title: 'Atoms/Select', component: Select } satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Region: Story = {
  render: () => (
    <Select defaultValue="lan">
      <SelectTrigger className="w-56" aria-label="Región">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="lan">LAN</SelectItem>
        <SelectItem value="las">LAS</SelectItem>
        <SelectItem value="na">NA</SelectItem>
      </SelectContent>
    </Select>
  ),
};
export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-56" aria-label="Región">
        <SelectValue placeholder="Elige región" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="lan">LAN</SelectItem>
      </SelectContent>
    </Select>
  ),
};
