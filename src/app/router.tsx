import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
function RootComponent() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <Outlet />
    </div>
  );
}

function IndexComponent() {
  return (
    <main>
      <h1>Keyloop Inventory Command Center</h1>
      <p>Foundation ready.</p>
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

export const routeTree = rootRoute.addChildren([indexRoute]);

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
