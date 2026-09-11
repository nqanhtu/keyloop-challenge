import { createColumnHelper, rowPaginationFeature, tableFeatures, useTable } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { VehicleView } from '../../../api/types';
import { AgingIndicator } from './aging-indicator';

const features = tableFeatures({ rowPaginationFeature });

const columnHelper = createColumnHelper<typeof features, VehicleView>();

function currentActionLabel(vehicle: VehicleView): string {
  return vehicle.currentAction ? vehicle.currentAction.status.label : 'No current action';
}

function stockedDate(value: string): string {
  return value.slice(0, 10);
}

const fullColumns = columnHelper.columns([
  columnHelper.accessor('make', { header: 'Make' }),
  columnHelper.accessor('model', { header: 'Model' }),
  columnHelper.accessor('vin', { header: 'VIN' }),
  columnHelper.accessor('stockedAt', {
    header: 'Stocked',
    cell: (info) => stockedDate(info.getValue()),
  }),
  columnHelper.accessor('inventoryAgeDays', { header: 'Age (days)' }),
  columnHelper.accessor('upstreamStatus', { header: 'Status' }),
  columnHelper.accessor('isAging', {
    header: 'Aging',
    cell: (info) => <AgingIndicator isAging={info.getValue()} />,
  }),
  columnHelper.display({
    id: 'currentAction',
    header: 'Current action',
    cell: (info) => currentActionLabel(info.row.original),
  }),
]);

/**
 * Tablet condensation (System Design 6.3): identification, age, aging status,
 * and current action stay; lower-priority fields are dropped.
 */
const compactColumns = columnHelper.columns([
  columnHelper.accessor('make', { header: 'Make' }),
  columnHelper.accessor('model', { header: 'Model' }),
  columnHelper.accessor('inventoryAgeDays', { header: 'Age (days)' }),
  columnHelper.accessor('isAging', {
    header: 'Aging',
    cell: (info) => <AgingIndicator isAging={info.getValue()} />,
  }),
  columnHelper.display({
    id: 'currentAction',
    header: 'Current action',
    cell: (info) => currentActionLabel(info.row.original),
  }),
]);

export interface VehicleTableProps {
  vehicles: VehicleView[];
  rowCount: number;
  page: number;
  pageSize: number;
  density: 'full' | 'compact';
}

/**
 * System Design 6.8 / UI-004: the table receives rows that the server already
 * filtered, sorted, and paginated. No client-side sorting, filtering, or
 * pagination row model is registered, so the rendered page is exactly the
 * returned page.
 */
export function VehicleTable({
  vehicles,
  rowCount,
  page,
  pageSize,
  density,
}: VehicleTableProps) {
  const columns = (density === 'compact'
    ? compactColumns
    : fullColumns) as unknown as Array<ColumnDef<typeof features, VehicleView, unknown>>;

  const table = useTable({
    features,
    columns,
    data: vehicles,
    manualPagination: true,
    rowCount,
    state: {
      pagination: { pageIndex: page - 1, pageSize },
    },
  });

  return (
    <table className={`vehicle-table vehicle-table--${density}`} data-density={density}>
      <caption>Inventory vehicles</caption>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} scope="col">
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => (
              <td key={cell.id}>
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
