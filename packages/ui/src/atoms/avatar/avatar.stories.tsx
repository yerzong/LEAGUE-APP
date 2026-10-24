import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar, AvatarFallback, AvatarImage } from './avatar.js';

const meta = { title: 'Atoms/Avatar', component: Avatar } satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>FK</AvatarFallback>
    </Avatar>
  ),
};
export const BrokenImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/no-existe.png" alt="Faker" />
      <AvatarFallback>FK</AvatarFallback>
    </Avatar>
  ),
};
