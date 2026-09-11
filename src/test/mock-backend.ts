import { createMockBackend, type MockBackend, type MockBackendConfig } from '../mocks/composition';
import type { StorageLike } from '../mocks/actions/storage-adapter';
import { server } from '../mocks/server';

/**
 * Deterministic in-memory storage so a test never depends on browser storage
 * contents left behind by another test.
 */
class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

/**
 * Installs a fresh mock backend graph over in-memory storage for the current
 * test, so action creation, history, and inventory reads share one backend
 * instance while isolated from other tests.
 */
export function useIsolatedMockBackend(
  config: Omit<MockBackendConfig, 'storage'> = {},
): MockBackend {
  const backend = createMockBackend({ ...config, storage: new MemoryStorage() });
  server.use(...backend.handlers);
  return backend;
}
