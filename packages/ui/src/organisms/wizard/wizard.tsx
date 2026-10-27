'use client';

import { CheckIcon, LockIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

export type WizardStepState = 'complete' | 'current' | 'upcoming' | 'locked' | 'invalid';

export interface WizardStep {
  id: string;
  label: string;
  /** Defaults from the position: before the current one is complete, after is upcoming. */
  state?: WizardStepState | undefined;
}

export interface WizardProps {
  steps: WizardStep[];
  current: string;
  onStepChange: (id: string) => void;
  /** Accessible name of the step list and the "Step x of y" text (i18n from the app). */
  label: string;
  progress: string;
  children: ReactNode;
  /** Back / next / save buttons. */
  footer?: ReactNode;
  className?: string | undefined;
}

/** Generic step-by-step flow: every step is reachable (drafts are saved complete). */
export function Wizard({
  steps,
  current,
  onStepChange,
  label,
  progress,
  children,
  footer,
  className,
}: WizardProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  return (
    <div className={cn('grid gap-6 lg:grid-cols-4', className)}>
      <nav aria-label={label} className="min-w-0 lg:col-span-1">
        <p className="mb-3 text-sm text-text-muted">{progress}</p>
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {steps.map((step, index) => {
            const state =
              step.state ??
              (index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming');
            const isCurrent = step.id === current;
            return (
              <li key={step.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onStepChange(step.id);
                  }}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-state={state}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors focus-ring',
                    isCurrent ? 'bg-surface-raised text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular',
                      isCurrent && 'border-primary text-primary',
                      state === 'complete' && 'border-success text-success',
                      state === 'invalid' && 'border-danger text-danger',
                      (state === 'upcoming' || state === 'locked') && 'border-border',
                    )}
                  >
                    {state === 'complete' && !isCurrent ? (
                      <CheckIcon className="size-3.5" />
                    ) : state === 'locked' ? (
                      <LockIcon className="size-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="whitespace-nowrap">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
        {children}
        {footer && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
