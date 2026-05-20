/**
 * RoleDashboard — single landing page that renders a different widget set
 * per role:
 *
 *   CRA / Monitor      → Monitoring Dashboard (SDV progress, open queries,
 *                        overdue queries, recent verifications)
 *   Data Manager       → Data Review Dashboard (query aging, discrepancy
 *                        report, bulk queue, audit browser shortcut)
 *   Investigator       → Investigator Dashboard (my subjects, forms awaiting
 *                        signature, my open queries)
 *   Sponsor / Default  → Study Analytics (enrollment, query KPIs, site
 *                        performance, milestones)
 *   Auditor            → Audit-only widget set
 *
 * Reuses the existing `Card` UI primitive; widgets are intentionally simple
 * placeholders that read from a `metrics` prop. Parent page is responsible
 * for fetching role-appropriate metrics from the backend; this component
 * just renders.
 */

import { useMemo } from 'react';
import {
  AlertCircle, ShieldCheck, CheckCircle2, Eye, FileText, PenLine,
  Stamp, ClipboardList, Users, TrendingUp, Clock, BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const PALETTE = {
  amber:  { color: '#92400e', bg: '#fef3c7' },
  blue:   { color: '#1d4ed8', bg: '#dbeafe' },
  green:  { color: '#15803d', bg: '#dcfce7' },
  red:    { color: '#b91c1c', bg: '#fee2e2' },
  purple: { color: '#6d28d9', bg: '#ede9fe' },
  slate:  { color: '#475569', bg: '#f1f5f9' },
  teal:   { color: '#0f766e', bg: '#ccfbf1' },
};

function inferRole(user) {
  const r = (user?.roleName ?? user?.role ?? '').toLowerCase();
  if (!r) return 'default';
  if (r.includes('investigator')) return 'investigator';
  if (r.includes('data manager') || r === 'dm') return 'dataManager';
  if (r.includes('monitor') || r.includes('cra')) return 'cra';
  if (r.includes('auditor')) return 'auditor';
  if (r.includes('sponsor')) return 'sponsor';
  return 'default';
}

const WIDGETS_BY_ROLE = {
  cra: [
    { key: 'sdvProgress',       label: 'SDV Progress',         metric: 'sdvProgressPct',    suffix: '%', Icon: ShieldCheck,  color: 'green'  },
    { key: 'openQueries',       label: 'Open Queries',         metric: 'openQueries',                    Icon: AlertCircle,  color: 'amber'  },
    { key: 'overdueQueries',    label: 'Overdue Queries',      metric: 'overdueQueries',                 Icon: Clock,        color: 'red'    },
    { key: 'recentVerifications', label: 'Verifications · 7d', metric: 'verificationsLast7d',            Icon: CheckCircle2, color: 'blue'   },
  ],
  dataManager: [
    { key: 'queryAging',     label: 'Avg Query Age (days)', metric: 'queryAvgAgeDays',             Icon: Clock,         color: 'amber'  },
    { key: 'discrepancies',  label: 'Open Discrepancies',   metric: 'openDiscrepancies',           Icon: AlertCircle,   color: 'red'    },
    { key: 'auditEvents',    label: 'Audit Events · 24h',   metric: 'auditEventsLast24h',          Icon: ClipboardList, color: 'slate'  },
    { key: 'siteCoverage',   label: 'Sites Reviewed',       metric: 'sitesReviewed',               Icon: TrendingUp,    color: 'green'  },
  ],
  investigator: [
    { key: 'mySubjects',     label: 'My Subjects',           metric: 'mySubjects',                  Icon: Users,         color: 'blue'   },
    { key: 'awaitSign',      label: 'Forms Awaiting Sign',   metric: 'formsAwaitingSignature',      Icon: PenLine,       color: 'purple' },
    { key: 'awaitApproval',  label: 'Forms Awaiting Approval', metric: 'formsAwaitingApproval',     Icon: Stamp,         color: 'teal'   },
    { key: 'myOpenQueries',  label: 'My Open Queries',       metric: 'myOpenQueries',               Icon: AlertCircle,   color: 'amber'  },
  ],
  sponsor: [
    { key: 'enrollment',     label: 'Enrolled Subjects',     metric: 'enrolledSubjects',            Icon: Users,         color: 'blue'   },
    { key: 'completedForms', label: 'Forms Completed',       metric: 'formsCompleted',              Icon: CheckCircle2,  color: 'green'  },
    { key: 'queriesTotal',   label: 'Total Queries',         metric: 'queriesTotal',                Icon: AlertCircle,   color: 'amber'  },
    { key: 'siteCount',      label: 'Active Sites',          metric: 'activeSites',                 Icon: BarChart3,     color: 'slate'  },
  ],
  auditor: [
    { key: 'auditEntries',   label: 'Audit Entries · 7d',    metric: 'auditEntriesLast7d',          Icon: ClipboardList, color: 'slate'  },
    { key: 'lockedForms',    label: 'Locked Forms',          metric: 'lockedFormsTotal',            Icon: FileText,      color: 'amber'  },
    { key: 'signedForms',    label: 'Signed Forms',          metric: 'signedFormsTotal',            Icon: PenLine,       color: 'purple' },
    { key: 'verifiedFields', label: 'Verified Fields',       metric: 'verifiedFieldsTotal',         Icon: ShieldCheck,   color: 'green'  },
  ],
  default: [
    { key: 'enrollment',     label: 'Enrolled Subjects',     metric: 'enrolledSubjects',            Icon: Users,         color: 'blue'   },
    { key: 'queriesTotal',   label: 'Total Queries',         metric: 'queriesTotal',                Icon: AlertCircle,   color: 'amber'  },
    { key: 'completedForms', label: 'Forms Completed',       metric: 'formsCompleted',              Icon: CheckCircle2,  color: 'green'  },
  ],
};

const TITLE_BY_ROLE = {
  cra:          'Monitoring Dashboard',
  dataManager:  'Data Review Dashboard',
  investigator: 'Investigator Dashboard',
  sponsor:      'Study Analytics',
  auditor:      'Audit Dashboard',
  default:      'Study Dashboard',
};

const SUB_BY_ROLE = {
  cra:          'SDV progress, query queue, recent verifications across the study.',
  dataManager:  'Query aging, data cleaning queue, audit activity across all sites.',
  investigator: 'Your subjects, signature queue, and open queries.',
  sponsor:      'Enrollment, query KPIs, and site performance for this study.',
  auditor:      'Read-only inventory of audit entries and immutable records.',
  default:      'Study overview.',
};

export default function RoleDashboard({ user, metrics = {} }) {
  const role    = useMemo(() => inferRole(user), [user]);
  const widgets = WIDGETS_BY_ROLE[role] ?? WIDGETS_BY_ROLE.default;
  const title   = TITLE_BY_ROLE[role]   ?? TITLE_BY_ROLE.default;
  const subtitle = SUB_BY_ROLE[role]    ?? SUB_BY_ROLE.default;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{subtitle}</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {widgets.map(({ key, label, metric, suffix, Icon, color }) => {
          const palette = PALETTE[color] ?? PALETTE.slate;
          const raw = metrics?.[metric];
          const value = raw == null ? '—' : `${raw}${suffix ?? ''}`;
          return (
            <Card key={key}>
              <CardContent className="flex items-center justify-between gap-3 p-5 pt-5">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-2xl font-extrabold leading-none" style={{ color: palette.color }}>{value}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                </div>
                <span
                  className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full"
                  style={{ background: palette.bg, color: palette.color }}
                >
                  <Icon size={18} />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
