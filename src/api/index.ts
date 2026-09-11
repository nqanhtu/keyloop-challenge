export { apiClient, ApiClient } from './client';
export { ApiError, isApiError, type ApiErrorPayload } from './errors';
export {
  getVehicles,
  getVehicleById,
  getFilterOptions,
  getInventorySummary,
} from './inventory';
export {
  getVehicleActionStatuses,
  getVehicleActions,
  createVehicleAction,
} from './actions';
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
  InventorySummary,
  VehicleActionStatus,
  VehicleAction,
  CreateVehicleActionInput,
} from './types';
