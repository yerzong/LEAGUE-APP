import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { toast, Toaster } from './toaster.js';

const meta = { title: 'Molecules/Toast', component: Toaster } satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button variant="secondary" onClick={() => toast('Calendario publicado')}>
        Normal
      </Button>
      <Button variant="secondary" onClick={() => toast.success('Resultado confirmado')}>
        Éxito
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.error('No se pudo guardar', { description: 'Inténtalo de nuevo.' })}
      >
        Error
      </Button>
    </div>
  ),
};
