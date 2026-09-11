import { useEffect, useState } from 'react';

/**
 * System Design 6.3: desktop, tablet, and mobile present the inventory list
 * differently, so the dashboard needs to know which tier it is rendering for.
 * The queries below are the single source of truth shared with the stylesheet.
 */
export type ViewportTier = 'desktop' | 'tablet' | 'mobile';

export const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';
export const TABLET_VIEWPORT_QUERY = '(min-width: 768px) and (max-width: 1023px)';

export interface MatchMediaLike {
  matches: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

export function readViewportTier(
  matchMedia: ((query: string) => MatchMediaLike) | undefined,
): ViewportTier {
  if (typeof matchMedia !== 'function') {
    return 'desktop';
  }
  if (matchMedia(MOBILE_VIEWPORT_QUERY).matches) {
    return 'mobile';
  }
  if (matchMedia(TABLET_VIEWPORT_QUERY).matches) {
    return 'tablet';
  }
  return 'desktop';
}

function currentMatchMedia(): ((query: string) => MatchMediaLike) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined;
}

/**
 * Reactive viewport tier. Without matchMedia support (for example a jsdom test
 * environment) the dashboard renders the desktop presentation.
 */
export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(() => readViewportTier(currentMatchMedia()));

  useEffect(() => {
    const matchMedia = currentMatchMedia();
    if (!matchMedia) {
      return;
    }

    const update = () => setTier(readViewportTier(matchMedia));
    const mobileQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
    const tabletQuery = matchMedia(TABLET_VIEWPORT_QUERY);

    update();
    mobileQuery.addEventListener?.('change', update);
    tabletQuery.addEventListener?.('change', update);

    return () => {
      mobileQuery.removeEventListener?.('change', update);
      tabletQuery.removeEventListener?.('change', update);
    };
  }, []);

  return tier;
}
