import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useQuery, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { App } from './App';
import { apiClient } from '../api/client';
import { createTestQueryClient } from '../test/test-utils';

function TestServerStateConsumer() {
  const { data, isLoading } = useQuery({
    queryKey: ['test-server-state'],
    queryFn: () => apiClient.get<{ status: string; count: number }>('/test/server-state'),
  });

  if (isLoading) {
    return <div>Loading test state...</div>;
  }
  return <div>Server state: {data?.status} (count: {data?.count})</div>;
}

describe('Application Bootstrap & Server-State Ownership Seams', () => {
  it('renders application through real TanStack Router and Query provider composition without runtime failure', async () => {
    const queryClient = createTestQueryClient();

    render(<App queryClient={queryClient} />);

    // Application shell renders heading once router resolves
    expect(
      await screen.findByRole('heading', { level: 1 }),
    ).toHaveTextContent(/inventory command center/i);

    // The index route redirects to the canonical dashboard, not a placeholder.
    expect(
      await screen.findByRole('region', { name: 'Inventory results' }),
    ).toBeInTheDocument();
  });

  it('demonstrates server-state ownership through TanStack Query without secondary store', async () => {
    server.use(
      http.get('/test/server-state', () => {
        return HttpResponse.json({
          status: 'synced',
          count: 42,
        });
      }),
    );

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TestServerStateConsumer />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/loading test state/i)).toBeInTheDocument();

    // Wait for TanStack Query to resolve server state
    await waitFor(() => {
      const state = queryClient.getQueryState(['test-server-state']);
      expect(state?.status).toBe('success');
    });

    const cachedData = queryClient.getQueryData<{ status: string; count: number }>([
      'test-server-state',
    ]);
    expect(cachedData?.status).toBe('synced');
    expect(cachedData?.count).toBe(42);
    expect(await screen.findByText(/server state: synced \(count: 42\)/i)).toBeInTheDocument();
  });
});
