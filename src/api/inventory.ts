import { apiClient } from './client';
import type {
  InventoryFilterOptions,
  VehicleListQuery,
  VehicleListResponse,
  VehicleView,
} from './types';

export async function getVehicles(params?: VehicleListQuery): Promise<VehicleListResponse> {
  return apiClient.get<VehicleListResponse>('/vehicles', {
    params: params as Record<string, string | number | boolean | undefined | null>,
  });
}

export async function getVehicleById(vehicleId: string): Promise<VehicleView> {
  return apiClient.get<VehicleView>(`/vehicles/${encodeURIComponent(vehicleId)}`);
}

export async function getFilterOptions(params?: { make?: string }): Promise<InventoryFilterOptions> {
  return apiClient.get<InventoryFilterOptions>('/inventory/filter-options', {
    params,
  });
}
