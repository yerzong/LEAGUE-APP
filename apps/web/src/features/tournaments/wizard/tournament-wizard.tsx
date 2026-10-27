'use client';

// Tournament creation wizard (docs/14 §3.1). The whole configuration is one
// form validated by TournamentConfigSchema; it can be saved as a draft at any
// step. After publishing, each section follows the edit policy of
// packages/core (free, confirm with notice, locked) that the API returns.

import { zodResolver } from '@hookform/resolvers/zod';
import {
  IMAGE_UPLOAD,
  TournamentConfigSchema,
  type TournamentConfig,
  type TournamentConfigInput,
  type TournamentDetail,
  type TournamentSection,
} from '@league/contracts';
import { format } from '@league/i18n';
import { Button, ConfirmDialog, toast, Uploader, Wizard } from '@league/ui';
import { CircleAlertIcon, LockIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useWatch, type FieldErrors } from 'react-hook-form';

import { messages } from '@/config/i18n';

import { createTournament, updateTournament, uploadTournamentCover } from '../actions';
import { isWizardStep, WIZARD_STEPS, type WizardStepId } from './steps';
import { EligibilityStep } from './step-eligibility';
import { ReviewStep } from './step-review';
import {
  CommunicationStep,
  FormatStep,
  PrizesStep,
  ScheduleStep,
  SupervisionStep,
} from './steps-competition';
import { BasicsStep, GameStep, ParticipantsStep, RosterStep } from './steps-setup';

const t = messages.tournaments;
const w = t.wizard;

/** The schedule step also edits the time zone (a basics field). */
const STEP_FIELDS: Readonly<Partial<Record<WizardStepId, readonly string[]>>> = {
  schedule: ['schedule', 'basics.timezone'],
};

