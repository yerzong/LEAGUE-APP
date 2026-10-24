'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, SearchIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { Button } from '../../atoms/button/button.js';
import { Checkbox } from '../../atoms/checkbox/checkbox.js';
import { Input } from '../../atoms/input/input.js';
import { Skeleton } from '../../atoms/skeleton/skeleton.js';
import { cn } from '../../lib/cn.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table/table.js';

/** Every visible string comes from the app (i18n); the table holds no copy. */
export interface DataTableLabels {
  filterPlaceholder: string;
  previousPage: string;
  nextPage: string;
  pageInfo: (page: number, pageCount: number) => string;
  selectAll: string;
  selectRow: string;
  selectedInfo: (selected: number) => string;
  /** Accessible name of the sort button, e.g. "Ordenar por Equipo". */
  sortBy: (column: string) => string;
}

export type DataTableStatus = 'ready' | 'loading' | 'error';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  labels: DataTableLabels;
  getRowId: (row: TData) => string;
  status?: DataTableStatus | undefined;
  /** Shown when there are no rows (or none match the filter). Use EmptyState. */
  empty: ReactNode;
  /** Shown when status is "error". Use ErrorState with a retry action. */
  error?: ReactNode;
  /** Adds a text filter across all columns. */
  filterable?: boolean | undefined;
  /** Adds checkboxes; bulk actions receive the selected rows. */
  bulkActions?: ((rows: TData[]) => ReactNode) | undefined;
  pageSize?: number | undefined;
  className?: string | undefined;
}

export function DataTable<TData>({
  columns,
  data,
  labels,
  getRowId,
  status = 'ready',
  empty,
  error,
  filterable = false,
  bulkActions,
  pageSize = 10,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const selectable = bulkActions !== undefined;

  const allColumns = useMemo<ColumnDef<TData>[]>(() => {
    if (!selectable) return columns;
    const selection: ColumnDef<TData> = {
      id: '__select',
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label={labels.selectAll}
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(value === true);
          }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={labels.selectRow}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => {
            row.toggleSelected(value === true);
          }}
        />
      ),
    };
    return [selection, ...columns];
  }, [columns, selectable, labels.selectAll, labels.selectRow]);

  // TanStack Table returns new functions every render by design; it is not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const selected = table.getSelectedRowModel().rows.map((row) => row.original);
  const columnCount = allColumns.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  let body: ReactNode;
  if (status === 'loading') {
    body = Array.from({ length: Math.min(pageSize, 5) }, (_, index) => (
      <TableRow key={index}>
        {Array.from({ length: columnCount }, (__, cell) => (
          <TableCell key={cell}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ));
  } else if (status === 'error') {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount} className="p-4">
          {error}
        </TableCell>
      </TableRow>
    );
  } else if (rows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount} className="p-4">
          {empty}
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row) => (
      <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  return (
    <div data-slot="data-table" className={cn('flex flex-col gap-3', className)}>
      {(filterable || selected.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {filterable && (
            <div className="relative w-full max-w-xs">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="search"
                aria-label={labels.filterPlaceholder}
                placeholder={labels.filterPlaceholder}
                value={globalFilter}
                onChange={(event) => {
                  table.setGlobalFilter(event.target.value);
                }}
                className="pl-9"
              />
            </div>
          )}
          {selectable && selected.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted" aria-live="polite">
                {labels.selectedInfo(selected.length)}
              </span>
              {bulkActions(selected)}
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <Table aria-busy={status === 'loading' || undefined}>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const content = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());
                  const sorted = header.column.getIsSorted();
                  if (!header.column.getCanSort())
                    return <TableHead key={header.id}>{content}</TableHead>;

                  const title =
                    typeof header.column.columnDef.header === 'string'
                      ? header.column.columnDef.header
                      : header.column.id;
                  const SortIcon =
                    sorted === 'asc'
                      ? ArrowUpIcon
                      : sorted === 'desc'
                        ? ArrowDownIcon
                        : ArrowUpDownIcon;
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                      }
                    >
                      <button
                        type="button"
                        aria-label={labels.sortBy(title)}
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded-xs caps focus-ring hover:text-text"
                      >
                        {content}
                        <SortIcon aria-hidden="true" className="size-3.5" />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      {status === 'ready' && rows.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-sm text-text-muted tabular">
            {labels.pageInfo(table.getState().pagination.pageIndex + 1, pageCount)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              table.previousPage();
            }}
            disabled={!table.getCanPreviousPage()}
          >
            {labels.previousPage}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              table.nextPage();
            }}
            disabled={!table.getCanNextPage()}
          >
            {labels.nextPage}
          </Button>
        </div>
      )}
    </div>
  );
}

export type { ColumnDef } from '@tanstack/react-table';
