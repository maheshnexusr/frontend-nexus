/**
 * ProtectedRoute — guards routes that require authentication and/or permissions.
 *
 * Two auth scopes are supported per spec §11 (CRO and sponsor tokens are
 * separate and cannot be swapped):
 *   scope="cro"     → gate on the CRO Redux auth state (default)
 *   scope="sponsor" → gate on the presence of a sponsor access token
 *
 * Usage:
 *   // CRO auth-only
 *   <Route element={<ProtectedRoute><CROLayout /></ProtectedRoute>} />
 *
 *   // CRO auth + permission
 *   <Route element={<ProtectedRoute requiredPermission="team:read"><TeamPage /></ProtectedRoute>} />
 *
 *   // Sponsor scope
 *   <Route element={<ProtectedRoute scope="sponsor"><SponsorLayout /></ProtectedRoute>} />
 */

import { Navigate, useParams } from 'react-router-dom';
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

/** True when the logged-in CRO user has the URL's :studyId in their
 *  `assignedStudies` list. Read directly from localStorage so we don't need
 *  a Redux selector for params that change with the URL. */
function croUserHasAssignedStudy(studyId) {
  if (!studyId) return false;
  try {
    const u = JSON.parse(localStorage.getItem('authUser') || 'null');
    if (!u || !Array.isArray(u.assignedStudies)) return false;
    return u.assignedStudies.some((s) => s.studyId === studyId);
  } catch {
    return false;
  }
}

/* ── ProtectedRoute ──────────────────────────────────────────────────────── */
export default function ProtectedRoute({ children, requiredPermission, scope }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const permissions     = useAppSelector(selectPermissions);
  const params          = useParams();

  if (scope === 'sponsor') {
    // The sponsor workspace shell is reachable by FOUR token scopes:
    //   • sponsorAccessToken  — direct sponsor login
    //   • sponsorViewToken    — CRO user viewing a sponsor workspace via /enter
    //   • siteAccessToken     — activated site personnel (PI / Coordinator /
    //                           Nurse / etc.) whose menu is then filtered by
    //                           their site-role's permission tree.
    //   • CRO accessToken + matching assignedStudies entry — a CRO team-member
    //                           explicitly assigned to this :studyId. Their
    //                           menu is filtered by assignedStudies[].
    //                           sponsorPermissions via useSiteRolePermissions.
    //                           No separate /enter call is required because
    //                           the per-study permission tree already lives
    //                           on the user object.
    const hasSponsorToken     = !!localStorage.getItem('sponsorAccessToken');
    const hasSponsorViewToken = !!localStorage.getItem('sponsorViewToken');
    const hasSiteTokenScope   = !!localStorage.getItem('siteAccessToken');
    const hasCroAssignedAccess = !!localStorage.getItem('accessToken')
      && croUserHasAssignedStudy(params?.studyId);
    if (!hasSponsorToken && !hasSponsorViewToken && !hasSiteTokenScope && !hasCroAssignedAccess) {
      return <Navigate to="/signin" replace />;
    }
    return children;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  const isAdmin = permissions.includes('*');
  if (requiredPermission && !isAdmin && !permissions.includes(requiredPermission)) {
    return <Forbidden />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children:           PropTypes.node.isRequired,
  requiredPermission: PropTypes.string,
  scope:              PropTypes.oneOf(['cro', 'sponsor']),
};

ProtectedRoute.defaultProps = {
  requiredPermission: null,
  scope:              'cro',
};
