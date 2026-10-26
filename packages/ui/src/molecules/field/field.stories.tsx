import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../atoms/select/select.js';
import { Textarea } from '../../atoms/textarea/textarea.js';
import { Field } from './field.js';

const meta = {
  title: 'Molecules/Field',
  component: Field,
  args: {
    label: 'Biografía',
    hint: 'Máximo 280 caracteres.',
    children: (control) => <Textarea {...control} placeholder="Cuéntanos de ti" />,
  },
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithTextarea: Story = {};

export const WithError: Story = { args: { error: 'La biografía es demasiado larga.' } };

export const WithSelect: Story = {
  args: {
    label: 'Rol principal',
    hint: undefined,
    children: (control) => (
      <Select>
        <SelectTrigger {...control} className="w-full">
          <SelectValue placeholder="Elige un rol" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mid">Medio</SelectItem>
          <SelectItem value="jungle">Jungla</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
};
