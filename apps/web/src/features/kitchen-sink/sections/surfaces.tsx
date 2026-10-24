import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  GlassPanel,
} from '@league/ui';

import { demo } from '../demo-data';

export function Surfaces() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Jornada 3</CardTitle>
          <CardDescription>Sábado 20:00 · BO3</CardDescription>
          <CardAction>
            <Badge variant="league">Liga</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex items-center justify-between font-display text-3xl font-bold caps">
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

      {/* Glass is an accent: it needs something behind it to read as glass. */}
      <div className="relative overflow-hidden rounded-md border bg-surface-2 p-8">
        <div
          aria-hidden="true"
          className="absolute -top-10 -left-10 size-48 rounded-full bg-accent-flash/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -right-10 -bottom-12 size-48 rounded-full bg-team-blue/40 blur-3xl"
        />
        <GlassPanel className="relative flex flex-col gap-2">
          <Badge variant="flash">MVP de la jornada</Badge>
          <p className="font-display text-4xl font-extrabold text-text caps">{demo.mvp.player}</p>
          <p className="text-sm text-text-muted">{demo.mvp.team}</p>
          <p className="text-lg text-text tabular">
            {demo.mvp.kda} · {demo.mvp.kp}
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