function CoverField({ detail }: { detail: TournamentDetail | null }) {
  const router = useRouter();
  const b = w.basics;
  const labels = messages.profile.photo;
  if (!detail) return <p className="text-sm text-text-muted">{b.coverHint}</p>;
  return (
    <Uploader
      label={b.cover}
      hint={b.coverHint}
      accept={IMAGE_UPLOAD.mimeTypes}
      maxBytes={IMAGE_UPLOAD.maxBytes}
      previewUrl={detail.coverUrl}
      fallback={detail.name.slice(0, 2).toUpperCase()}
      shape="square"
      labels={{
        choose: labels.choose,
        uploading: labels.uploading,
        tooLarge: labels.tooLarge,
        invalidType: labels.invalidType,
      }}
      onSelect={async (file) => {
        const form = new FormData();
        form.append('file', file);
        const result = await uploadTournamentCover(detail.id, form);
        if (result.ok) {
          toast.success(b.coverUploaded);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    />
  );
}

function hasErrorIn(errors: FieldErrors<TournamentConfigInput>, sections: readonly string[]) {
  return sections.some((s) => (errors as Record<string, unknown>)[s] !== undefined);
}

export function TournamentWizard({
  detail,
  initialConfig,
  templateId,
  initialStep,
}: {
  detail: TournamentDetail | null;
  initialConfig: TournamentConfig;
  templateId: string | null;
  initialStep: WizardStepId;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<WizardStepId>(initialStep);
  const form = useForm<TournamentConfigInput, unknown, TournamentConfig>({
    resolver: zodResolver(TournamentConfigSchema),
    defaultValues: initialConfig,
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = form.formState;
  const values = useWatch({ control: form.control });
  const parsed = useMemo(() => {
    const result = TournamentConfigSchema.safeParse(values);
    return result.success ? result.data : null;
  }, [values]);

  const policy = detail?.editPolicy;
  const modeOf = (section: TournamentSection) => policy?.[section] ?? 'free';
  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  const current = WIZARD_STEPS[index] ?? WIZARD_STEPS[0];
  const locked =
    current.sections.length > 0 &&
    current.sections.every((section) => modeOf(section) === 'locked');
  const needsConfirm = current.sections.some((section) => modeOf(section) === 'confirm');

  // Sections changed against the saved config that need a confirmation (and notice).
  const toConfirm = useMemo(() => {
    if (!detail || !parsed) return [];
    return (Object.keys(parsed) as TournamentSection[]).filter(
      (section) =>
        modeOf(section) === 'confirm' &&
        JSON.stringify(parsed[section]) !== JSON.stringify(detail.config[section]),
    );
    // modeOf only reads `policy`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, parsed, policy]);

  const goTo = (id: WizardStepId) => {
    setStep(id);
    router.replace(`${pathname}?paso=${id}`, { scroll: false });
  };

  const save = (confirm: boolean, reason: string | null) =>
    form.handleSubmit(
      async (config) => {
        if (!detail) {
          const result = await createTournament(config, templateId);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(w.saved);
          router.replace(`/admin/torneos/${result.data.id}/editar?paso=${step}`);
          return;
        }
        const result = await updateTournament(detail.id, config, confirm, reason);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        form.reset(result.data.config);
        toast.success(detail.status === 'draft' ? w.saved : w.savedChanges);
        router.refresh();
      },
      () => {
        toast.error(w.invalid);
      },
    )();

  const saveLabel = !detail || detail.status === 'draft' ? w.saveDraft : w.saveChanges;
  const saveButton =
    toConfirm.length > 0 ? (
      <ConfirmDialog
        trigger={
          <Button type="button" variant="secondary" disabled={isSubmitting}>
            {saveLabel}
          </Button>
        }
        title={w.confirmTitle}
        description={format(w.confirmDescription, {
          sections: toConfirm.map((s) => t.sections[s]).join(', '),
        })}
        confirmLabel={w.confirmLabel}
        cancelLabel={messages.common.cancel}
        reason={{ label: t.reason.label, hint: t.reason.hint, placeholder: t.reason.placeholder }}
        onConfirm={(reason) => save(true, reason)}
      />
    ) : (
      <Button
        type="button"
        variant="secondary"
        disabled={isSubmitting}
        onClick={() => void save(false, null)}
      >
        {saveLabel}
      </Button>
    );

  const steps = WIZARD_STEPS.map((s) => ({
    id: s.id,
    label: w.steps[s.id],
    ...(s.sections.length > 0 && s.sections.every((section) => modeOf(section) === 'locked')
      ? { state: 'locked' as const }
      : hasErrorIn(errors, STEP_FIELDS[s.id] ?? s.sections)
        ? { state: 'invalid' as const }
        : {}),
  }));

  const body = (() => {
    switch (step) {
      case 'basics':
        return <BasicsStep cover={<CoverField detail={detail} />} />;
      case 'participants':
        return <ParticipantsStep />;
      case 'game':
        return <GameStep />;
      case 'eligibility':
        return <EligibilityStep />;
      case 'roster':
        return <RosterStep />;
      case 'format':
        return <FormatStep />;
      case 'schedule':
        return <ScheduleStep />;
      case 'supervision':
        return <SupervisionStep />;
      case 'communication':
        return <CommunicationStep />;
      case 'prizes':
        return <PrizesStep />;
      case 'review':
        return <ReviewStep detail={detail} config={parsed} dirty={isDirty} />;
    }
  })();

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Wizard
          steps={steps}
          current={step}
          onStepChange={(id) => {
            if (isWizardStep(id)) goTo(id);
          }}
          label={w.newTitle}
          progress={format(w.progress, { step: index + 1, count: WIZARD_STEPS.length })}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={index === 0}
                onClick={() => {
                  const previous = WIZARD_STEPS[index - 1];
                  if (previous) goTo(previous.id);
                }}
              >
                {w.back}
              </Button>
              <div className="flex flex-wrap gap-2">
                {saveButton}
                {index < WIZARD_STEPS.length - 1 && (
                  <Button
                    type="button"
                    onClick={() => {
                      void form
                        .trigger((STEP_FIELDS[step] ?? current.sections) as never)
                        .then((ok) => {
                          const next = WIZARD_STEPS[index + 1];
                          if (ok && next) goTo(next.id);
                          else if (!ok) toast.error(w.invalid);
                        });
                    }}
                  >
                    {w.next}
                  </Button>
                )}
              </div>
            </>
          }
        >
          <h2 className="font-display text-2xl font-bold text-text caps">{w.steps[step]}</h2>
          {locked && (
            <p className="flex items-center gap-2 rounded-sm border border-border p-3 text-sm text-text-muted">
              <LockIcon aria-hidden className="size-4" /> {w.lockedSection}
            </p>
          )}
          {!locked && needsConfirm && (
            <p className="flex items-start gap-2 rounded-sm border border-warning/40 p-3 text-sm text-warning">
              <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" /> {w.confirmSection}
            </p>
          )}
          <fieldset disabled={locked} className="min-w-0">
            {body}
          </fieldset>
        </Wizard>
      </form>
    </FormProvider>
  );
}
