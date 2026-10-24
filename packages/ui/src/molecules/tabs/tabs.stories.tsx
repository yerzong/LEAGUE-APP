import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';

const meta = { title: 'Molecules/Tabs', component: Tabs } satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

const panels = (
  <>
    <TabsList>
      <TabsTrigger value="standings">Tabla</TabsTrigger>
      <TabsTrigger value="schedule">Calendario</TabsTrigger>
      <TabsTrigger value="stats">Estadísticas</TabsTrigger>
    </TabsList>
    <TabsContent value="standings" className="text-sm text-text-muted">
      Tabla de posiciones.
    </TabsContent>
    <TabsContent value="schedule" className="text-sm text-text-muted">
      Próximas partidas.
    </TabsContent>
    <TabsContent value="stats" className="text-sm text-text-muted">
      Líderes por stat.
    </TabsContent>
  </>
);

export const Default: Story = { render: () => <Tabs defaultValue="standings">{panels}</Tabs> };

export const Line: Story = {
  render: () => (
    <Tabs defaultValue="standings">
      <TabsList variant="line">
        <TabsTrigger value="standings">Tabla</TabsTrigger>
        <TabsTrigger value="schedule">Calendario</TabsTrigger>
      </TabsList>
      <TabsContent value="standings" className="text-sm text-text-muted">
        Tabla de posiciones.
      </TabsContent>
      <TabsContent value="schedule" className="text-sm text-text-muted">
        Próximas partidas.
      </TabsContent>
    </Tabs>
  ),
};
