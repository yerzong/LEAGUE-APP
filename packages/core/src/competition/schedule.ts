// Schedule windows (docs/03 §6.3 schedule_windows): series are placed only
// inside the weekly windows of the event, outside blackout dates, round after
// round. Pure: time zones go through Intl, no clock is read.

import { InvalidScheduleError } from '../errors.js';
import type { IsoDate } from './time.js';

export interface WindowSpec {
  /** 0 = Sunday. */
  readonly weekday: number;
  /** `HH:MM` in the event time zone. */
  readonly startTime: string;
  readonly endTime: string;
  readonly slotMinutes: number;
  readonly parallelMatches: number;
}

export interface Blackout {
  readonly startsAt: IsoDate;
  readonly endsAt: IsoDate;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** How far ahead slots are searched (a year). */
const HORIZON_DAYS = 366;

function wallClock(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: weekdays.indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

const minutesOf = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
};

/** The instant at which the event time zone reads `date` (`YYYY-MM-DD`) at `time` (`HH:MM`). */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const [y = 0, mo = 1, d = 1] = date.split('-').map(Number);
  const target = Date.UTC(y, mo - 1, d) + minutesOf(time) * MINUTE;
  let guess = target;
  // Two passes settle the offset, also across a DST change.
  for (let i = 0; i < 2; i += 1) {
    const w = wallClock(guess, timeZone);
    const [wy = 0, wm = 1, wd = 1] = w.date.split('-').map(Number);
    guess += target - (Date.UTC(wy, wm - 1, wd) + w.minutes * MINUTE);
  }
  return new Date(guess);
}

const blocked = (start: number, end: number, blackouts: readonly Blackout[]) =>
  blackouts.some((b) => start < Date.parse(b.endsAt) && end > Date.parse(b.startsAt));

interface Slot {
  readonly start: number;
  readonly end: number;
  readonly capacity: number;
}

/** Slots of every window, in time order, from `from` on. */
function* slots(
  windows: readonly WindowSpec[],
  blackouts: readonly Blackout[],
  timeZone: string,
  from: number,
): Generator<Slot> {
  for (let day = 0; day < HORIZON_DAYS; day += 1) {
    const { date, weekday } = wallClock(from + day * DAY, timeZone);
    const today = windows
      .filter((w) => w.weekday === weekday)
      .flatMap((w) => {
        const list: Slot[] = [];
        for (
          let minute = minutesOf(w.startTime);
          minute + w.slotMinutes <= minutesOf(w.endTime);
          minute += w.slotMinutes
        ) {
          const hh = String(Math.floor(minute / 60)).padStart(2, '0');
          const mm = String(minute % 60).padStart(2, '0');
          const start = zonedTime(date, `${hh}:${mm}`, timeZone).getTime();
          list.push({ start, end: start + w.slotMinutes * MINUTE, capacity: w.parallelMatches });
        }
        return list;
      })
      .sort((x, y) => x.start - y.start);
    for (const slot of today) {
      if (slot.start >= from && !blocked(slot.start, slot.end, blackouts)) yield slot;
    }
  }
}

/**
 * Start time of each match: rounds in order, each one in slots that start
 * after the previous round's last slot ends, up to the parallel capacity.
 */
export function autoSchedule(
  matches: readonly { readonly id: string; readonly round: number }[],
  windows: readonly WindowSpec[],
  blackouts: readonly Blackout[],
  timeZone: string,
  from: IsoDate,
): Map<string, IsoDate> {
  if (windows.length === 0) {
    throw new InvalidScheduleError('The tournament has no schedule windows', {
      reason: 'no_windows',
    });
  }
  const plan = new Map<string, IsoDate>();
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  let earliest = Date.parse(from);
  for (const round of rounds) {
    const pending = matches.filter((m) => m.round === round);
    const source = slots(windows, blackouts, timeZone, earliest);
    let lastEnd = earliest;
    while (pending.length > 0) {
      const slot = source.next();
      if (slot.done) {
        throw new InvalidScheduleError('Not enough slots in the schedule windows', {
          reason: 'no_slots',
        });
      }
      for (const match of pending.splice(0, slot.value.capacity)) {
        plan.set(match.id, new Date(slot.value.start).toISOString());
      }
      lastEnd = slot.value.end;
    }
    earliest = lastEnd;
  }
  return plan;
}

/** Whether a series starting at `at` fits whole inside a window and outside blackouts. */
export function isWithinWindows(
  at: IsoDate,
  windows: readonly WindowSpec[],
  blackouts: readonly Blackout[],
  timeZone: string,
): boolean {
  const start = Date.parse(at);
  const { weekday, minutes } = wallClock(start, timeZone);
  return windows.some(
    (w) =>
      w.weekday === weekday &&
      minutes >= minutesOf(w.startTime) &&
      minutes + w.slotMinutes <= minutesOf(w.endTime) &&
      !blocked(start, start + w.slotMinutes * MINUTE, blackouts),
  );
}
