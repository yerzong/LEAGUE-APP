import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from './textarea.js';

const meta = {
  title: 'Atoms/Textarea',
  component: Textarea,
  args: { placeholder: 'Describe la disputa', 'aria-label': 'Descripción' },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { 'aria-invalid': true } };
