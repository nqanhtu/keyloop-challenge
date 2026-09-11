import type { FreshnessState } from '../freshness';

export interface FreshnessNoticeProps {
  freshness: FreshnessState | null;
  /**
   * True while the sync metadata is still unknown. The header keeps its shape
   * with a skeleton instead of collapsing and shifting the page (UI §16).
   */
  isLoading?: boolean;
}

/**
 * System Design 6.9 / 8.5: always show the last successful synchronization and,
 * when the freshness threshold is exceeded, warn that inventory may be
 * outdated. The inventory itself stays rendered below the notice.
 */
export function FreshnessNotice({ freshness, isLoading = false }: FreshnessNoticeProps) {
  if (!freshness) {
    if (!isLoading) {
      return null;
    }

    return (
      <div className="freshness-notice" role="status" aria-label="Loading inventory freshness">
        <span
          className="ui-skeleton ui-skeleton--shimmer freshness-notice__placeholder"
          aria-hidden="true"
        />
      </div>
    );
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
