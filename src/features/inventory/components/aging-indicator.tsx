export interface AgingIndicatorProps {
  isAging: boolean;
}

/**
 * System Design 6.10: aging communication must not rely on color alone.
 * The indicator always carries readable "AGING" text; the dot is decorative.
 */
export function AgingIndicator({ isAging }: AgingIndicatorProps) {
  if (!isAging) {
    return <span className="aging-indicator aging-indicator--current">Not aging</span>;
  }

  return (
    <span className="aging-indicator aging-indicator--aging">
      <span className="aging-indicator__dot" aria-hidden="true" />
      AGING
    </span>
  );
}
