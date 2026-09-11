import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Link,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import { InventoryDashboard } from '../features/inventory/inventory-dashboard';
import { parseInventorySearch } from '../features/inventory/search';

function RootComponent() {
  return (
    <div className="app-shell">
      <Outlet />
    </div>
  );
}

function IndexComponent() {
  return (
    <main>
      <h1>Keyloop Inventory Command Center</h1>
      <p>Foundation ready.</p>
      <p>
        <Link to="/inventory">Open inventory dashboard</Link>
      </p>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
});

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inventory',
  validateSearch: (search: Record<string, unknown>) => parseInventorySearch(search),
  component: InventoryRouteComponent,
});

/**
 * System Design 6.1: filters, sorting, and page are URL state owned by the
 * router. The dashboard reads the validated search and writes changes back
 * through the route's navigate function.
 *
 * TanStack Router *merges* the `validateSearch` result over the raw location
 * search instead of replacing it, so a value that `parseInventorySearch` drops
 * (for example `?pageSize=37`) would otherwise survive on `useSearch()` and
 * reach the dashboard. Normalizing once here — the boundary where the dashboard
 * receives its search — guarantees the dashboard only ever renders and requests
 * the sanitized, effective InventorySearch. The address bar keeps the raw value
 * (accepted; the app normalizes behaviour without rewriting the URL).
 */
function InventoryRouteComponent() {
  const search = parseInventorySearch(inventoryRoute.useSearch());
  const navigate = inventoryRoute.useNavigate();

  return (
    <InventoryDashboard
      search={search}
      onApplySearch={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}

export const routeTree = rootRoute.addChildren([indexRoute, inventoryRoute]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history: history ?? (typeof window === 'undefined' ? createMemoryHistory({ initialEntries: ['/'] }) : undefined),
  });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
