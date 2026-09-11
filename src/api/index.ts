export { apiClient, ApiClient } from './client';
export { ApiError, isApiError, type ApiErrorPayload } from './errors';
export { getVehicles, getVehicleById, getFilterOptions } from './inventory';
export type {
  ApiClientConfig,
  RequestOptions,
  UpstreamVehicleStatus,
  VehicleActionStatusSummary,
  VehicleActionSummary,
  VehicleView,
  VehicleListQuery,
  VehicleSortOption,
  VehicleListMeta,
  VehicleListResponse,
  InventoryFilterOptions,
} from './types';
