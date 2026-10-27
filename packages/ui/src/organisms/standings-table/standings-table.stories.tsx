import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../atoms/badge/badge.js';
import { StandingsTable } from './standings-table.js';

const meta = {
  title: 'Organisms/StandingsTable',
  component: StandingsTable,
  args: {
    caption: 'Grupo A',
    rankLabel: '#',
    entrantLabel: 'Equipo',
    columns: [
      { key: 'played', label: 'PJ', title: 'Jugados' },
      { key: 'wins', label: 'G', title: 'Ganados' },
      { key: 'losses', label: 'P', title: 'Perdidos' },
      { key: 'diff', label: 'DIF', title: 'Diferencia de partidas' },
      { key: 'points', label: 'PTS', title: 'Puntos' },
    ],
    rows: [
      {
        id: 'a',
        rank: 1,
        entrant: 'Aurora',
        values: [3, 2, 1, '+2', 6],
        status: <Badge variant="success">Clasificado</Badge>,
        note: 'Desempate: resultado directo',
        highlight: 'qualified',
      },
      {
        id: 'b',
        rank: 2,
        entrant: 'Boreal',
        values: [3, 2, 1, '+1', 6],
        status: <Badge variant="success">Clasificado</Badge>,
        note: 'Desempate: resultado directo',
        highlight: 'qualified',
      },
      { id: 'c', rank: 3, entrant: 'Cénit', values: [3, 1, 2, '-1', 3], highlight: 'eliminated' },
      { id: 'd', rank: 4, entrant: 'Duna', values: [3, 1, 2, '-2', 3], highlight: 'eliminated' },
    ],
  },
} satisfies Meta<typeof StandingsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
