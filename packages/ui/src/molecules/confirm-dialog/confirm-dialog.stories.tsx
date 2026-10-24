import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { ConfirmDialog } from './confirm-dialog.js';

const meta = {
  title: 'Molecules/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    trigger: <Button variant="destructive">Anular resultado</Button>,
    title: '¿Anular el resultado?',
    description: 'La partida vuelve a "pendiente" y la acción queda en auditoría.',
    confirmLabel: 'Anular',
    cancelLabel: 'Cancelar',
    destructive: true,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithMandatoryReason: Story = {
  args: {
    reason: {
      label: 'Motivo',
      hint: 'Mínimo 10 caracteres. Lo verán los capitanes.',
      placeholder: 'Ej. error al capturar el marcador',
    },
  },
};
export const WithoutReason: Story = {
  args: {
    trigger: <Button variant="secondary">Publicar calendario</Button>,
    title: '¿Publicar el calendario?',
    description: 'Se notificará a todos los equipos.',
    confirmLabel: 'Publicar',
    destructive: false,
  },
};
