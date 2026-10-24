import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrophyIcon, UsersIcon } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command.js';

const meta = { title: 'Molecules/Command', component: Command } satisfies Meta<typeof Command>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Palette: Story = {
  render: () => (
    <Command className="w-96 rounded-md border">
      <CommandInput placeholder="Busca equipos, torneos..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Torneos">
          <CommandItem>
            <TrophyIcon /> Liga Temporada 1<CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Equipos">
          <CommandItem>
            <UsersIcon /> Halcones
          </CommandItem>
          <CommandItem>
            <UsersIcon /> Jaguares
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
