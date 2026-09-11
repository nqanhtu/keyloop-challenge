import type { RequestHandler } from 'msw';
import { createMockBackend } from './composition';

export const defaultBackend = createMockBackend();
export const defaultInventoryService = defaultBackend.inventoryService;
export const defaultActionService = defaultBackend.actionService;
export const defaultActionRepository = defaultBackend.actionRepository;
export const defaultStatusCatalog = defaultBackend.statusCatalog;
export const defaultProjectionReader = defaultBackend.projectionReader;

export const inventoryHandlers: RequestHandler[] = defaultBackend.inventoryHandlers;
export const actionHandlers: RequestHandler[] = defaultBackend.actionHandlers;
export const handlers: RequestHandler[] = defaultBackend.handlers;

export { createMockBackend };
