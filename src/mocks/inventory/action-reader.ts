import type { VehicleActionSummary } from '../../api/types';

export interface CurrentActionReader {
  getCurrentAction(vehicleId: string): Promise<VehicleActionSummary | null> | VehicleActionSummary | null;
  getCurrentActions(vehicleIds: string[]): Promise<Map<string, VehicleActionSummary>> | Map<string, VehicleActionSummary>;
}

/**
 * Transitional empty action reader for T02.
 * Returns null / empty collections because action persistence and history belong to T03.
 */
export class EmptyCurrentActionReader implements CurrentActionReader {
  getCurrentAction(_vehicleId: string): VehicleActionSummary | null {
    return null;
  }

  getCurrentActions(_vehicleIds: string[]): Map<string, VehicleActionSummary> {
    return new Map();
  }
}
