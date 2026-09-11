import { http, HttpResponse, type RequestHandler } from 'msw';
import type { VehicleSortOption } from '../../api/types';
import { InventoryService } from './inventory-service';

export function createInventoryHandlers(inventoryService: InventoryService): RequestHandler[] {
  return [
    http.get('/vehicles', async ({ request }) => {
      const url = new URL(request.url);
      const make = url.searchParams.get('make') ?? undefined;
      const model = url.searchParams.get('model') ?? undefined;
      const ageMinDaysStr = url.searchParams.get('ageMinDays');
      const ageMaxDaysStr = url.searchParams.get('ageMaxDays');
      const inventoryStatus = url.searchParams.get('inventoryStatus') ?? undefined;
      const actionStatusId = url.searchParams.get('actionStatusId') ?? undefined;
      const agingOnlyStr = url.searchParams.get('agingOnly');
      const rawSort = url.searchParams.get('sort');
      const sort: VehicleSortOption | undefined =
        rawSort === 'inventoryAgeDays:asc' || rawSort === 'inventoryAgeDays:desc'
          ? rawSort
          : undefined;
      const pageStr = url.searchParams.get('page');
      const pageSizeStr = url.searchParams.get('pageSize');

      const ageMinDays = ageMinDaysStr !== null ? parseInt(ageMinDaysStr, 10) : undefined;
      const ageMaxDays = ageMaxDaysStr !== null ? parseInt(ageMaxDaysStr, 10) : undefined;
      const agingOnly = agingOnlyStr === 'true';
      const page = pageStr !== null ? parseInt(pageStr, 10) : undefined;
      const pageSize = pageSizeStr !== null ? parseInt(pageSizeStr, 10) : undefined;

      const result = await inventoryService.queryVehicles({
        make,
        model,
        ageMinDays,
        ageMaxDays,
        inventoryStatus,
        actionStatusId,
        agingOnly,
        sort,
        page,
        pageSize,
      });

      return HttpResponse.json(result);
    }),

    http.get('/vehicles/:vehicleId', async ({ params }) => {
      const vehicleId = params.vehicleId as string;
      const vehicle = await inventoryService.getVehicleById(vehicleId);

      if (!vehicle) {
        return HttpResponse.json(
          {
            code: 'VEHICLE_NOT_FOUND',
            message: `Vehicle not found: ${vehicleId}`,
            requestId: crypto.randomUUID(),
          },
          { status: 404 },
        );
      }

      return HttpResponse.json(vehicle);
    }),

    http.get('/inventory/filter-options', async ({ request }) => {
      const url = new URL(request.url);
      const make = url.searchParams.get('make') ?? undefined;
      const options = await inventoryService.getFilterOptions(make);
      return HttpResponse.json(options);
    }),

    http.get('/inventory/summary', async () => {
      const summary = await inventoryService.getSummary();
      return HttpResponse.json(summary);
    }),
  ];
}
