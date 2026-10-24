import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from '../label/label.js';
import { RadioGroup, RadioGroupItem } from './radio-group.js';

const meta = { title: 'Atoms/RadioGroup', component: RadioGroup } satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

const roles = ['Top', 'Jungla', 'Mid', 'ADC', 'Support'];

export const Roles: Story = {
  render: () => (
    <RadioGroup defaultValue="Mid" aria-label="Rol principal">
      {roles.map((role) => (
        <div key={role} className="flex items-center gap-2">
          <RadioGroupItem value={role} id={`role-${role}`} />
          <Label htmlFor={`role-${role}`}>{role}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};
