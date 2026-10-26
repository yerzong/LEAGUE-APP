'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  StartRiotVerificationRequestSchema,
  type MyRiotAccountResponse,
  type RiotAccountResponse,
  type RiotRank,
  type RiotVerificationResponse,
  type StartRiotVerificationRequest,
} from '@league/contracts';
import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  FormField,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { messages } from '@/config/i18n';
import { regionOptions } from '@/features/forms/options';
import { SelectField } from '@/features/forms/select-field';
import { formatDate, formatTime } from '@/lib/ui/dates';
import { fieldErrorMessage } from '@/lib/ui/forms';

import { confirmRiotVerification, startRiotVerification, unlinkRiotAccount } from '../actions';
import { profileIconUrl } from '../icons';

const t = messages.riot;

export function rankLabel(rank: RiotRank): string {
  const tier = messages.options.rankTiers[rank.tier];
  return rank.division === null
    ? format(t.rankApex, { tier, lp: rank.lp })
    : format(t.rank, { tier, division: rank.division, lp: rank.lp });
}

function StartForm({ onStarted }: { onStarted: (attempt: RiotVerificationResponse) => void }) {
  const form = useForm<StartRiotVerificationRequest>({
    resolver: zodResolver(StartRiotVerificationRequestSchema),
    defaultValues: { gameName: '', tagLine: '', region: 'la1' },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    const result = await startRiotVerification(values);
    if (result.ok) onStarted(result.data);
    else toast.error(result.message);
  });

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 md:grid-cols-3" noValidate>
      <FormField
        label={t.gameName}
        hint={t.gameNameHint}
        error={fieldErrorMessage(errors.gameName)}
        {...form.register('gameName')}
      />
      <FormField
        label={t.tagLine}
        hint={t.tagLineHint}
        error={fieldErrorMessage(errors.tagLine)}
        {...form.register('tagLine')}
      />
      <Controller
        control={form.control}
        name="region"
        render={({ field }) => (
          <SelectField
            label={t.region}
            value={field.value}
            onChange={(v) => {
              field.onChange(v ?? 'la1');
            }}
            options={regionOptions}
            placeholder={t.region}
          />
        )}
      />
      <div className="md:col-span-3">
        <Button type="submit" disabled={isSubmitting}>
          {t.start}
        </Button>
      </div>
    </form>
  );
}

function VerifyStep({
  attempt,
  iconVersion,
  onLinked,
  onRestart,
}: {
  attempt: RiotVerificationResponse;
  iconVersion: string | null;
  onLinked: (account: RiotAccountResponse) => void;
  onRestart: () => void;
}) {
  const [pending, setPending] = useState(false);
  const iconUrl = profileIconUrl(iconVersion, attempt.expectedIconId);
  const confirm = async () => {
    setPending(true);
    const result = await confirmRiotVerification(attempt.id);
    setPending(false);
    if (result.ok) {
      toast.success(t.linked);
      onLinked(result.data);
    } else {
      toast.error(result.message);
      if (result.code === 'verification_expired' || result.code === 'verification_not_found')
        onRestart();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {attempt.gameName}#{attempt.tagLine} · {messages.options.gameRegions[attempt.region]}
      </p>
      <div className="flex items-center gap-4">
        <Avatar size="lg" className="size-20 rounded-md">
          {iconUrl && <AvatarImage src={iconUrl} alt="" className="rounded-md" />}
          <AvatarFallback className="rounded-md">{attempt.expectedIconId}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <p className="caps text-sm" data-testid="expected-icon">
            {format(t.expectedIcon, { icon: attempt.expectedIconId })}
          </p>
          <p className="text-xs text-text-muted">
            {format(t.expiresAt, { time: formatTime(attempt.expiresAt) })}
          </p>
        </div>
      </div>
      <ol className="list-decimal pl-5 text-sm">
        {t.verifySteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void confirm()} disabled={pending}>
          {t.confirm}
        </Button>
        <Button variant="ghost" onClick={onRestart} disabled={pending}>
          {t.restart}
        </Button>
      </div>
    </div>
  );
}

function LinkedAccount({
  account,
  iconVersion,
}: {
  account: RiotAccountResponse;
  iconVersion: string | null;
}) {
  const router = useRouter();
  const iconUrl =
    account.profileIconId === null ? null : profileIconUrl(iconVersion, account.profileIconId);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar size="lg" className="size-16 rounded-md">
          {iconUrl && <AvatarImage src={iconUrl} alt="" className="rounded-md" />}
          <AvatarFallback className="rounded-md">{account.gameName.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <p className="font-display text-xl">
            {account.gameName}
            <span className="text-text-muted">#{account.tagLine}</span>
          </p>
          <p className="text-xs text-text-muted">
            {messages.options.gameRegions[account.region]}
            {account.summonerLevel !== null &&
              ` · ${format(t.level, { level: account.summonerLevel })}`}
            {` · ${format(t.verifiedOn, { date: formatDate(account.verifiedAt) })}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {account.ranks.length === 0 && <Badge variant="blue">{t.unranked}</Badge>}
        {account.ranks.map((rank) => (
          <Badge key={rank.queue} variant="blue">
            {messages.options.rankQueues[rank.queue]}: {rankLabel(rank)}
          </Badge>
        ))}
      </div>
      <div>
        <ConfirmDialog
          trigger={<Button variant="destructive">{t.unlink}</Button>}
          title={t.unlinkTitle}
          description={t.unlinkDescription}
          confirmLabel={t.unlink}
          cancelLabel={messages.common.cancel}
          destructive
          reason={{ label: t.unlinkReason, hint: t.unlinkReasonHint, minLength: 10 }}
          onConfirm={async (reason) => {
            const result = await unlinkRiotAccount(reason ?? '');
            if (result.ok) {
              toast.success(t.unlinked);
              router.refresh();
            } else {
              toast.error(result.message);
            }
          }}
        />
      </div>
    </div>
  );
}

export function RiotLink({
  initial,
  iconVersion,
}: {
  initial: MyRiotAccountResponse;
  iconVersion: string | null;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(initial.account);
  const [attempt, setAttempt] = useState(initial.pendingVerification);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{account ? t.linkedTitle : attempt ? t.verifyTitle : t.linkTitle}</CardTitle>
        {!account && <CardDescription>{t.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {account ? (
          <LinkedAccount account={account} iconVersion={iconVersion} />
        ) : attempt ? (
          <VerifyStep
            attempt={attempt}
            iconVersion={iconVersion}
            onLinked={(linked) => {
              setAccount(linked);
              router.refresh();
            }}
            onRestart={() => {
              setAttempt(null);
            }}
          />
        ) : (
          <StartForm onStarted={setAttempt} />
        )}
      </CardContent>
    </Card>
  );
}
