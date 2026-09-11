import React from 'react';
import ReactDOM from 'react-dom/client';
import './app/styles/tokens.css';
import './app/styles/base.css';
import './app/styles/primitives.css';
import { App } from './app/App';
import {
  defaultInstrumentation,
  installGlobalClientErrorReporting,
  observeWebVitals,
} from './features/observability/instrumentation';

// System Design 8.1 / 8.2: install the client instrumentation boundary once at
// startup. The default sink is a no-op until a real telemetry sink is injected.
installGlobalClientErrorReporting(defaultInstrumentation);
observeWebVitals((metric) => defaultInstrumentation.reportWebVitals(metric));

async function prepareApp() {
  const shouldStartMockWorker =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'true';

  if (shouldStartMockWorker) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
    });
  }
}

prepareApp().then(() => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
