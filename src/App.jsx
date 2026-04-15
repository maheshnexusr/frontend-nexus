/**
 * App — root component.
 * Wires Redux store, the router, and the global toast container.
 * ToastContainer sits outside RouterProvider so it survives route transitions.
 */

import { Component }       from 'react';
import { Provider }        from 'react-redux';
import { RouterProvider }  from 'react-router-dom';
import store               from '@/app/store';
import { router }          from '@/app/router';
import ToastContainer      from '@/components/feedback/ToastContainer';

/**
 * Catches errors thrown by lazy-loaded route chunks (ChunkLoadError).
 * Without this, a failed dynamic import leaves the screen blank in production.
 * On error, reloads the page once so the browser can re-fetch stale chunks.
 */
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // ChunkLoadError or similar — try a single hard reload to recover
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /loading chunk \d+ failed/i.test(error?.message ?? '') ||
      /failed to fetch dynamically imported module/i.test(error?.message ?? '');

    if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '12px',
            textAlign: 'center',
            padding: '24px',
            background: '#f8fafc',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            The page failed to load. Please refresh to try again.
          </p>
          <button
            onClick={() => { sessionStorage.removeItem('chunk_reload'); window.location.reload(); }}
            style={{
              marginTop: '8px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              background: '#1d4ed8',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Provider store={store}>
        <RouterProvider router={router} />
        <ToastContainer />
      </Provider>
    </AppErrorBoundary>
  );
}
