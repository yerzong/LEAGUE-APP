import type { Meta, StoryObj } from '@storybook/react-vite';

import { Bracket } from './bracket.js';

const meta = {
  title: 'Organisms/Bracket',
  component: Bracket,
  args: {
    label: 'Bracket del relámpago',
    rounds: [
      {
        id: 'r1',
        title: 'Cuartos',
        matches: [
          {
            id: 'q1',
            a: { name: 'Aurora', tag: 'AUR', score: 1, winner: true },
            b: { name: 'Duna', tag: 'DUN', score: 0 },
            meta: 'Finalizado',
          },
          {
            id: 'q2',
            a: { name: 'Boreal', tag: 'BOR', score: 0 },
            b: { name: 'Cénit', tag: 'CEN', score: 1, winner: true },
            meta: 'Finalizado',
          },
          {
            id: 'q3',
            a: { name: 'Eclipse', tag: 'ECL' },
            b: { name: 'Fénix', tag: 'FNX' },
            meta: 'En vivo',
            live: true,
          },
          {
            id: 'q4',
            a: { name: 'Granito', tag: 'GRA' },
            b: { name: 'Halcón', tag: 'HAL' },
            meta: 'Sáb 14:00',
          },
        ],
      },
      {
        id: 'r2',
        title: 'Semifinales',
        matches: [
          {
            id: 's1',
            a: { name: 'Aurora', tag: 'AUR' },
            b: { name: 'Cénit', tag: 'CEN' },
            meta: 'Sáb 16:00',
          },
          {
            id: 's2',
            a: { name: 'Ganador C3', placeholder: true },
            b: { name: 'Ganador C4', placeholder: true },
          },
        ],
      },
      {
        id: 'r3',
        title: 'Final',
        matches: [
          {
            id: 'f',
            a: { name: 'Ganador S1', placeholder: true },
            b: { name: 'Ganador S2', placeholder: true },
          },
        ],
      },
    ],
  },
} satisfies Meta<typeof Bracket>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
