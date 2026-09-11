import type { CurrentActionReader } from '../inventory/action-reader';
import type { VehicleActionSummary } from '../../api/types';
import type { ActionRepository } from './action-repository';
import type { StatusCatalog } from './status-catalog';
import type { PersistedVehicleAction } from './types';

export class ActionCurrentActionReader implements CurrentActionReader {
  private readonly repository: ActionRepository;
  private readonly statusCatalog: StatusCatalog;

  constructor(repository: ActionRepository, statusCatalog: StatusCatalog) {
    this.repository = repository;
    this.statusCatalog = statusCatalog;
  }

  private mapToSummary(action: PersistedVehicleAction): VehicleActionSummary {
    const status = this.statusCatalog.getStatusById(action.statusId);
    return {
      id: action.id,
      status: status
        ? { id: status.id, code: status.code, label: status.label }
        : { id: action.statusId, code: 'UNKNOWN', label: 'Unknown Status' },
      note: action.note,
      createdAt: action.createdAt,
      createdByDisplayName: action.createdByDisplayName,
      createdByType: action.createdByType,
    };
  }

  private sortNewestFirst(actions: PersistedVehicleAction[]): PersistedVehicleAction[] {
    const withIndices = actions.map((action, index) => ({ action, index }));
    withIndices.sort((a, b) => {
      const timeDiff = new Date(b.action.createdAt).getTime() - new Date(a.action.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.index - a.index;
    });
    return withIndices.map(({ action }) => action);
  }

  async getCurrentAction(vehicleId: string): Promise<VehicleActionSummary | null> {
    const actions = await this.repository.getActionsForVehicle(vehicleId);
    if (!actions || actions.length === 0) {
      return null;
    }

    const sorted = this.sortNewestFirst(actions);
    return this.mapToSummary(sorted[0]);
  }

  async getCurrentActions(vehicleIds: string[]): Promise<Map<string, VehicleActionSummary>> {
    const allActions = await this.repository.getAllActions();
    const map = new Map<string, VehicleActionSummary>();
    const idSet = new Set(vehicleIds);

    const grouped = new Map<string, PersistedVehicleAction[]>();
    for (const action of allActions) {
      if (idSet.has(action.vehicleId)) {
        let list = grouped.get(action.vehicleId);
        if (!list) {
          list = [];
          grouped.set(action.vehicleId, list);
        }
        list.push(action);
      }
    }

    for (const [vehicleId, list] of grouped.entries()) {
      const sorted = this.sortNewestFirst(list);
      map.set(vehicleId, this.mapToSummary(sorted[0]));
    }

    return map;
  }
}
