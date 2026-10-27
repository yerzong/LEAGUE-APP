import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table/table.js';

export interface StandingsColumn {
  key: string;
  /** Header text and its expanded name for screen readers ("G" / "Ganadas"). */
  label: string;
  title?: string | undefined;
}

export interface StandingsRow {
  id: string;
  rank: number;
  entrant: ReactNode;
  /** Values in the order of `columns`. */
  values: (string | number)[];
  /** Badge or text for qualified / eliminated. */
  status?: ReactNode;
  /** Why it sits there when tied on points (tiebreak criteria). */
  note?: ReactNode;
  highlight?: 'qualified' | 'eliminated' | undefined;
}

export interface StandingsTableProps {
  caption: string;
  rankLabel: string;
  entrantLabel: string;
  columns: StandingsColumn[];
  rows: StandingsRow[];
  className?: string | undefined;
}

/** Group or league table: rank, entrant, numeric columns and the tiebreak note. */
export function StandingsTable({
  caption,
  rankLabel,
  entrantLabel,
  columns,
  rows,
  className,
}: StandingsTableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">{rankLabel}</TableHead>
            <TableHead>{entrantLabel}</TableHead>
            {columns.map((c) => (
              <TableHead key={c.key} className="text-right">
                {c.title ? <abbr title={c.title}>{c.label}</abbr> : c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              data-highlight={row.highlight}
              className={cn(row.highlight === 'eliminated' && 'text-text-muted')}
            >
              <TableCell className="text-right tabular">{row.rank}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {row.entrant}
                    {row.status}
                  </span>
                  {row.note && <span className="text-xs text-text-muted">{row.note}</span>}
                </div>
              </TableCell>
              {row.values.map((value, i) => (
                <TableCell key={columns[i]?.key ?? String(i)} className="text-right tabular">
                  {value}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
