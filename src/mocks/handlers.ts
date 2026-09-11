import type { RequestHandler } from 'msw';
import { inventoryHandlers } from './inventory/handlers';

export { inventoryHandlers };

/**
 * Seams for upcoming task handler composition:
 * - T02: Inventory query & filter endpoints (/vehicles, /inventory/filter-options)
 * - T03: Summary, dynamic action statuses, action history, and manager action persistence
 */
export const actionHandlers: RequestHandler[] = [];

export const handlers: RequestHandler[] = [
  ...inventoryHandlers,
  ...actionHandlers,
];
