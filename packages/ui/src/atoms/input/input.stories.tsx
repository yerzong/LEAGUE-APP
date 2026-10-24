import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './input.js';

const meta = {
  title: 'Atoms/Input',
  component: Input,
  args: { placeholder: 'Nombre del equipo', 'aria-label': 'Nombre del equipo' },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { 'aria-invalid': true, defaultValue: 'x' } };
export const Disabled: Story = { args: { disabled: true } };
