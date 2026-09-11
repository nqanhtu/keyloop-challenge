export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export interface ApiClientConfig {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

export type UpstreamVehicleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNAVAILABLE';

export interface VehicleActionStatusSummary {
  id: string;
  code: string;
  label: string;
}

export interface VehicleActionSummary {
  id: string;
  status: VehicleActionStatusSummary;
  note: string | null;
  createdAt: string;
  createdByDisplayName: string;
  createdByType: 'USER' | 'SYSTEM' | 'AI';
}

export interface VehicleView {
  vehicleId: string;
  vin: string;
  make: string;
  model: string;
  stockedAt: string;
  upstreamStatus: UpstreamVehicleStatus | string;
  inventoryAgeDays: number;
  isAging: boolean;
  currentAction: VehicleActionSummary | null;
}

export type VehicleSortOption = 'inventoryAgeDays:asc' | 'inventoryAgeDays:desc';

export interface VehicleListQuery {
  make?: string;
  model?: string;
  ageMinDays?: number;
  ageMaxDays?: number;
  inventoryStatus?: UpstreamVehicleStatus | string;
  actionStatusId?: string;
  agingOnly?: boolean;
  sort?: VehicleSortOption;
  page?: number;
  pageSize?: number;
}

export interface VehicleListMeta {
  page: number;
  pageSize: number;
  total: number;
  lastSuccessfulSyncAt: string;
}

export interface VehicleListResponse {
  data: VehicleView[];
  meta: VehicleListMeta;
}

export interface InventoryFilterOptions {
  makes: string[];
  models: string[];
}

export interface InventorySummary {
  totalInventory: number;
  agingVehicles: number;
  agingWithAction: number;
  lastSuccessfulSyncAt: string;
}

export interface VehicleActionStatus {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

export interface VehicleAction {
  id: string;
  vehicleId: string;
  statusId: string;
  status: VehicleActionStatusSummary;
  note: string | null;
  createdAt: string;
  createdByActorId: string;
  createdByDisplayName: string;
  createdByType: 'USER' | 'SYSTEM' | 'AI';
}

export interface CreateVehicleActionInput {
  statusId: string;
  note?: string | null;
}
