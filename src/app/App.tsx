import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { createAppRouter } from './router';

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
}

export function App({
  queryClient = defaultQueryClient,
  router,
}: AppProps) {
  const activeRouter = router ?? createAppRouter();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={activeRouter} />
    </QueryClientProvider>
  );
}
