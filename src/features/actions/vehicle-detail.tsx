import { useEffect, useRef } from 'react';
import type { VehicleActionSummary, VehicleView } from '../../api/types';
import { Button } from '../../app/ui';
import { clientErrorMessage } from '../errors/business-errors';
import { AgingIndicator } from '../inventory/components/aging-indicator';
import { VehicleDetailSkeleton } from '../inventory/components/loading-skeleton';
import { RegionalError } from '../inventory/components/regional-error';
import type { ViewportTier } from '../inventory/use-viewport-tier';
import { ActionHistory, formatActionTimestamp } from './action-history';
import { CreateActionForm } from './action-form';
import { useVehicleActions, useVehicleDetail } from './queries';
import './vehicle-detail.css';

/** System Design 6.5: one responsive master-detail surface, three modalities. */
export const DETAIL_VARIANT_BY_TIER: Record<ViewportTier, 'drawer' | 'sheet' | 'fullscreen'> = {
  desktop: 'drawer',
  tablet: 'sheet',
  mobile: 'fullscreen',
};

export interface VehicleDetailProps {
  vehicleId: string;
  tier: ViewportTier;
  onClose: () => void;
  /**
   * Accessible name of the control that opened the detail, captured when the
   * user activates it. The inventory list re-renders while the detail is open
   * (the selected vehicle is URL state), which replaces the trigger element, so
   * focus is returned by name. It is `null` when the detail was opened without
   * a click (direct URL, reload, browser back/forward).
   */
  focusReturnLabel?: string | null;
}

function escapeAttributeValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * System Design 6.10: closing the detail always hands focus to a sensible
 * element instead of dropping it on `<body>`. The opener is preferred by its
 * accessible name (the list replaces the trigger element on re-render), then
 * the selected vehicle's trigger, then the inventory results region, then the
 * page heading. The fallbacks cover the non-click open paths where no opener
 * was captured.
 */
function restoreFocus(label: string | null | undefined, vehicleId: string): void {
  const candidates: Array<HTMLElement | null> = [];
  if (label) {
    candidates.push(
      document.querySelector<HTMLElement>(`[aria-label="${escapeAttributeValue(label)}"]`),
    );
  }
  candidates.push(
    document.querySelector<HTMLElement>(
      `[data-vehicle-detail-trigger="${CSS.escape(vehicleId)}"]`,
    ),
    document.querySelector<HTMLElement>('[data-focus-fallback="inventory-results"]'),
    document.querySelector<HTMLElement>('[data-focus-fallback="page-heading"]'),
  );

  for (const candidate of candidates) {
    if (candidate) {
      candidate.focus();
      return;
    }
  }
}

/**
 * System Design 6.5: vehicle summary, current action, create-action form, and
 * full action history in that order.
 */
