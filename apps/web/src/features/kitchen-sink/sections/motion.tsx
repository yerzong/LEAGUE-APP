import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  FadeIn,
  SlideUp,
  Stagger,
  StaggerItem,
} from '@league/ui';
import { useState } from 'react';

import { demoTeams } from '../demo-data';

export function MotionDemo() {
  const [run, setRun] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Con «reducir movimiento» activo en el sistema, todo se muestra sin animación.
      </p>
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRun((count) => count + 1);
          }}
        >
          Repetir animaciones
        </Button>
      </div>
      <div key={run} className="grid items-start gap-4 md:grid-cols-3">
        <FadeIn className="rounded-md border bg-surface p-4 text-sm">FadeIn</FadeIn>
        <SlideUp className="rounded-md border bg-surface p-4 text-sm">SlideUp</SlideUp>
        <Stagger className="flex flex-col gap-2">
          {demoTeams.slice(0, 4).map((team) => (
            <StaggerItem key={team.id}>
              <Card className="py-3">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{team.name}</CardTitle>
                </CardHeader>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
