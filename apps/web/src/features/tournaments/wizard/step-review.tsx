'use client';

import type { TournamentConfig, TournamentDetail } from '@league/contracts';
import { Button, ConfirmDialog, toast } from '@league/ui';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';

import { runTournamentAction } from '../actions';
import { RulebookEditor } from '../components/rulebook-editor';
import { SaveTemplate } from '../components/save-template';
import { StructurePreview } from '../components/structure-preview';
import { formatDateTime, phaseDetail, ruleSummary } from '../format';
import { Group } from './fields';

const t = messages.tournaments;
const r = t.wizard.review;
const o = t.options;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-2 sm:grid-cols-3">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm text-text sm:col-span-2">{children}</dd>
    </div>
  );
}

function Summary({ config }: { config: TournamentConfig }) {
  const tz = config.basics.timezone;
  const when = (iso: string | null) => (iso ? formatDateTime(iso, tz) : '—');
  return (
    <dl>
      <Row label={t.sections.basics}>
        {config.basics.name} · {o.types[config.basics.type]} · {o.tiers[config.basics.tier]}
      </Row>
      <Row label={t.sections.participants}>
        {o.entrantKinds[config.participants.entrantKind]} ·{' '}
        {o.modalities[config.participants.modality]} ·{' '}
        {config.capacity.capacity ?? t.tracking.summary.unlimited}
      </Row>
      <Row label={t.sections.game}>
        {config.game.teamSize}v{config.game.teamSize} · {o.maps[config.game.map]} ·{' '}
        {o.pickTypes[config.game.pickType]}
      </Row>
      <Row label={t.sections.eligibility}>
        <ul className="flex flex-col gap-1">
          <li>{t.exclusivitySummary[config.eligibility.exclusivityScope]}</li>
          {config.eligibility.rules.map((rule) => (
            <li key={rule.type}>{ruleSummary(rule)}</li>
          ))}
        </ul>
      </Row>
      <Row label={t.sections.format}>
        <ol className="flex flex-col gap-1">
          {config.format.phases.map((phase, i) => (
            <li key={String(i)}>
              {i + 1}. {phase.name}: {phaseDetail(phase)}
            </li>
          ))}
        </ol>
      </Row>
      <Row label={t.sections.schedule}>
        {when(config.schedule.registrationOpensAt)} → {when(config.schedule.registrationClosesAt)} ·{' '}
        {when(config.schedule.startsAt)}
      </Row>
      <Row label={t.sections.supervision}>{o.supervision[config.supervision.level]}</Row>
      <Row label={t.sections.prizes}>
        {config.prizes.hasPrizes
          ? (config.prizes.poolSummary ?? String(config.prizes.items.length))
          : t.wizard.prizes.none}
      </Row>
    </dl>
  );
}

export function ReviewStep({
  detail,
  config,
  dirty,
}: {
  detail: TournamentDetail | null;
  /** Current values of the form, when they pass the schema. */
  config: TournamentConfig | null;
  dirty: boolean;
}) {
  const router = useRouter();
  const isDraft = detail?.status === 'draft';
  return (
    <div className="flex flex-col gap-6">
      <p className="text-text-muted">{r.description}</p>
      {config && (
        <Group title={r.summary}>
          <Summary config={config} />
        </Group>
      )}
      <Group title={r.preview}>
        {!detail ? (
          <p className="text-sm text-text-muted">{r.saveFirst}</p>
        ) : dirty ? (
          <p className="text-sm text-text-muted">{r.previewUnsaved}</p>
        ) : (
          <StructurePreview config={detail.config} preview={detail.preview} />
        )}
      </Group>
      {detail && (
        <Group title={r.rulebook}>
          <RulebookEditor detail={detail} />
        </Group>
      )}
      {detail && isDraft && (
        <Group title={detail.publishIssues.length > 0 ? r.missing : r.ready}>
          {detail.publishIssues.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {detail.publishIssues.map((issue) => (
                <li key={issue} className="flex items-start gap-2 text-danger">
                  <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {(t.publishIssues as Readonly<Record<string, string>>)[issue] ?? issue}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-success">
              <CircleCheckIcon aria-hidden className="size-4" /> {r.ready}
            </p>
          )}
          <div>
            <ConfirmDialog
              trigger={
                <Button type="button" size="lg" disabled={dirty || detail.publishIssues.length > 0}>
                  {t.actions.publish}
                </Button>
              }
              title={t.actionConfirm.publish.title}
              description={t.actionConfirm.publish.description}
              confirmLabel={t.actions.publish}
              cancelLabel={messages.common.cancel}
              onConfirm={async () => {
                const result = await runTournamentAction(detail.id, 'publish', null);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(r.published);
                router.push(`/admin/torneos/${detail.id}`);
              }}
            />
          </div>
        </Group>
      )}
      {detail && !isDraft && (
        <div>
          <Button asChild variant="outline">
            <Link href={`/admin/torneos/${detail.id}`}>{r.openTracking}</Link>
          </Button>
        </div>
      )}
      {config && (
        <Group title={r.saveAsTemplate}>
          <SaveTemplate config={config} />
        </Group>
      )}
    </div>
  );
}
