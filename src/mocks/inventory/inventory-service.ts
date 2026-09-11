import type {
  InventoryFilterOptions,
  InventorySummary,
  VehicleListQuery,
  VehicleListResponse,
  VehicleView,
} from '../../api/types';
import { calculateAging } from '../aging/aging-policy';
import type { CurrentActionReader } from './action-reader';
import type { VehicleProjectionReader } from './projection-reader';
import type { VehicleProjection } from './types';

export interface InventoryServiceConfig {
  projectionReader: VehicleProjectionReader;
  currentActionReader: CurrentActionReader;
  timeZone?: string;
  referenceInstant?: string | Date;
}

export class InventoryService {
  private readonly projectionReader: VehicleProjectionReader;
  private readonly currentActionReader: CurrentActionReader;
  private readonly timeZone: string;
  private readonly referenceInstant?: string | Date;

  constructor(config: InventoryServiceConfig) {
    this.projectionReader = config.projectionReader;
    this.currentActionReader = config.currentActionReader;
    this.timeZone = config.timeZone ?? 'UTC';
    this.referenceInstant = config.referenceInstant;
  }

  private mapToView(
    projection: VehicleProjection,
    currentAction: VehicleView['currentAction'],
  ): VehicleView {
    const { inventoryAgeDays, isAging } = calculateAging({
      stockedAt: projection.stockedAt,
      currentInstant: this.referenceInstant,
      timeZone: this.timeZone,
    });

    return {
      vehicleId: projection.vehicleId,
      vin: projection.vin,
      make: projection.make,
      model: projection.model,
      stockedAt: projection.stockedAt,
      upstreamStatus: projection.upstreamStatus,
      inventoryAgeDays,
      isAging,
      currentAction,
    };
  }

  async getVehicleById(vehicleId: string): Promise<VehicleView | null> {
    const projection = await this.projectionReader.getById(vehicleId);
    if (!projection || !projection.isPresentInLatestSnapshot) {
      return null;
    }

    const currentAction = await this.currentActionReader.getCurrentAction(vehicleId);
    return this.mapToView(projection, currentAction);
  }

  async queryVehicles(query: VehicleListQuery = {}): Promise<VehicleListResponse> {
    const allProjections = await this.projectionReader.getAll();

    // 1. Only present vehicles are part of current inventory
    const presentProjections = allProjections.filter((p) => p.isPresentInLatestSnapshot);

    // 2. Fetch current actions through explicit reader interface
    const vehicleIds = presentProjections.map((p) => p.vehicleId);
    const actionMap = await this.currentActionReader.getCurrentActions(vehicleIds);

    // 3. Map to VehicleView with derived aging properties
    const views: VehicleView[] = presentProjections.map((p) =>
      this.mapToView(p, actionMap.get(p.vehicleId) ?? null),
    );

    // 4. Apply filters
    const filtered = views.filter((v) => {
      if (query.make && v.make.toLowerCase() !== query.make.toLowerCase()) {
        return false;
      }
      if (query.model && v.model.toLowerCase() !== query.model.toLowerCase()) {
        return false;
      }
      if (query.ageMinDays !== undefined && v.inventoryAgeDays < query.ageMinDays) {
        return false;
      }
      if (query.ageMaxDays !== undefined && v.inventoryAgeDays > query.ageMaxDays) {
        return false;
      }
      if (query.inventoryStatus && v.upstreamStatus !== query.inventoryStatus) {
        return false;
      }
      if (query.agingOnly && !v.isAging) {
        return false;
      }
      if (query.actionStatusId) {
        if (!v.currentAction || v.currentAction.status.id !== query.actionStatusId) {
          return false;
        }
      }
      return true;
    });

    // 5. Apply sorting (exhaustively handled for documented sort options, defaulting to inventoryAgeDays:desc)
    const sortOption = query.sort ?? 'inventoryAgeDays:desc';
    filtered.sort((a, b) => {
      let diff = 0;
      switch (sortOption) {
        case 'inventoryAgeDays:asc':
          diff = a.inventoryAgeDays - b.inventoryAgeDays;
          break;
        case 'inventoryAgeDays:desc':
          diff = b.inventoryAgeDays - a.inventoryAgeDays;
          break;
      }

      if (diff !== 0) {
        return diff;
      }
      return a.vehicleId.localeCompare(b.vehicleId);
    });

    // 6. Apply pagination
    const total = filtered.length;
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 50;
    const startIndex = (page - 1) * pageSize;
    const data = filtered.slice(startIndex, startIndex + pageSize);
    const lastSuccessfulSyncAt = await this.projectionReader.getLastSuccessfulSyncAt();

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        lastSuccessfulSyncAt,
      },
    };
  }

  async getFilterOptions(make?: string): Promise<InventoryFilterOptions> {
    const allProjections = await this.projectionReader.getAll();
    const presentProjections = allProjections.filter((p) => p.isPresentInLatestSnapshot);

    const makesSet = new Set<string>();
    const modelsSet = new Set<string>();

    for (const p of presentProjections) {
      makesSet.add(p.make);

      if (!make || p.make.toLowerCase() === make.toLowerCase()) {
        modelsSet.add(p.model);
      }
    }

    const makes = Array.from(makesSet).sort((a, b) => a.localeCompare(b));
    const models = Array.from(modelsSet).sort((a, b) => a.localeCompare(b));

    return {
      makes,
      models,
    };
  }

  async getSummary(): Promise<InventorySummary> {
    const allProjections = await this.projectionReader.getAll();
    const presentProjections = allProjections.filter((p) => p.isPresentInLatestSnapshot);

    const agingProjections = presentProjections.filter((p) => {
      const { isAging } = calculateAging({
        stockedAt: p.stockedAt,
        currentInstant: this.referenceInstant,
        timeZone: this.timeZone,
      });
      return isAging;
    });

    const agingVehicleIds = agingProjections.map((p) => p.vehicleId);
    const actionMap = await this.currentActionReader.getCurrentActions(agingVehicleIds);

    const agingWithAction = agingProjections.filter((p) => {
      const currentAction = actionMap.get(p.vehicleId);
      return currentAction !== undefined && currentAction !== null;
    }).length;

    const lastSuccessfulSyncAt = await this.projectionReader.getLastSuccessfulSyncAt();

    return {
      totalInventory: presentProjections.length,
      agingVehicles: agingProjections.length,
      agingWithAction,
      lastSuccessfulSyncAt,
    };
  }
}
