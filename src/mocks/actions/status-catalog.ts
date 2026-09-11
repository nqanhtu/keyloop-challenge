import type { VehicleActionStatus } from '../../api/types';
import { mockActionStatuses } from './fixtures';

export class StatusCatalog {
  private readonly statuses: VehicleActionStatus[];
  private readonly statusMap: Map<string, VehicleActionStatus>;

  constructor(statuses: VehicleActionStatus[] = mockActionStatuses) {
    this.statuses = [...statuses];
    this.statusMap = new Map(this.statuses.map((s) => [s.id, s]));
  }

  getActiveStatuses(): VehicleActionStatus[] {
    return this.statuses
      .filter((s) => s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getStatusById(id: string): VehicleActionStatus | null {
    return this.statusMap.get(id) ?? null;
  }

  isStatusActive(id: string): boolean {
    const status = this.statusMap.get(id);
    return status?.isActive === true;
  }
}
