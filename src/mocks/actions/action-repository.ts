import type { PersistedVehicleAction } from './types';
import { BrowserActionStorageAdapter } from './storage-adapter';

export interface ActionRepository {
  getActionsForVehicle(vehicleId: string): Promise<PersistedVehicleAction[]> | PersistedVehicleAction[];
  getAllActions(): Promise<PersistedVehicleAction[]> | PersistedVehicleAction[];
  appendAction(action: PersistedVehicleAction): Promise<void> | void;
}

export class PersistentActionRepository implements ActionRepository {
  private readonly adapter: BrowserActionStorageAdapter;

  constructor(adapter?: BrowserActionStorageAdapter) {
    this.adapter = adapter ?? new BrowserActionStorageAdapter();
  }

  getActionsForVehicle(vehicleId: string): PersistedVehicleAction[] {
    const all = this.adapter.getAll();
    return all.filter((a) => a.vehicleId === vehicleId);
  }

  getAllActions(): PersistedVehicleAction[] {
    return this.adapter.getAll();
  }

  appendAction(action: PersistedVehicleAction): void {
    this.adapter.append(action);
  }
}
