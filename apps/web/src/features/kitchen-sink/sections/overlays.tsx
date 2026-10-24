import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FormField,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  toast,
} from '@league/ui';
import { TrophyIcon, UsersIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { messages } from '@/config/i18n';

import { demoTeams } from '../demo-data';
import { Row } from './section';

const { common } = messages;

function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        Paleta de comandos <Kbd>⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Paleta de comandos"
        description="Busca equipos y torneos"
      >
        <CommandInput placeholder="Busca equipos, torneos..." />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup heading="Torneos">
            <CommandItem>
              <TrophyIcon /> Liga Temporada 1
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Equipos">
            {demoTeams.slice(0, 5).map((team) => (
              <CommandItem key={team.id}>
                <UsersIcon /> {team.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function Overlays() {
  return (
    <Row>
      <Dialog>
        <DialogTrigger asChild>
          <Button>Dialog</Button>
        </DialogTrigger>
        <DialogContent closeLabel={common.close}>
          <DialogHeader>
            <DialogTitle>Nuevo equipo</DialogTitle>
            <DialogDescription>Podrás invitar jugadores después.</DialogDescription>
          </DialogHeader>
          <FormField label="Nombre" placeholder="Halcones" />
          <DialogFooter closeLabel={common.cancel}>
            <Button>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="secondary">AlertDialog</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar inscripciones?</AlertDialogTitle>
            <AlertDialogDescription>Los equipos ya no podrán registrarse.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <AlertDialogAction>Cerrar inscripciones</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog
        trigger={<Button variant="destructive">ConfirmDialog con motivo</Button>}
        title="¿Anular el resultado?"
        description="La partida vuelve a pendiente y la acción queda en auditoría."
        confirmLabel="Anular resultado"
        cancelLabel={common.cancel}
        destructive
        reason={{
          label: 'Motivo',
          hint: 'Mínimo 10 caracteres.',
          placeholder: 'Error al capturar el marcador',
        }}
        onConfirm={(reason) => {
          toast.success('Resultado anulado', { description: reason ?? undefined });
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Dropdown</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Partida</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Reprogramar</DropdownMenuItem>
          <DropdownMenuItem>Reportar resultado</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Anular</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary">Popover</Button>
        </PopoverTrigger>
        <PopoverContent className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Peak: Diamante II</span>
          <span className="text-text-muted">Actual: Esmeralda I · 64 LP</span>
        </PopoverContent>
      </Popover>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Sheet</Button>
        </SheetTrigger>
        <SheetContent closeLabel={common.close}>
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Circuito, temporada y estado.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>

      <CommandPalette />

      <Button
        variant="secondary"
        onClick={() => toast.success('Resultado confirmado', { description: 'HLC 2 - 1 JAG' })}
      >
        Toast éxito
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.error('No se pudo guardar', { description: 'Inténtalo de nuevo.' })}
      >
        Toast error
      </Button>
    </Row>
  );
}
