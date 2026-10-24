import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu.js';

const meta = { title: 'Molecules/DropdownMenu', component: DropdownMenu } satisfies Meta<
  typeof DropdownMenu
>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Actions: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Acciones</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Partida</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Reprogramar <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Reportar resultado</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Anular</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
