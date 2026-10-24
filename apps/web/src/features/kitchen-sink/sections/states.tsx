import { Button, EmptyState, ErrorState } from '@league/ui';
import { TrophyIcon } from 'lucide-react';

import { messages } from '@/config/i18n';

export function States() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <EmptyState
        icon={<TrophyIcon />}
        title="Aún no hay torneos"
        description="Crea el primero para abrir inscripciones."
        action={<Button>Crear torneo</Button>}
      />
      <ErrorState
        title="No pudimos cargar la tabla"
        description="Revisa tu conexión e inténtalo de nuevo."
        action={<Button variant="secondary">{messages.common.retry}</Button>}
      />
    </div>
  );
}
