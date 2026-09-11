import type { SyncMetadata, VehicleProjection } from './types';

export const mockSyncMetadata: SyncMetadata = {
  lastSuccessfulSyncAt: '2026-06-01T12:00:00Z',
};

// Base vehicles covering specific test cases (89, 90, 91 days, statuses, makes, presence)
const baseVehicles: VehicleProjection[] = [
  {
    vehicleId: 'veh_001',
    vin: '1HGCR2F83HA000001',
    make: 'BMW',
    model: 'X5',
    stockedAt: '2026-03-02T12:00:00Z', // 91 days at 2026-06-01 (aging)
    upstreamStatus: 'AVAILABLE',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  },
  {
    vehicleId: 'veh_002',
    vin: '1HGCR2F83HA000002',
    make: 'BMW',
    model: '3 Series',
    stockedAt: '2026-03-03T12:00:00Z', // 90 days at 2026-06-01 (not aging)
    upstreamStatus: 'AVAILABLE',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  },
  {
    vehicleId: 'veh_003',
    vin: '1HGCR2F83HA000003',
    make: 'BMW',
    model: 'M4',
    stockedAt: '2026-03-04T12:00:00Z', // 89 days at 2026-06-01 (not aging)
    upstreamStatus: 'AVAILABLE',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  },
  {
    vehicleId: 'veh_004',
    vin: '1HGCR2F83HA000004',
    make: 'Audi',
    model: 'Q7',
    stockedAt: '2026-01-01T12:00:00Z', // 151 days at 2026-06-01 (aging)
    upstreamStatus: 'AVAILABLE',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  },
  {
    vehicleId: 'veh_005',
    vin: '1HGCR2F83HA000005',
    make: 'Audi',
    model: 'A4',
    stockedAt: '2026-05-20T12:00:00Z', // 12 days at 2026-06-01 (not aging)
    upstreamStatus: 'RESERVED',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  },
  {
    vehicleId: 'veh_sold',
    vin: '1HGCR2F83HA000006',
    make: 'Mercedes-Benz',
    model: 'C-Class',
    stockedAt: '2026-04-15T12:00:00Z', // 47 days (not aging)
    upstreamStatus: 'SOLD',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  },
  {
    vehicleId: 'veh_unavail',
    vin: '1HGCR2F83HA000007',
    make: 'Ford',
    model: 'F-150',
    stockedAt: '2026-02-15T12:00:00Z', // 106 days (aging)
    upstreamStatus: 'UNAVAILABLE',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  },
  // Absent vehicle records (isPresentInLatestSnapshot: false)
  {
    vehicleId: 'veh_absent',
    vin: '1HGCR2F83HA000008',
    make: 'Porsche',
    model: '911',
    stockedAt: '2026-01-10T12:00:00Z',
    upstreamStatus: 'AVAILABLE',
    isPresentInLatestSnapshot: false,
    lastSeenAt: '2026-05-25T12:00:00Z',
  },
  {
    vehicleId: 'veh_absent_sold',
    vin: '1HGCR2F83HA000009',
    make: 'Toyota',
    model: 'Corolla',
    stockedAt: '2026-02-20T12:00:00Z',
    upstreamStatus: 'SOLD',
    isPresentInLatestSnapshot: false,
    lastSeenAt: '2026-05-20T12:00:00Z',
  },
];

// Generate additional present vehicles to reach 55 total present records for pagination tests
const makesAndModels: Array<{ make: string; model: string }> = [
  { make: 'BMW', model: 'X5' },
  { make: 'BMW', model: '3 Series' },
  { make: 'Audi', model: 'A4' },
  { make: 'Audi', model: 'Q7' },
  { make: 'Toyota', model: 'Camry' },
  { make: 'Toyota', model: 'RAV4' },
  { make: 'Honda', model: 'Civic' },
  { make: 'Honda', model: 'CR-V' },
  { make: 'Tesla', model: 'Model 3' },
  { make: 'Tesla', model: 'Model Y' },
];

const generatedPresentVehicles: VehicleProjection[] = [];
for (let i = 10; i <= 57; i++) {
  const mm = makesAndModels[i % makesAndModels.length];
  // Stagger stockedAt dates between 10 days and 120 days ago
  const daysAgo = 10 + (i % 110);
  const stockedDate = new Date('2026-06-01T12:00:00Z');
  stockedDate.setUTCDate(stockedDate.getUTCDate() - daysAgo);

  generatedPresentVehicles.push({
    vehicleId: `veh_${i.toString().padStart(3, '0')}`,
    vin: `1HGCR2F83HA${i.toString().padStart(6, '0')}`,
    make: mm.make,
    model: mm.model,
    stockedAt: stockedDate.toISOString(),
    upstreamStatus: i % 7 === 0 ? 'RESERVED' : 'AVAILABLE',
    isPresentInLatestSnapshot: true,
    lastSeenAt: '2026-06-01T12:00:00Z',
  });
}

export const mockVehicleProjections: VehicleProjection[] = [
  ...baseVehicles,
  ...generatedPresentVehicles,
];
