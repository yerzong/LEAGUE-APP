import type { ApiHealth } from '../api/get-api-health';

export interface ApiStatusProps {
  status: ApiHealth;
  label: string;
  statusLabels: Readonly<Record<ApiHealth, string>>;
}

const dotClass: Record<ApiHealth, string> = {
  ok: 'bg-success',
  degraded: 'bg-warning',
  down: 'bg-danger',
  unreachable: 'bg-danger',
};

export function ApiStatus({ status, label, statusLabels }: ApiStatusProps) {
  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 text-sm text-text-muted"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${dotClass[status]}`} />
      {`${label}: ${statusLabels[status]}`}
    </p>
  );
}
