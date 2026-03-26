/**
 * ProtectedRoute — guards routes that require authentication and/or permissions.
 *
 * Usage:
 *   // Auth-only
 *   <Route element={<ProtectedRoute><CROLayout /></ProtectedRoute>} />
 *
 *   // Auth + permission
 *   <Route element={<ProtectedRoute requiredPermission="team:read"><TeamPage /></ProtectedRoute>} />
 */

import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated, selectPermissions } from '@/features/auth/authSlice';

/* ── Inline 403 page ─────────────────────────────────────────────────────── */
function Forbidden() {
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
        background: 'var(--bg-page)',
      }}
    >
      <p
        style={{
          fontSize: '80px',
          fontWeight: 800,
          color: '#e11d48',
          lineHeight: 1,
          margin: 0,
          letterSpacing: '-4px',
        }}
      >
        403
      </p>
      <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        Access Denied
      </p>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-muted)',
          maxWidth: '360px',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        You don&apos;t have the required permissions to view this page.
        Contact your administrator if you believe this is a mistake.
      </p>
    </div>
  );
}

/* ── ProtectedRoute ──────────────────────────────────────────────────────── */
export default function ProtectedRoute({ children, requiredPermission }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const permissions     = useAppSelector(selectPermissions);

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return <Forbidden />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children:           PropTypes.node.isRequired,
  requiredPermission: PropTypes.string,
};

ProtectedRoute.defaultProps = {
  requiredPermission: null,
};
