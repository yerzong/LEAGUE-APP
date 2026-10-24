import type { Meta, StoryObj } from '@storybook/react-vite';

import { Uploader } from './uploader.js';

const meta = {
  title: 'Molecules/Uploader',
  component: Uploader,
  args: {
    label: 'Foto de perfil',
    hint: 'PNG, JPG o WebP de hasta 2 MB.',
    accept: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 2 * 1024 * 1024,
    previewUrl: null,
    fallback: 'AN',
    labels: {
      choose: 'Elegir imagen',
      tooLarge: 'La imagen pesa más de 2 MB.',
      invalidType: 'Usa PNG, JPG o WebP.',
    },
    onSelect: () => new Promise((resolve) => setTimeout(resolve, 800)),
  },
} satisfies Meta<typeof Uploader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Avatar: Story = {};

export const TeamLogo: Story = {
  args: { label: 'Logo del equipo', fallback: 'AUR', shape: 'square' },
};
