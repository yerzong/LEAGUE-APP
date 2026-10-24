import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { FormField } from '../form-field/form-field.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog.js';

const meta = { title: 'Molecules/Dialog', component: Dialog } satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Form: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Crear equipo</Button>
      </DialogTrigger>
      <DialogContent closeLabel="Cerrar">
        <DialogHeader>
          <DialogTitle>Nuevo equipo</DialogTitle>
          <DialogDescription>Podrás invitar jugadores después.</DialogDescription>
        </DialogHeader>
        <FormField label="Nombre" placeholder="Halcones" />
        <FormField label="Tag" placeholder="HLC" maxLength={4} />
        <DialogFooter closeLabel="Cancelar">
          <Button>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
