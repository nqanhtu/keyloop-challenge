import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { createAppRouter } from './router';
import {
  AppEnvironmentProvider,
  type AppEnvironment,
} from '../features/observability/environment';

export const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export interface AppProps {
  queryClient?: QueryClient;
  router?: AnyRouter;
  /** Injectable observability sink for the client instrumentation boundary. */
  instrumentation?: AppEnvironment['instrumentation'];
  /** Controllable current time (epoch milliseconds) for freshness handling. */
  now?: AppEnvironment['now'];
}

export function App({
  queryClient = defaultQueryClient,
  router,
  instrumentation,
  now,
}: AppProps) {
  const activeRouter = router ?? createAppRouter();

  return (
    <AppEnvironmentProvider instrumentation={instrumentation} now={now}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={activeRouter} />
      </QueryClientProvider>
    </AppEnvironmentProvider>
  );
}
