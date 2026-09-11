import { describe, it, expect } from 'vitest';
import { StatusCatalog } from './status-catalog';
import { mockActionStatuses } from './fixtures';

describe('Status Catalog Seam (STAT-001, STAT-002)', () => {
  it('returns only active statuses in deterministic sortOrder order', () => {
    const catalog = new StatusCatalog(mockActionStatuses);
    const activeStatuses = catalog.getActiveStatuses();

    expect(activeStatuses.length).toBeGreaterThan(0);
    expect(activeStatuses.every((s) => s.isActive)).toBe(true);

    // Verify deterministic sortOrder order
    for (let i = 1; i < activeStatuses.length; i++) {
      expect(activeStatuses[i].sortOrder).toBeGreaterThanOrEqual(activeStatuses[i - 1].sortOrder);
    }
  });

  it('retains inactive historically referenced status identities without exposing them in active listing', () => {
    const catalog = new StatusCatalog(mockActionStatuses);
    const activeStatuses = catalog.getActiveStatuses();

    const inactiveStatus = mockActionStatuses.find((s) => !s.isActive);
    expect(inactiveStatus).toBeDefined();

    // Inactive status must not be present in active listing
    expect(activeStatuses.some((s) => s.id === inactiveStatus!.id)).toBe(false);

    // Inactive status must remain retrievable by identity for historical actions
    const retrieved = catalog.getStatusById(inactiveStatus!.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(inactiveStatus!.id);
    expect(retrieved?.label).toBe(inactiveStatus!.label);
    expect(retrieved?.isActive).toBe(false);
  });

  it('validates status existence and active state correctly', () => {
    const catalog = new StatusCatalog(mockActionStatuses);

    const activeStatus = mockActionStatuses.find((s) => s.isActive)!;
    const inactiveStatus = mockActionStatuses.find((s) => !s.isActive)!;

    expect(catalog.isStatusActive(activeStatus.id)).toBe(true);
    expect(catalog.isStatusActive(inactiveStatus.id)).toBe(false);
    expect(catalog.isStatusActive('non_existent_status')).toBe(false);
    expect(catalog.getStatusById('non_existent_status')).toBeNull();
  });
});
