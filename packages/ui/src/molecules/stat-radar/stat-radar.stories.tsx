import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatRadar } from './stat-radar.js';

const axes = [
  { key: 'aggression', label: 'Agresividad', value: 72 },
  { key: 'vision', label: 'Visión', value: 41 },
  { key: 'farming', label: 'Farm', value: 86 },
  { key: 'teamfight', label: 'Teamfight', value: 64 },
  { key: 'survival', label: 'Supervivencia', value: 58 },
];

const meta = {
  title: 'Molecules/StatRadar',
  component: StatRadar,
  args: { axes, label: 'Radar de demo_tlaloc' },
} satisfies Meta<typeof StatRadar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HeadToHead: Story = {
  args: { compare: { label: 'demo_quimera', values: [55, 70, 60, 80, 45] } },
};
