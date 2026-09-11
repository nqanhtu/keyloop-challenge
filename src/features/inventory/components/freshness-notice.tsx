import type { FreshnessState } from '../freshness';

export interface FreshnessNoticeProps {
  freshness: FreshnessState | null;
}

/**
 * System Design 6.9 / 8.5: always show the last successful synchronization and,
 * when the freshness threshold is exceeded, warn that inventory may be
 * outdated. The inventory itself stays rendered below the notice.
 */
export function FreshnessNotice({ freshness }: FreshnessNoticeProps) {
  if (!freshness) {
    return null;
  }

  return (
    <div className="freshness-notice">
      <p className="freshness-notice__label" data-testid="freshness-label">
        {freshness.lastUpdatedLabel}
      </p>
      {freshness.warning ? (
        <p
          className="freshness-notice__warning"
          data-testid="freshness-warning"
          role="status"
        >
          {freshness.warning}
        </p>
      ) : null}
    </div>
  );
}
