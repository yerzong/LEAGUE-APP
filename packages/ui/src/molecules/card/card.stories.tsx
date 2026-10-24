import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../atoms/badge/badge.js';
import { Button } from '../../atoms/button/button.js';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card.js';

const meta = { title: 'Molecules/Card', component: Card } satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Match: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Jornada 3</CardTitle>
        <CardDescription>Sábado 20:00 · BO3</CardDescription>
        <CardAction>
          <Badge variant="league">Liga</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center justify-between font-display text-2xl font-bold caps">
        <span className="text-team-blue">HLC</span>
        <span className="text-text tabular">2 - 1</span>
        <span className="text-team-red">JAG</span>
      </CardContent>
      <CardFooter>
        <Button variant="secondary" size="sm" className="w-full">
          Ver partida
        </Button>
      </CardFooter>
    </Card>
  ),
};
