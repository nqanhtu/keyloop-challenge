import type { VehicleActionStatus } from '../../api/types';
import type { PersistedVehicleAction } from './types';

export const mockActionStatuses: VehicleActionStatus[] = [
  {
    id: 'status_price_reduction',
    code: 'PRICE_REDUCTION',
    label: 'Price Reduction',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'status_wholesale_auction',
    code: 'WHOLESALE_AUCTION',
    label: 'Wholesale / Auction',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'status_retail_promotion',
    code: 'RETAIL_PROMOTION',
    label: 'Retail Promotion',
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'status_inspection_required',
    code: 'INSPECTION_REQUIRED',
    label: 'Inspection Required',
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'status_legacy_hold',
    code: 'LEGACY_HOLD',
    label: 'Legacy Hold (Discontinued)',
    isActive: false,
    sortOrder: 5,
  },
];

export const mockSeedActions: PersistedVehicleAction[] = [
  {
    id: 'act_seed_001',
    vehicleId: 'veh_004',
    statusId: 'status_legacy_hold',
    note: 'Initial hold prior to policy deprecation',
    createdAt: '2026-05-15T09:00:00Z',
    createdByActorId: 'actor_system',
    createdByDisplayName: 'System Migration',
    createdByType: 'SYSTEM',
  },
];
