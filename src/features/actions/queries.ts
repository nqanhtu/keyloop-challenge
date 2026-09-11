import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createVehicleAction,
  getVehicleActions,
  getVehicleById,
  type VehicleAction,
  type VehicleActionSummary,
  type VehicleActionStatus,
  type VehicleListResponse,
  type VehicleView,
} from '../../api';
import { isUnexpectedClientError } from '../errors/business-errors';
import { useAppEnvironment } from '../observability/environment';
import { inventorySummaryQueryKey, vehicleListQueryKeyPrefix } from '../inventory/queries';

/**
 * System Design 6.1: the detail vehicle and its action history are server
 * state owned by TanStack Query. The keys below are the only cache identity for
 * those resources, so list/detail/history stay coherent through one client.
 */
export const vehicleDetailQueryKey = (vehicleId: string) =>
  ['inventory', 'vehicle', vehicleId] as const;

export const vehicleActionsQueryKey = (vehicleId: string) =>
  ['inventory', 'vehicle-actions', vehicleId] as const;

export { vehicleListQueryKeyPrefix };

/** System Design 5.1: GET /vehicles/:vehicleId backs the detail surface. */
export function useVehicleDetail(vehicleId: string) {
  return useQuery({
    queryKey: vehicleDetailQueryKey(vehicleId),
    queryFn: () => getVehicleById(vehicleId),
  });
}

/** System Design 5.6: GET /vehicles/:vehicleId/actions returns full history. */
export function useVehicleActions(vehicleId: string) {
  return useQuery({
    queryKey: vehicleActionsQueryKey(vehicleId),
    queryFn: () => getVehicleActions(vehicleId),
  });
}

/** The created action is the authoritative record of the new current action. */
function toCurrentActionSummary(action: VehicleAction): VehicleActionSummary {
  return {
    id: action.id,
    status: action.status,
    note: action.note,
    createdAt: action.createdAt,
    createdByDisplayName: action.createdByDisplayName,
    createdByType: action.createdByType,
  };
}

export interface CreateActionDraft {
  status: VehicleActionStatus;
  note: string | null;
}

/**
 * System Design 6.7: the optimistic entry carries the draft status and note.
 * Its placeholder identity is never authoritative and never rendered — the
 * current-action surfaces show the status label and note only — and the POST
 * response replaces it on success.
 */
function toOptimisticCurrentAction(draft: CreateActionDraft): VehicleActionSummary {
  return {
    id: `optimistic:${draft.status.id}`,
    status: { id: draft.status.id, code: draft.status.code, label: draft.status.label },
    note: draft.note,
    createdAt: new Date().toISOString(),
    createdByDisplayName: '',
    createdByType: 'USER',
  };
}

interface CreateActionResult {
  created: VehicleAction;
}

interface CreateActionContext {
  previousDetail: VehicleView | undefined;
  previousLists: Array<[readonly unknown[], VehicleListResponse | undefined]>;
}

/**
 * System Design 5.7 / 6.7: submitting sets the optimistic current action in
 * both the inventory list and the detail, one POST creates the action, the
 * authoritative response replaces the optimistic value, and a failed POST
 * restores the previous current action.
 */
export function useCreateVehicleAction(vehicleId: string) {
  const queryClient = useQueryClient();
  const { instrumentation } = useAppEnvironment();

  return useMutation<CreateActionResult, Error, CreateActionDraft, CreateActionContext>({
    mutationFn: async (draft) => ({
      created: await createVehicleAction(vehicleId, {
        statusId: draft.status.id,
        note: draft.note,
      }),
    }),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: vehicleListQueryKeyPrefix });
      await queryClient.cancelQueries({ queryKey: vehicleDetailQueryKey(vehicleId) });

      const previousDetail = queryClient.getQueryData<VehicleView>(
        vehicleDetailQueryKey(vehicleId),
      );
      const previousLists = queryClient.getQueriesData<VehicleListResponse>({
        queryKey: vehicleListQueryKeyPrefix,
      });

      const optimisticAction = toOptimisticCurrentAction(draft);

      queryClient.setQueryData<VehicleView | undefined>(
        vehicleDetailQueryKey(vehicleId),
        (current) => (current ? { ...current, currentAction: optimisticAction } : current),
      );
      queryClient.setQueriesData<VehicleListResponse>(
        { queryKey: vehicleListQueryKeyPrefix },
        (current) => (current ? withCurrentAction(current, vehicleId, optimisticAction) : current),
      );

      return { previousDetail, previousLists };
    },
    onError: (error, _draft, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(vehicleDetailQueryKey(vehicleId), context.previousDetail);
      }
      for (const [key, data] of context?.previousLists ?? []) {
        if (data !== undefined) {
          queryClient.setQueryData(key, data);
        }
      }

      // System Design 8.1 / 8.6: expected business rejections are contained
      // regional outcomes, so only unexpected failures reach telemetry. The
      // report carries stable contract fields, never the draft or its note.
      if (isUnexpectedClientError(error)) {
        instrumentation.reportClientError(error, {
          source: 'mutation',
          endpoint: `/vehicles/${vehicleId}/actions`,
        });
      }
    },
    onSuccess: ({ created }) => {
      queryClient.setQueryData<VehicleView | undefined>(
        vehicleDetailQueryKey(vehicleId),
        (current) => (current ? { ...current, currentAction: toCurrentActionSummary(created) } : current),
      );
      queryClient.setQueryData<VehicleAction[] | undefined>(
        vehicleActionsQueryKey(vehicleId),
        (current) => (current ? mergeCreatedAction(current, created) : current),
      );
      void queryClient.invalidateQueries({ queryKey: vehicleListQueryKeyPrefix });
      void queryClient.invalidateQueries({ queryKey: vehicleActionsQueryKey(vehicleId) });
      // ACT-010: the inventory summary (aging-with-action) is a server-state
      // view of the same mutation, so it must re-read through TanStack Query.
      void queryClient.invalidateQueries({ queryKey: inventorySummaryQueryKey });
    },
  });
}

/** Applies a current action to the matching row of a server page. */
function withCurrentAction(
  page: VehicleListResponse,
  vehicleId: string,
  currentAction: VehicleActionSummary,
): VehicleListResponse {
  return {
    ...page,
    data: page.data.map((vehicle) =>
      vehicle.vehicleId === vehicleId ? { ...vehicle, currentAction } : vehicle,
    ),
  };
}

/** History is newest-first; the created action is the newest valid record. */
function mergeCreatedAction(current: VehicleAction[], created: VehicleAction): VehicleAction[] {
  return [created, ...current.filter((action) => action.id !== created.id)];
}
