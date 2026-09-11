import type { ReactNode } from 'react';

export interface VisuallyHiddenProps {
  children: ReactNode;
}

/**
 * U03 shared primitive: text that is part of the accessibility tree but not
 * visible, used to give a compact visual value a complete spoken label.
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className="ui-sr-only">{children}</span>;
}
