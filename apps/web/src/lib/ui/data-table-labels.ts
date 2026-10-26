import { format } from '@league/i18n';
import type { DataTableLabels } from '@league/ui';

import { messages } from '@/config/i18n';

const t = messages.dataTable;

export const dataTableLabels: DataTableLabels = {
  filterPlaceholder: t.filterPlaceholder,
  previousPage: t.previousPage,
  nextPage: t.nextPage,
  pageInfo: (page, count) => format(t.pageInfo, { page, count }),
  selectAll: t.selectAll,
  selectRow: t.selectRow,
  selectedInfo: (count) => format(t.selectedInfo, { count }),
  sortBy: (column) => format(t.sortBy, { column }),
};
