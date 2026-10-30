import type { FormResult } from '@league/contracts';
import { FormGuide } from '@league/ui';

import { messages } from '@/config/i18n';

const f = messages.stats.form;

export function FormStrip({ results }: { results: readonly FormResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="caps text-xs text-text-muted">{f.title}</span>
      <FormGuide
        label={f.title}
        results={results}
        labels={{
          win: { short: f.win, long: f.winLabel },
          loss: { short: f.loss, long: f.lossLabel },
        }}
      />
    </div>
  );
}
