import type { PersistedVehicleAction } from './types';
import { mockSeedActions } from './fixtures';

export class ActionStorageError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ActionStorageError';
    this.details = details;
    Object.setPrototypeOf(this, ActionStorageError.prototype);
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_ACTIONS_STORAGE_KEY = 'keyloop:mock:vehicle-actions:v1';

export interface BrowserActionStorageAdapterOptions {
  storage?: StorageLike;
  storageKey?: string;
  initialSeed?: PersistedVehicleAction[];
}

export function isValidUtcIsoInstant(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/.exec(trimmed);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const msStr = match[7];
  const ms = msStr ? parseInt(msStr.slice(0, 3).padEnd(3, '0'), 10) : 0;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second &&
    date.getUTCMilliseconds() === ms
  );
}

function isValidPersistedAction(item: unknown): item is PersistedVehicleAction {
  if (!item || typeof item !== 'object') return false;
  const a = item as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    a.id.trim().length > 0 &&
    typeof a.vehicleId === 'string' &&
    a.vehicleId.trim().length > 0 &&
    typeof a.statusId === 'string' &&
    a.statusId.trim().length > 0 &&
    (a.note === null || typeof a.note === 'string') &&
    isValidUtcIsoInstant(a.createdAt) &&
    typeof a.createdByActorId === 'string' &&
    a.createdByActorId.trim().length > 0 &&
    typeof a.createdByDisplayName === 'string' &&
    a.createdByDisplayName.trim().length > 0 &&
    (a.createdByType === 'USER' || a.createdByType === 'SYSTEM' || a.createdByType === 'AI')
  );
}

class InMemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export function resolveDefaultBrowserStorage(
  scope?: { localStorage?: StorageLike },
): StorageLike {
  try {
    const target = scope ?? (typeof window !== 'undefined' ? window : undefined);
    if (target && target.localStorage) {
      return target.localStorage;
    }
  } catch (err) {
    throw new ActionStorageError(
      'Failed to access browser storage (localStorage unavailable or restricted)',
      { cause: String(err) },
    );
  }
  return new InMemoryStorage();
}

export class BrowserActionStorageAdapter {
  private readonly storage: StorageLike;
  private readonly storageKey: string;
  private readonly initialSeed: PersistedVehicleAction[];

  constructor(options: BrowserActionStorageAdapterOptions = {}) {
    this.storage = options.storage ?? resolveDefaultBrowserStorage();
    this.storageKey = options.storageKey ?? DEFAULT_ACTIONS_STORAGE_KEY;
    this.initialSeed = options.initialSeed ?? mockSeedActions;
  }

  getAll(): PersistedVehicleAction[] {
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch (err) {
      throw new ActionStorageError('Storage read failure', { cause: String(err) });
    }

    if (raw === null || raw === undefined) {
      if (this.initialSeed.length > 0) {
        this.writeStorage(this.initialSeed);
        return [...this.initialSeed];
      }
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new ActionStorageError('Failed to parse actions from storage: corrupt JSON', {
        cause: String(err),
      });
    }

    if (!Array.isArray(parsed)) {
      throw new ActionStorageError('Invalid persisted actions shape: expected an array');
    }

    for (let i = 0; i < parsed.length; i++) {
      if (!isValidPersistedAction(parsed[i])) {
        throw new ActionStorageError(`Invalid persisted action record at index ${i}`, {
          index: i,
          item: parsed[i],
        });
      }
    }

    return parsed;
  }

  append(action: PersistedVehicleAction): void {
    if (!isValidPersistedAction(action)) {
      throw new ActionStorageError('Cannot append invalid action record');
    }
    // Attempted append after failed read MUST perform ZERO writes.
    // getAll() verifies storage integrity and throws ActionStorageError without writing.
    const existing = this.getAll();
    const updated = [...existing, action];
    this.writeStorage(updated);
  }

  private writeStorage(actions: PersistedVehicleAction[]): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(actions));
    } catch (err) {
      throw new ActionStorageError('Storage write failure', { cause: String(err) });
    }
  }
}
