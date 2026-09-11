import { mockSyncMetadata, mockVehicleProjections } from './fixtures';
import type { VehicleProjection } from './types';

export interface VehicleProjectionReader {
  getAll(): Promise<VehicleProjection[]> | VehicleProjection[];
  getById(vehicleId: string): Promise<VehicleProjection | null> | VehicleProjection | null;
  getLastSuccessfulSyncAt(): Promise<string> | string;
}

export class FixtureVehicleProjectionReader implements VehicleProjectionReader {
  private readonly projections: VehicleProjection[];
  private readonly lastSuccessfulSyncAt: string;

  constructor(
    projections: VehicleProjection[] = mockVehicleProjections,
    lastSuccessfulSyncAt: string = mockSyncMetadata.lastSuccessfulSyncAt,
  ) {
    this.projections = [...projections];
    this.lastSuccessfulSyncAt = lastSuccessfulSyncAt;
  }

  async getAll(): Promise<VehicleProjection[]> {
    return [...this.projections];
  }

  async getById(vehicleId: string): Promise<VehicleProjection | null> {
    const found = this.projections.find((p) => p.vehicleId === vehicleId);
    return found ?? null;
  }

  async getLastSuccessfulSyncAt(): Promise<string> {
    return this.lastSuccessfulSyncAt;
  }
}
