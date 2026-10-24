import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Checkbox,
  FormField,
  Input,
  Kbd,
  KbdGroup,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Spinner,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@league/ui';
import { PlusIcon, TrashIcon } from 'lucide-react';

import { messages } from '@/config/i18n';

import { demo } from '../demo-data';
import { Row } from './section';

export function Buttons() {
  return (
    <div className="flex flex-col gap-4">
      <Row>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Row>
      <Row>
        <Button size="xs">xs</Button>
        <Button size="sm">sm</Button>
        <Button size="md">md</Button>
        <Button size="lg">lg</Button>
        <Button>
          <PlusIcon /> Crear torneo
        </Button>
        <Button size="icon" variant="secondary" aria-label="Eliminar">
          <TrashIcon />
        </Button>
        <Button disabled>Disabled</Button>
      </Row>
    </div>
  );
}

export function Forms() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <FormField label="Nombre del equipo" placeholder="Halcones" />
        <FormField label="Tag" hint="De 2 a 4 caracteres." placeholder="HLC" />
        <FormField
          label="Riot ID"
          error="Ese Riot ID ya está vinculado."
          defaultValue="Faker#KR1"
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="ks-bio">Biografía</Label>
          <Textarea id="ks-bio" placeholder="Cuéntanos de tu equipo" />
        </div>
        <Input aria-label="Deshabilitado" placeholder="Deshabilitado" disabled />
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>Región</Label>
          <Select defaultValue="LAN">
            <SelectTrigger className="w-full" aria-label="Región">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {demo.regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3">
          <Label>Rol principal</Label>
          <RadioGroup defaultValue="Mid" aria-label="Rol principal">
            {demo.roles.map((role) => (
              <div key={role} className="flex items-center gap-2">
                <RadioGroupItem id={`ks-role-${role}`} value={role} />
                <Label htmlFor={`ks-role-${role}`}>{role}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="ks-terms" defaultChecked />
          <Label htmlFor="ks-terms">Acepto el reglamento</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ks-fearless" defaultChecked />
          <Label htmlFor="ks-fearless">Draft Fearless</Label>
        </div>
      </div>
    </div>
  );
}

export function Indicators() {
  return (
    <div className="flex flex-col gap-4">
      <Row>
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">Victoria</Badge>
        <Badge variant="warning">Check-in por cerrar</Badge>
        <Badge variant="danger">Descalificado</Badge>
        <Badge variant="blue">Lado azul</Badge>
        <Badge variant="red">Lado rojo</Badge>
      </Row>
      <Row>
        <Avatar>
          <AvatarFallback>FK</AvatarFallback>
        </Avatar>
        <Avatar className="size-12">
          <AvatarFallback>HLC</AvatarFallback>
        </Avatar>
        <Separator orientation="vertical" className="h-8" />
        <Spinner label={messages.common.loading} />
        <Spinner label={messages.common.loading} className="size-6 text-brand" />
        <Separator orientation="vertical" className="h-8" />
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm">
              KP
            </Button>
          </TooltipTrigger>
          <TooltipContent>Participación en kills</TooltipContent>
        </Tooltip>
      </Row>
      <div className="flex w-72 items-center gap-3">
        <Skeleton className="size-12 rounded-sm" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
