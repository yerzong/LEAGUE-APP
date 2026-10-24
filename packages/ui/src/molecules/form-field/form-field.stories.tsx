import type { Meta, StoryObj } from '@storybook/react-vite';

import { FormField } from './form-field.js';

const meta = {
  title: 'Molecules/FormField',
  component: FormField,
  args: { label: 'Correo', type: 'email', placeholder: 'tu@correo.com' },
} satisfies Meta<typeof FormField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = { args: { hint: 'Te enviaremos un enlace.' } };

export const WithError: Story = { args: { error: 'Escribe un correo válido.' } };
