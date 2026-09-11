/**
 * System Design 6.9 / 8.6: an API failure is contained to the smallest
 * reasonable region and offers a retry, so unaffected regions stay usable.
 */
export interface RegionalErrorProps {
  /** The region this failure is contained to, used for accessible naming. */
  region: string;
  message: string;
  onRetry: () => void;
}

export function RegionalError({ region, message, onRetry }: RegionalErrorProps) {
  return (
    <div className="regional-error" role="alert" data-testid="regional-error">
      <p className="regional-error__message">{message}</p>
      <button
        type="button"
        className="button regional-error__retry"
        onClick={onRetry}
        aria-label={`Retry loading ${region}`}
      >
        Retry
      </button>
    </div>
  );
}
