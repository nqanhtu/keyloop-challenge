import { useQuery } from '@tanstack/react-query';
import {
  getFilterOptions,
  getInventorySummary,
  getVehicleActionStatuses,
  getVehicles,
} from '../../api';
import { toVehicleListQuery, type InventorySearch } from './search';

/**
 * System Design 6.1: these keys are the single cache identity for inventory
 * server state, so cross-feature readers/writers (dashboard and actions) stay
 * coherent through TanStack Query.
 */
export const inventorySummaryQueryKey = ['inventory', 'summary'] as const;
export const vehicleListQueryKeyPrefix = ['inventory', 'vehicles'] as const;
export const actionStatusesQueryKey = ['inventory', 'action-statuses'] as const;

/**
 * System Design 6.1: server state is owned by TanStack Query, never duplicated
 * into component state. The URL is the only source of discovery state.
 */
export function useInventorySummary() {
  return useQuery({
    queryKey: inventorySummaryQueryKey,
    queryFn: getInventorySummary,
  });
}

export function useVehicleList(search: InventorySearch) {
  const query = toVehicleListQuery(search);

  return useQuery({
    queryKey: [...vehicleListQueryKeyPrefix, query],
    queryFn: () => getVehicles(query),
  });
}

export function useInventoryFilterOptions(make?: string) {
  const allOptionsQuery = useQuery({
    queryKey: ['inventory', 'filter-options', null],
    queryFn: () => getFilterOptions(),
  });

  const narrowedOptionsQuery = useQuery({
    queryKey: ['inventory', 'filter-options', make ?? null],
    queryFn: () => getFilterOptions({ make }),
    enabled: Boolean(make),
  });

  const models = make ? narrowedOptionsQuery.data?.models : allOptionsQuery.data?.models;

  return {
    makes: allOptionsQuery.data?.makes ?? [],
    models: models ?? [],
    isLoading:
      allOptionsQuery.isPending || (Boolean(make) && narrowedOptionsQuery.isPending),
  };
}

/** Dynamic, database-driven action statuses used by the action-status filter. */
export function useActionStatuses() {
  return useQuery({
    queryKey: actionStatusesQueryKey,
    queryFn: getVehicleActionStatuses,
  });
}
