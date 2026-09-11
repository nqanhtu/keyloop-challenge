import type { RequestHandler } from 'msw';
import type { VehicleProjectionReader } from './inventory/projection-reader';
import { FixtureVehicleProjectionReader } from './inventory/projection-reader';
import type { CurrentActionReader } from './inventory/action-reader';
import { InventoryService } from './inventory/inventory-service';
import { createInventoryHandlers } from './inventory/handlers';
import { StatusCatalog } from './actions/status-catalog';
import type { ActionRepository } from './actions/action-repository';
import { PersistentActionRepository } from './actions/action-repository';
import { BrowserActionStorageAdapter, type StorageLike } from './actions/storage-adapter';
import { ActionService, DefaultTrustedActorProvider } from './actions/action-service';
import type { TrustedActorProvider } from './actions/types';
import { ActionCurrentActionReader } from './actions/current-action-reader';
import { createActionHandlers } from './actions/handlers';

export interface MockBackendConfig {
  storage?: StorageLike;
  storageKey?: string;
  projectionReader?: VehicleProjectionReader;
  statusCatalog?: StatusCatalog;
  actionRepository?: ActionRepository;
  actorProvider?: TrustedActorProvider;
  timeZone?: string;
  referenceInstant?: string | Date;
  clock?: () => string;
  idGenerator?: () => string;
}

export interface MockBackend {
  projectionReader: VehicleProjectionReader;
  statusCatalog: StatusCatalog;
  actionRepository: ActionRepository;
  actorProvider: TrustedActorProvider;
  actionService: ActionService;
  currentActionReader: CurrentActionReader;
  inventoryService: InventoryService;
  actionHandlers: RequestHandler[];
  inventoryHandlers: RequestHandler[];
  handlers: RequestHandler[];
}

export function createMockBackend(config: MockBackendConfig = {}): MockBackend {
  const projectionReader = config.projectionReader ?? new FixtureVehicleProjectionReader();
  const statusCatalog = config.statusCatalog ?? new StatusCatalog();
  const storageAdapter = new BrowserActionStorageAdapter({
    storage: config.storage,
    storageKey: config.storageKey,
  });
  const actionRepository = config.actionRepository ?? new PersistentActionRepository(storageAdapter);
  const actorProvider = config.actorProvider ?? new DefaultTrustedActorProvider();
  const actionService = new ActionService({
    actionRepository,
    statusCatalog,
    projectionReader,
    actorProvider,
    timeZone: config.timeZone ?? 'UTC',
    referenceInstant: config.referenceInstant ?? '2026-06-01T12:00:00Z',
    clock: config.clock,
    idGenerator: config.idGenerator,
  });
  const currentActionReader = new ActionCurrentActionReader(actionRepository, statusCatalog);
  const inventoryService = new InventoryService({
    projectionReader,
    currentActionReader,
    timeZone: config.timeZone ?? 'UTC',
    referenceInstant: config.referenceInstant ?? '2026-06-01T12:00:00Z',
  });

  const actionHandlers = createActionHandlers(actionService);
  const inventoryHandlers = createInventoryHandlers(inventoryService);
  const handlers = [...inventoryHandlers, ...actionHandlers];

  return {
    projectionReader,
    statusCatalog,
    actionRepository,
    actorProvider,
    actionService,
    currentActionReader,
    inventoryService,
    actionHandlers,
    inventoryHandlers,
    handlers,
  };
}
