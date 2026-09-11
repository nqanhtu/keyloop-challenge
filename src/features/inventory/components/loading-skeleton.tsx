import type { ReactNode } from 'react';

/**
 * System Design 6.9: loading is presented as localized skeletons per region,
 * so the application shell (header, filters, surrounding regions) always
 * remains present instead of being replaced by a full-page spinner.
 *
 * Each skeleton exposes a single status live region naming the region it
 * stands in for; the decorative bars are hidden from assistive technology.
 */

export interface SkeletonBarsProps {
  count: number;
  className: string;
}

function SkeletonBars({ count, className }: SkeletonBarsProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={`skeleton ${className}`} aria-hidden="true" />
      ))}
    </>
  );
}

export interface RegionSkeletonProps {
  label: string;
  testId: string;
  className: string;
  children: ReactNode;
}

function RegionSkeleton({ label, testId, className, children }: RegionSkeletonProps) {
  return (
    <div className={className} data-testid={testId} role="status" aria-label={label}>
      {children}
    </div>
  );
}

/** KPI region skeleton (System Design 6.2). */
export function KpiCardsSkeleton() {
  return (
    <section className="kpi-section" aria-label="Inventory summary" aria-busy="true">
      <RegionSkeleton
        label="Loading inventory summary"
        testId="kpi-skeleton"
        className="kpi-skeleton"
      >
        <span className="skeleton skeleton--kpi-label" aria-hidden="true" />
        <span className="skeleton skeleton--kpi-value" aria-hidden="true" />
      </RegionSkeleton>
    </section>
  );
}

/** Inventory list region skeleton (System Design 6.3 / 6.9). */
export function InventoryListSkeleton() {
  return (
    <RegionSkeleton
      label="Loading inventory list"
      testId="inventory-list-skeleton"
      className="inventory-list-skeleton"
    >
      <SkeletonBars count={6} className="skeleton--row" />
    </RegionSkeleton>
  );
}

/** Vehicle detail region skeleton (System Design 6.5 / 6.9). */
export function VehicleDetailSkeleton() {
  return (
    <RegionSkeleton
      label="Loading vehicle detail"
      testId="vehicle-detail-skeleton"
      className="vehicle-detail-skeleton"
    >
      <SkeletonBars count={4} className="skeleton--detail-row" />
    </RegionSkeleton>
  );
}
