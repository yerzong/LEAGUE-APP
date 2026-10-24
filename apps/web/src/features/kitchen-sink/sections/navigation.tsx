import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@league/ui';

import { messages } from '@/config/i18n';

const { dataTable } = messages;

export function Navigation() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Tabs defaultValue="standings">
          <TabsList>
            <TabsTrigger value="standings">Tabla</TabsTrigger>
            <TabsTrigger value="schedule">Calendario</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
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
        </Tabs>
        <Tabs defaultValue="groups">
          <TabsList variant="line">
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
          </TabsList>
          <TabsContent value="groups" className="text-sm text-text-muted">
            Fase de grupos.
          </TabsContent>
          <TabsContent value="playoffs" className="text-sm text-text-muted">
            Eliminación directa.
          </TabsContent>
        </Tabs>
      </div>
      <Pagination label="Paginación" className="justify-start">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" label={dataTable.previousPage} />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis label="Más páginas" />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" label={dataTable.nextPage} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
