import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label.js';

const meta = {
  title: 'Atoms/Label',
  component: Label,
  args: { children: 'Riot ID' },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
