/**
 * SiteFeaturePlaceholderPage — stand-in for sidebar items that aren't built
 * yet for the site scope (Data Capture, Queries, Consent, etc.). Reads the
 * current pathname to render a "coming soon" card with the feature label
 * so sidebar links still resolve to *something* meaningful.
 *
 * Replace with a real page when the feature ships — no other wiring change is
 * needed; SiteLayout's nav uses the path directly.
 */

import { useLocation } from 'react-router-dom';
import { Hammer } from 'lucide-react';

const PATH_LABELS = {
  '/site/capture':                  'Data Capture',
  '/site/queries':                  'Query Manager',
  '/site/verification':             'Data Verification Manager',
  '/site/consent/config':           'Consent Builder',
  '/site/consent/review':           'Consent Review & Approval',
  '/site/reports':                  'Reports',
  '/site/sites':                    'Sites',
  '/site/personnel':                'Site Personnel',
  '/site/roles':                    'Site Roles',
  '/site/masters/email-templates':  'Email Templates',
  '/site/masters/countries':        'Countries',
  '/site/masters/locations':        'Locations',
  '/site/masters/regions':          'Regions',
  '/site/activity-log':             'Activity Log',
  '/site/profile':                  'Profile',
};

export default function SiteFeaturePlaceholderPage() {
  const { pathname } = useLocation();
  const label = PATH_LABELS[pathname] ?? 'This feature';

  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: 12,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <Hammer size={28} style={{ color: 'var(--text-muted, #64748b)', marginBottom: 12 }} />
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
        {label}
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted, #64748b)' }}>
        This feature is on the roadmap for the site portal. Your role can access
        it — the screen is being built. Pick a different item from the sidebar
        in the meantime.
      </p>
    </div>
  );
}
