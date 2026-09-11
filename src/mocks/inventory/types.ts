export type UpstreamVehicleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNAVAILABLE';

export interface VehicleProjection {
  vehicleId: string;
  vin: string;
  make: string;
  model: string;
  stockedAt: string;
  upstreamStatus: UpstreamVehicleStatus;
  isPresentInLatestSnapshot: boolean;
  lastSeenAt: string;
}

export interface SyncMetadata {
  lastSuccessfulSyncAt: string;
}
