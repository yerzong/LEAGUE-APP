import type { Meta, StoryObj } from '@storybook/react-vite';

import { Kbd, KbdGroup } from './kbd.js';

const meta = { title: 'Atoms/Kbd', component: Kbd } satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = { args: { children: 'Esc' } };
export const Combination: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
};
