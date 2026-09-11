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

/**
 * System Design 6.5: selecting a vehicle opens the detail surface. The control
 * carries the VIN so its accessible name is unique across the inventory.
 */
function selectVehicleControl(
  vehicle: VehicleView,
  onSelectVehicle: (vehicleId: string) => void,
) {
  return (
    <button
      type="button"
      className="button vehicle-table__select"
      onClick={() => onSelectVehicle(vehicle.vehicleId)}
      aria-label={`View details for ${vehicle.make} ${vehicle.model} (${vehicle.vin})`}
    >
      Details
    </button>
  );
}

function currentActionCell(vehicle: VehicleView, onSelectVehicle: (vehicleId: string) => void) {
  return (
    <>
      <span className="vehicle-table__current-action">{currentActionLabel(vehicle)}</span>
      {selectVehicleControl(vehicle, onSelectVehicle)}
    </>
  );
}

function buildFullColumns(onSelectVehicle: (vehicleId: string) => void) {
  return columnHelper.columns([
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
      cell: (info) => currentActionCell(info.row.original, onSelectVehicle),
    }),
  ]);
}

/**
 * Tablet condensation (System Design 6.3): identification, age, aging status,
 * and current action stay; lower-priority fields are dropped.
 */
function buildCompactColumns(onSelectVehicle: (vehicleId: string) => void) {
  return columnHelper.columns([
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
      cell: (info) => currentActionCell(info.row.original, onSelectVehicle),
    }),
  ]);
}

export interface VehicleTableProps {
  vehicles: VehicleView[];
  rowCount: number;
  page: number;
  pageSize: number;
  density: 'full' | 'compact';
  onSelectVehicle: (vehicleId: string) => void;
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
  onSelectVehicle,
}: VehicleTableProps) {
  const columns = (
    density === 'compact' ? buildCompactColumns(onSelectVehicle) : buildFullColumns(onSelectVehicle)
  ) as unknown as Array<ColumnDef<typeof features, VehicleView, unknown>>;

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
