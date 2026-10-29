'use client';

import type {
  AchievementCriteria,
  AchievementIcon as Icon,
  AdminAchievement,
} from '@league/contracts';
import { format, plural } from '@league/i18n';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { locale, messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';

import { saveAchievement } from '../../actions';
import { AchievementIcon } from '../achievement-icon';

const s = messages.stats;
const t = s.admin.achievements;
const ICONS = Object.keys(t.icons) as Icon[];

/** The rule in words: `En un game: Pentakills ≥ 1`. */
export function describeRule(c: AchievementCriteria): string {
  const value = (v: number) => String(v);
  switch (c.type) {
    case 'game':
      return format(t.rules.game, {
        conditions: c.conditions
          .flatMap((x) => [
            ...(x.gte !== undefined
              ? [format(t.rules.gte, { stat: s.statNames[x.stat], value: value(x.gte) })]
              : []),
            ...(x.lte !== undefined
              ? [format(t.rules.lte, { stat: s.statNames[x.stat], value: value(x.lte) })]
              : []),
          ])
          .join(', '),
      });
    case 'total':
      return format(t.rules.total, { stat: s.statNames[c.stat], value: value(c.gte) });
    case 'games':
      return plural(c.wins ? t.rules.gamesWon : t.rules.games, c.gte, locale);
    case 'win_streak':
      return plural(t.rules.winStreak, c.gte, locale);
    case 'mvp':
      return format(t.rules.mvp, { value: value(c.gte), scope: s.mvpScopes[c.scope] });
  }
}

/** The editable thresholds of a rule: its kind and stats stay as they are. */
function thresholds(c: AchievementCriteria): { label: string; value: number }[] {
  if (c.type === 'game')
    return c.conditions.flatMap((x) =>
      [x.gte, x.lte].flatMap((v, i) =>
        v === undefined
          ? []
          : [
              {
                label: format(i === 0 ? t.rules.gte : t.rules.lte, {
                  stat: s.statNames[x.stat],
                  value: '',
                }),
                value: v,
              },
            ],
      ),
    );
  return [{ label: t.fields.threshold, value: c.gte }];
}

function withThresholds(c: AchievementCriteria, values: readonly number[]): AchievementCriteria {
  if (c.type !== 'game') return { ...c, gte: values[0] ?? c.gte };
  let i = 0;
  return {
    ...c,
    conditions: c.conditions.map((x) => {
      const next = { ...x };
      if (x.gte !== undefined) next.gte = values[i++] ?? x.gte;
      if (x.lte !== undefined) next.lte = values[i++] ?? x.lte;
      return next;
    }),
  };
}

function EditDialog({ achievement }: { achievement: AdminAchievement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(achievement.name);
  const [description, setDescription] = useState(achievement.description);
  const [icon, setIcon] = useState<Icon>(achievement.icon);
  const [active, setActive] = useState(achievement.active);
  const [values, setValues] = useState(thresholds(achievement.criteria).map((x) => x.value));
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const result = await saveAchievement(achievement.key, {
      name,
      description,
      icon,
      active,
      criteria: withThresholds(achievement.criteria, values),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t.saved);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          {t.edit}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={messages.common.close}>
        <DialogHeader>
          <DialogTitle>{t.editTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={t.fields.name}>
            {(control) => (
              <Input
                {...control}
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                }}
              />
            )}
          </Field>
          <Field label={t.fields.description}>
            {(control) => (
              <Input
                {...control}
                value={description}
                maxLength={200}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
              />
            )}
          </Field>
          <SelectField
            label={t.fields.icon}
            value={icon}
            onChange={(v) => {
              if (v) setIcon(v);
            }}
            options={ICONS.map((i) => ({ value: i, label: t.icons[i] }))}
            placeholder={t.fields.icon}
          />
          {thresholds(achievement.criteria).map((x, i) => (
            <Field key={x.label} label={x.label}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  step="any"
                  value={String(values[i] ?? 0)}
                  onChange={(e) => {
                    const next = [...values];
                    next[i] = Number(e.target.value);
                    setValues(next);
                  }}
                />
              )}
            </Field>
          ))}
          <div className="flex items-center gap-3">
            <Switch id={`active-${achievement.key}`} checked={active} onCheckedChange={setActive} />
            <Label htmlFor={`active-${achievement.key}`}>{t.fields.active}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={() => void save()}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AchievementsTable({ items }: { items: readonly AdminAchievement[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.columns.name}</TableHead>
          <TableHead>{t.columns.rule}</TableHead>
          <TableHead className="text-right">{t.columns.awarded}</TableHead>
          <TableHead>{t.columns.status}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((a) => (
          <TableRow key={a.key}>
            <TableCell>
              <span className="flex items-center gap-3">
                <AchievementIcon icon={a.icon} className="size-5 text-brand-bright" />
                <span className="flex flex-col">
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-xs text-text-muted">{a.description}</span>
                </span>
              </span>
            </TableCell>
            <TableCell className="text-sm">{describeRule(a.criteria)}</TableCell>
            <TableCell className="tabular text-right">{a.awarded}</TableCell>
            <TableCell>
              <span className="flex flex-wrap gap-1">
                <Badge variant={a.active ? 'success' : 'warning'}>
                  {a.active ? t.active : t.inactive}
                </Badge>
                <Badge variant="blue">{t.scopes[a.scope]}</Badge>
              </span>
            </TableCell>
            <TableCell className="text-right">
              <EditDialog achievement={a} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
