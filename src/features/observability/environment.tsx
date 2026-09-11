import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  defaultInstrumentation,
  type ClientInstrumentation,
} from './instrumentation';

/**
 * Host-supplied observability and time boundaries. Both are injectable so tests
 * can observe telemetry and control the current time without touching
 * application state (System Design 6.1: no second application store).
 */
export interface AppEnvironment {
  instrumentation: ClientInstrumentation;
  /** Current time in epoch milliseconds. */
  now: () => number;
}

export const systemNow = (): number => Date.now();

const defaultAppEnvironment: AppEnvironment = {
  instrumentation: defaultInstrumentation,
  now: systemNow,
};

const AppEnvironmentContext = createContext<AppEnvironment>(defaultAppEnvironment);

export interface AppEnvironmentProviderProps {
  instrumentation?: ClientInstrumentation;
  now?: () => number;
  children: ReactNode;
}

export function AppEnvironmentProvider({
  instrumentation,
  now,
  children,
}: AppEnvironmentProviderProps) {
  const value = useMemo<AppEnvironment>(
    () => ({
      instrumentation: instrumentation ?? defaultAppEnvironment.instrumentation,
      now: now ?? defaultAppEnvironment.now,
    }),
    [instrumentation, now],
  );

  return (
    <AppEnvironmentContext.Provider value={value}>{children}</AppEnvironmentContext.Provider>
  );
}

export function useAppEnvironment(): AppEnvironment {
  return useContext(AppEnvironmentContext);
}
