import type { VehicleAction } from '../../api/types';

/**
 * Actions are stored as UTC instants; the display keeps the UTC instant
 * explicit instead of applying an ambiguous local-time interpretation.
 */
export function formatActionTimestamp(createdAt: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(createdAt);
  return match ? `${match[1]} ${match[2]} UTC` : createdAt;
}

export interface ActionHistoryProps {
  actions: VehicleAction[];
}

/**
 * System Design 6.6: the detail surface shows the complete immutable history
 * newest-first with status, actor, timestamp, and note. The server already
 * orders the history, so the list renders the returned order as-is.
 */
export function ActionHistory({ actions }: ActionHistoryProps) {
  return (
    <section className="vehicle-detail__section" aria-label="Action history">
      <h3>Action history</h3>
      {actions.length === 0 ? (
        <p className="action-history__empty">No actions recorded yet.</p>
      ) : (
        <ol className="action-history">
          {actions.map((action) => (
            <li key={action.id} className="action-history__item">
              <p className="action-history__status">{action.status.label}</p>
              <dl className="action-history__facts">
                <div className="action-history__fact">
                  <dt>Actor</dt>
                  <dd>{action.createdByDisplayName}</dd>
                </div>
                <div className="action-history__fact">
                  <dt>Recorded</dt>
                  <dd>
                    <time dateTime={action.createdAt}>
                      {formatActionTimestamp(action.createdAt)}
                    </time>
                  </dd>
                </div>
                <div className="action-history__fact">
                  <dt>Note</dt>
                  <dd>{action.note ? action.note : 'No note'}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
