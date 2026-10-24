import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { ErrorState } from './error-state.js';

const meta = {
  title: 'Organisms/ErrorState',
  component: ErrorState,
  args: {
    title: 'No pudimos cargar la tabla',
    description: 'Revisa tu conexión e inténtalo de nuevo.',
    action: <Button variant="secondary">Reintentar</Button>,
  },
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
