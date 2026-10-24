import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table.js';

const meta = { title: 'Organisms/Table', component: Table } satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

const rows = [
  ['1', 'Halcones', '9'],
  ['2', 'Ajolotes', '6'],
  ['3', 'Jaguares', '3'],
];

export const Standings: Story = {
  render: () => (
    <Table className="w-96">
      <TableCaption>Fase regular</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Equipo</TableHead>
          <TableHead className="text-right">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([position, team, points]) => (
          <TableRow key={team}>
            <TableCell className="tabular">{position}</TableCell>
            <TableCell>{team}</TableCell>
            <TableCell className="text-right tabular">{points}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
