import type {
  CreateVehicleActionInput,
  VehicleAction,
} from '../../api/types';
import { calculateAging } from '../aging/aging-policy';
import type { VehicleProjectionReader } from '../inventory/projection-reader';
import type { ActionRepository } from './action-repository';
import type { StatusCatalog } from './status-catalog';
import type { PersistedVehicleAction, TrustedActor, TrustedActorProvider } from './types';

export class ActionServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ActionServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ActionServiceError.prototype);
  }
}

export const defaultAuthorizedActor: TrustedActor = {
  id: 'actor_manager_1',
  displayName: 'Alex Manager',
  type: 'USER',
  isAuthorized: true,
};

export class DefaultTrustedActorProvider implements TrustedActorProvider {
  private actor: TrustedActor;

  constructor(actor: TrustedActor = defaultAuthorizedActor) {
    this.actor = actor;
  }

  getCurrentActor(): TrustedActor {
    return this.actor;
  }

  setActor(actor: TrustedActor): void {
    this.actor = actor;
  }
}

export interface ActionServiceConfig {
  actionRepository: ActionRepository;
  statusCatalog: StatusCatalog;
  projectionReader: VehicleProjectionReader;
  actorProvider?: TrustedActorProvider;
  timeZone?: string;
  referenceInstant?: string | Date;
  idGenerator?: () => string;
  clock?: () => string;
}

export class ActionService {
  private readonly actionRepository: ActionRepository;
  private readonly statusCatalog: StatusCatalog;
  private readonly projectionReader: VehicleProjectionReader;
  private readonly actorProvider: TrustedActorProvider;
  private readonly timeZone: string;
  private readonly referenceInstant?: string | Date;
  private readonly idGenerator: () => string;
  private readonly clock: () => string;

  constructor(config: ActionServiceConfig) {
    this.actionRepository = config.actionRepository;
    this.statusCatalog = config.statusCatalog;
    this.projectionReader = config.projectionReader;
    this.actorProvider = config.actorProvider ?? new DefaultTrustedActorProvider();
    this.timeZone = config.timeZone ?? 'UTC';
    this.referenceInstant = config.referenceInstant;
    this.idGenerator = config.idGenerator ?? (() => `action_${crypto.randomUUID()}`);
    let lastTimestampMs = 0;
    this.clock =
      config.clock ??
      (() => {
        let now = Date.now();
        if (now <= lastTimestampMs) {
          now = lastTimestampMs + 1;
        }
        lastTimestampMs = now;
        return new Date(now).toISOString();
      });
  }

  getStatusCatalog(): StatusCatalog {
    return this.statusCatalog;
  }

  getActorProvider(): TrustedActorProvider {
    return this.actorProvider;
  }

  private mapToVehicleAction(action: PersistedVehicleAction): VehicleAction {
    const status = this.statusCatalog.getStatusById(action.statusId);
    return {
      id: action.id,
      vehicleId: action.vehicleId,
      statusId: action.statusId,
      status: status
        ? { id: status.id, code: status.code, label: status.label }
        : { id: action.statusId, code: 'UNKNOWN', label: 'Unknown Status' },
      note: action.note,
      createdAt: action.createdAt,
      createdByActorId: action.createdByActorId,
      createdByDisplayName: action.createdByDisplayName,
      createdByType: action.createdByType,
    };
  }

  async getActionsForVehicle(vehicleId: string): Promise<VehicleAction[]> {
    const projection = await this.projectionReader.getById(vehicleId);
    if (!projection) {
      throw new ActionServiceError(404, 'VEHICLE_NOT_FOUND', `Vehicle not found: ${vehicleId}`);
    }

    const rawActions = await this.actionRepository.getActionsForVehicle(vehicleId);
    const withIndices = rawActions.map((action, index) => ({ action, index }));
    withIndices.sort((a, b) => {
      const timeDiff = new Date(b.action.createdAt).getTime() - new Date(a.action.createdAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.index - a.index;
    });

    return withIndices.map(({ action }) => this.mapToVehicleAction(action));
  }

  async createAction(
    vehicleId: string,
    input: CreateVehicleActionInput,
    actorOverride?: TrustedActor,
  ): Promise<VehicleAction> {
    // 1. Validate payload structure & enforce exact runtime allowlist
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ActionServiceError(400, 'INVALID_REQUEST_BODY', 'Request body must be a JSON object');
    }

    const allowedKeys = new Set(['statusId', 'note']);
    for (const key of Object.keys(input)) {
      if (!allowedKeys.has(key)) {
        throw new ActionServiceError(
          400,
          'INVALID_REQUEST_BODY',
          `Unrecognized field '${key}' in request body; only statusId and note are allowed`,
        );
      }
    }

    if (!input.statusId || typeof input.statusId !== 'string' || input.statusId.trim() === '') {
      throw new ActionServiceError(
        400,
        'INVALID_REQUEST_BODY',
        'statusId is required and must be a non-empty string',
      );
    }

    if (input.note !== undefined && input.note !== null && typeof input.note !== 'string') {
      throw new ActionServiceError(
        400,
        'INVALID_REQUEST_BODY',
        'note must be a string, null, or omitted',
      );
    }

    // 2. Validate actor authorization
    const actor = actorOverride ?? (await this.actorProvider.getCurrentActor());
    if (!actor || !actor.isAuthorized) {
      throw new ActionServiceError(
        403,
        'UNAUTHORIZED',
        'Actor is not authorized to record manager actions',
      );
    }

    // 3. Validate vehicle existence
    const projection = await this.projectionReader.getById(vehicleId);
    if (!projection) {
      throw new ActionServiceError(404, 'VEHICLE_NOT_FOUND', `Vehicle not found: ${vehicleId}`);
    }

    // 4. Validate snapshot presence
    if (!projection.isPresentInLatestSnapshot) {
      throw new ActionServiceError(
        400,
        'VEHICLE_NOT_PRESENT',
        `Vehicle ${vehicleId} is absent from latest inventory snapshot`,
      );
    }

    // 5. Validate aging eligibility
    const { isAging } = calculateAging({
      stockedAt: projection.stockedAt,
      currentInstant: this.referenceInstant,
      timeZone: this.timeZone,
    });
    if (!isAging) {
      throw new ActionServiceError(
        400,
        'VEHICLE_NOT_AGING',
        `Vehicle ${vehicleId} is not aging (> 90 days)`,
      );
    }

    // 6. Validate status existence
    const status = this.statusCatalog.getStatusById(input.statusId);
    if (!status) {
      throw new ActionServiceError(
        404,
        'STATUS_NOT_FOUND',
        `Action status not found: ${input.statusId}`,
      );
    }

    // 7. Validate status active state
    if (!status.isActive) {
      throw new ActionServiceError(
        400,
        'STATUS_INACTIVE',
        `Action status ${input.statusId} is inactive and cannot be assigned to new actions`,
      );
    }

    // 8. Create and persist immutable action
    const id = this.idGenerator();
    const createdAt = this.clock();
    const note = input.note ?? null;

    const persistedAction: PersistedVehicleAction = {
      id,
      vehicleId,
      statusId: status.id,
      note,
      createdAt,
      createdByActorId: actor.id,
      createdByDisplayName: actor.displayName,
      createdByType: actor.type,
    };

    await this.actionRepository.appendAction(persistedAction);

    return this.mapToVehicleAction(persistedAction);
  }
}
