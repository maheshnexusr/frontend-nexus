/**
 * ScreeningReportView — shared, read-only Inclusion/Exclusion overview used by
 * both the sponsor (study-wide) and site (own-site) Screening Report pages.
 *
 * The only thing that differs between the two portals is where the data comes
 * from, so the caller passes a `loadReport` async fn returning the report shape:
 *   { criteriaConfigured, total, summary, subjects: [{ subjectId, subjectInitials,
 *     subjectNumber, siteCode, siteName, status, reason, criteria: [...] }] }
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardCheck, RefreshCw, Search, X, Filter, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, MinusCircle, ListChecks,
} from 'lucide-react';
import SnapshotButton from '@/components/feedback/SnapshotButton';
import css from '@/features/sponsor/pages/CapturePage.module.css';

const ELIG_STYLE = {
  'Included':       { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  'Excluded':       { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  'Pending Review': { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  'Screen Failed':  { bg: '#fef2f2', color: '#9f1239', border: '#fecdd3' },
};
const STATUS_ORDER = ['Included', 'Excluded', 'Screen Failed', 'Pending Review'];

function EligibilityBadge({ status }) {
  if (!status) return <span className={css.na}>—</span>;
  const st = ELIG_STYLE[status] || ELIG_STYLE['Pending Review'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}`,
    }}>
      {status}
    </span>
  );
}

function MetIcon({ met }) {
  if (met === true)  return <CheckCircle2 size={15} style={{ color: '#15803d' }} />;
  if (met === false) return <XCircle size={15} style={{ color: '#b91c1c' }} />;
  return <MinusCircle size={15} style={{ color: '#a1a1aa' }} />;
}

const fmtVal = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

function CriteriaDetail({ criteria }) {
  if (!criteria || criteria.length === 0) {
    return <div style={{ padding: '10px 16px', fontSize: 12.5, color: '#71717a' }}>No criteria evaluated for this subject.</div>;
  }
  return (
    <div style={{ padding: '8px 16px 12px 44px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#71717a' }}>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>Type</th>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>Criterion</th>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>Subject Value</th>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f1f1f4' }}>
              <td style={{ padding: '5px 8px' }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
                  background: c.type === 'exclusion' ? '#fef2f2' : '#eff6ff',
                  color:      c.type === 'exclusion' ? '#b91c1c' : '#1d4ed8',
                }}>
                  {c.type === 'exclusion' ? 'Exclusion' : 'Inclusion'}
                </span>
              </td>
              <td style={{ padding: '5px 8px', color: '#3f3f46' }}>
                <strong style={{ color: '#18181b' }}>{c.fieldLabel}</strong>
                {' '}<span style={{ color: '#71717a' }}>{c.operator}</span>
                {c.value !== null && c.value !== '' ? ` ${fmtVal(c.value)}` : ''}
              </td>
              <td style={{ padding: '5px 8px', color: '#3f3f46' }}>{fmtVal(c.subjectValue)}</td>
              <td style={{ padding: '5px 8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <MetIcon met={c.met} />
                  <span style={{ color: c.met === true ? '#15803d' : c.met === false ? '#b91c1c' : '#a1a1aa' }}>
                    {c.met === true ? 'Met' : c.met === false ? 'Not met' : 'Pending'}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScreeningReportView({
  loadReport,
  snapshotLeaf = 'data_capture',
  subtitle = 'Inclusion / Exclusion eligibility across all subjects, evaluated from captured data.',
  onError,
}) {
  const [report,     setReport]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query,      setQuery]      = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expanded,   setExpanded]   = useState(() => new Set());

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const res = await loadReport();
      setReport(res ?? null);
    } catch (err) {
      if (!silent && onError) onError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadReport, onError]);

  useEffect(() => { load(); }, [load]);

  const subjects = report?.subjects ?? [];

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return subjects.filter((s) => {
      const matchQ = !q || [s.subjectInitials, s.subjectNumber, s.siteCode, s.siteName]
        .some((v) => (v ?? '').toLowerCase().includes(q));
      const matchS = statusFilter === 'All' || s.status === statusFilter;
      return matchQ && matchS;
    });
  }, [subjects, query, statusFilter]);

  const summary = report?.summary ?? {};

  return (
    <div className={css.page}>
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Screening Report</h1>
          <p className={css.sub}>{subtitle}</p>
        </div>
        <div className={css.headerActions}>
          <SnapshotButton leaf={snapshotLeaf} filename="screening_report" />
          <button className={css.btnRefresh} onClick={() => load(true)} disabled={refreshing} title="Refresh">
            <RefreshCw size={15} className={refreshing ? css.spin : ''} />
          </button>
        </div>
      </div>

      {!loading && report && !report.criteriaConfigured ? (
        <div className={css.tableWrap}>
          <div className={css.empty} style={{ padding: '48px 20px' }}>
            <ListChecks size={40} strokeWidth={1.25} className={css.emptyIcon} />
            <p className={css.emptyTitle}>No eligibility criteria configured</p>
            <p className={css.emptySub}>
              Add Inclusion / Exclusion criteria in the Study Form Builder (the “Eligibility” button)
              to start screening subjects automatically.
            </p>
          </div>
        </div>
      ) : (
        <>
          {subjects.length > 0 && (
            <div className={css.kpiRow}>
              <div className={css.kpi}>
                <span className={css.kpiVal}>{report?.total ?? subjects.length}</span>
                <span className={css.kpiLabel}>Total Subjects</span>
              </div>
              {STATUS_ORDER.map((status) => {
                const n = summary[status] ?? 0;
                if (n === 0) return null;
                const st = ELIG_STYLE[status];
                return (
                  <div key={status} className={css.kpi}>
                    <span className={css.kpiVal} style={{ color: st.color }}>{n}</span>
                    <span className={css.kpiLabel}>{status}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={css.toolbar}>
            <div className={css.toolbarLeft}>
              <div className={css.searchWrapper}>
                <Search size={14} className={css.searchIcon} />
                <input
                  className={css.searchInput}
                  placeholder="Search by subject or site…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && <button className={css.searchClear} onClick={() => setQuery('')}><X size={12} /></button>}
              </div>
              <div className={css.filterRow}>
                <Filter size={13} className={css.filterIcon} />
                {['All', ...STATUS_ORDER].map((s) => (
                  <button
                    key={s}
                    className={`${css.filterBtn} ${statusFilter === s ? css.filterBtnActive : ''}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <span className={css.count}>{filtered.length} of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
          </div>

          <div className={css.tableWrap}>
            <table className={css.table}>
              <thead>
                <tr>
                  <th className={css.th} style={{ width: 36 }} />
                  <th className={css.th}>Subject</th>
                  <th className={css.th}>Site</th>
                  <th className={css.th}>Eligibility</th>
                  <th className={css.th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className={css.row}>
                      {[1,2,3,4,5].map((j) => (
                        <td key={j} className={css.td}><div className={css.skeleton} style={{ width: j === 1 ? 20 : 120 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={css.emptyCell}>
                      <div className={css.empty}>
                        <ClipboardCheck size={40} strokeWidth={1.25} className={css.emptyIcon} />
                        <p className={css.emptyTitle}>
                          {subjects.length === 0 ? 'No subjects to screen yet' : 'No subjects match your filters'}
                        </p>
                        <p className={css.emptySub}>
                          {subjects.length === 0
                            ? 'Subjects appear here once they are enrolled and their data is captured.'
                            : 'Try adjusting your search or filter.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const isOpen = expanded.has(s.subjectId);
                    return (
                      <React.Fragment key={s.subjectId}>
                        <tr className={css.row} style={{ cursor: 'pointer' }} onClick={() => toggle(s.subjectId)}>
                          <td className={css.td} style={{ textAlign: 'center' }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </td>
                          <td className={css.td}>
                            <div className={css.subjectCell}>
                              <ClipboardCheck size={14} className={css.subjectIcon} />
                              <div>
                                <span className={css.subjectCode}>{s.subjectInitials || s.subjectNumber || '—'}</span>
                                {s.subjectInitials && s.subjectNumber && (
                                  <div className={css.subjectSubLabel}>{s.subjectNumber}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={css.td}>
                            <span className={css.siteCode}>{s.siteCode || '—'}</span>
                            {s.siteName && <div className={css.siteName}>{s.siteName}</div>}
                          </td>
                          <td className={css.td}><EligibilityBadge status={s.status} /></td>
                          <td className={css.td}>
                            <span style={{ fontSize: 12.5, color: s.reason ? '#3f3f46' : '#a1a1aa' }}>
                              {s.reason || '—'}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} style={{ background: '#fafafa', padding: 0 }}>
                              <CriteriaDetail criteria={s.criteria} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
