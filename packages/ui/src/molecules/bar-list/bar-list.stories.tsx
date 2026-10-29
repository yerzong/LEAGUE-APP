import type { Meta, StoryObj } from '@storybook/react-vite';

import { BarList } from './bar-list.js';

const meta = {
  title: 'Molecules/BarList',
  component: BarList,
  args: {
    label: 'Mejor KDA',
    items: [
      { key: '1', label: 'demo_tlaloc', value: 7.8, display: '7.8', hint: '8 games' },
      { key: '2', label: 'demo_quimera', value: 6.1, display: '6.1', hint: '8 games' },
      { key: '3', label: 'demo_axolote', value: 5.4, display: '5.4', hint: '6 games' },
      { key: '4', label: 'demo_zarape', value: 4.9, display: '4.9', hint: '7 games' },
    ],
  },
} satisfies Meta<typeof BarList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
