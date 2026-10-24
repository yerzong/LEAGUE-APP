import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet.js';

const meta = { title: 'Molecules/Sheet', component: Sheet } satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">Filtros</Button>
      </SheetTrigger>
      <SheetContent closeLabel="Cerrar">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Circuito, temporada y estado.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
