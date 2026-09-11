import { apiClient } from './client';
import type {
  CreateVehicleActionInput,
  VehicleAction,
  VehicleActionStatus,
} from './types';

export async function getVehicleActionStatuses(): Promise<VehicleActionStatus[]> {
  return apiClient.get<VehicleActionStatus[]>('/vehicle-action-statuses');
}

export async function getVehicleActions(vehicleId: string): Promise<VehicleAction[]> {
  return apiClient.get<VehicleAction[]>(`/vehicles/${encodeURIComponent(vehicleId)}/actions`);
}

export async function createVehicleAction(
  vehicleId: string,
  input: CreateVehicleActionInput,
): Promise<VehicleAction> {
  return apiClient.post<VehicleAction>(
    `/vehicles/${encodeURIComponent(vehicleId)}/actions`,
    input,
  );
}
