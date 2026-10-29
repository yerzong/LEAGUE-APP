import type { Meta, StoryObj } from '@storybook/react-vite';

import { FormGuide } from './form-guide.js';

const meta = {
  title: 'Molecules/FormGuide',
  component: FormGuide,
  args: {
    label: 'Forma reciente',
    results: ['win', 'win', 'loss', 'win', 'loss'],
    labels: { win: { short: 'V', long: 'Victoria' }, loss: { short: 'D', long: 'Derrota' } },
  },
} satisfies Meta<typeof FormGuide>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