export function VehicleDetail({
  vehicleId,
  tier,
  onClose,
  focusReturnLabel,
}: VehicleDetailProps) {
  const detailQuery = useVehicleDetail(vehicleId);
  const historyQuery = useVehicleActions(vehicleId);
  const variant = DETAIL_VARIANT_BY_TIER[tier];
  const vehicle = detailQuery.data;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /**
   * Focus-out must run exactly once, when the detail unmounts, while still
   * seeing the opener that was current at close time. Mirroring the latest
   * committed props into a ref from an effect (never read during render) keeps
   * the unmount cleanup stable and the render pure.
   */
  const focusReturnRef = useRef<{ label: string | null; vehicleId: string }>({
    label: null,
    vehicleId,
  });

  /**
   * System Design 6.10: the detail is a keyboard-operable modal surface. Focus
   * moves into the detail on open and returns to a sensible element on close,
   * so a keyboard user is never stranded behind or after the dialog.
   */
  useEffect(() => {
    focusReturnRef.current = { label: focusReturnLabel ?? null, vehicleId };
  }, [focusReturnLabel, vehicleId]);

  // Focus in: the detail's first control receives focus when it opens.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Focus out: closing the detail always hands focus to a sensible element.
  useEffect(() => {
    return () => {
      const { label, vehicleId: closedVehicleId } = focusReturnRef.current;
      restoreFocus(label, closedVehicleId);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* UI §7.2 / §17.8: a modal surface needs a backdrop so the drawer/sheet
       * reads as layered above the page rather than as a floating box. */}
      <div className="vehicle-detail-scrim" aria-hidden="true" onClick={onClose} />
      <div
        className={`vehicle-detail vehicle-detail--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={vehicle ? `Vehicle detail: ${vehicle.make} ${vehicle.model}` : 'Vehicle detail'}
        data-variant={variant}
      >
        <header className="vehicle-detail__header">
          <h2>Vehicle detail</h2>
          <Button ref={closeButtonRef} onClick={onClose} aria-label="Close vehicle detail">
            Close
          </Button>
        </header>

        {vehicle ? (
          <VehicleSummary vehicle={vehicle} />
        ) : detailQuery.isError ? (
          <section className="vehicle-detail__section" aria-label="Vehicle summary">
            <RegionalError
              region="vehicle summary"
              message={clientErrorMessage(detailQuery.error, 'Unable to load this vehicle.')}
              onRetry={() => void detailQuery.refetch()}
            />
          </section>
        ) : (
          <VehicleDetailSkeleton />
        )}

        <CurrentAction action={vehicle?.currentAction ?? null} />

        <section className="vehicle-detail__section" aria-label="Record an action">
          <h3>Record an action</h3>
          <CreateActionForm vehicleId={vehicleId} />
        </section>

        <ActionHistory
          actions={historyQuery.data ?? []}
          isPending={historyQuery.isPending}
          isError={historyQuery.isError}
          errorMessage={
            historyQuery.isError
              ? clientErrorMessage(historyQuery.error, 'Unable to load action history.')
              : undefined
          }
          onRetry={() => void historyQuery.refetch()}
        />
      </div>
    </>
  );
}

function VehicleSummary({ vehicle }: { vehicle: VehicleView }) {
  return (
    <section className="vehicle-detail__section" aria-label="Vehicle summary">
      <h3>Vehicle summary</h3>
      <dl className="vehicle-detail__facts">
        <div className="vehicle-detail__fact">
          <dt>Vehicle</dt>
          <dd>
            {vehicle.make} {vehicle.model}
          </dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>VIN</dt>
          <dd>{vehicle.vin}</dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Stocked</dt>
          <dd>{vehicle.stockedAt.slice(0, 10)}</dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Inventory age</dt>
          <dd>{vehicle.inventoryAgeDays} days</dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Aging</dt>
          <dd>
            <AgingIndicator isAging={vehicle.isAging} />
          </dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Inventory status</dt>
          <dd>{vehicle.upstreamStatus}</dd>
        </div>
      </dl>
    </section>
  );
}

function CurrentAction({ action }: { action: VehicleActionSummary | null }) {
  return (
    <section className="vehicle-detail__section" aria-label="Current action">
      <h3>Current action</h3>
      {action === null ? (
        <p className="vehicle-detail__current-empty">No current action</p>
      ) : (
        <div className="vehicle-detail__current">
          <p className="vehicle-detail__current-status">{action.status.label}</p>
          {/* UI §14.2: the current action carries actor, timestamp and note. */}
          <dl className="vehicle-detail__current-meta">
            {action.createdByDisplayName ? (
              <div className="vehicle-detail__current-meta-item">
                <dt>Actor</dt>
                <dd>{action.createdByDisplayName}</dd>
              </div>
            ) : null}
            <div className="vehicle-detail__current-meta-item">
              <dt>Recorded</dt>
              <dd>
                <time dateTime={action.createdAt}>{formatActionTimestamp(action.createdAt)}</time>
              </dd>
            </div>
          </dl>
          {action.note ? <p className="vehicle-detail__current-note">{action.note}</p> : null}
        </div>
      )}
    </section>
  );
}
