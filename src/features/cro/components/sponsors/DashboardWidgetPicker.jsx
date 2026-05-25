/**
 * DashboardWidgetPicker — per-role whitelist of dashboard cards (widgets).
 *
 * value = null   → "all dashboards (category-leaf gating)" (default)
 * value = []     → "show no cards" (role can see the dashboard shell only)
 * value = ['x']  → "show only these widget IDs"
 *
 * Widgets are grouped by their category for easier scanning. A header toggle
 * lets the CRO either use the per-card whitelist or fall back to default
 * permission-based gating.
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { WIDGETS, CATEGORY_ORDER } from '@/features/sponsor/pages/dashboard/widgetRegistry';
import styles from '../../pages/team/TeamRoleFormPage.module.css';

export default function DashboardWidgetPicker({ value, onChange }) {
  const useWhitelist = Array.isArray(value);
  const selected     = useMemo(() => new Set(useWhitelist ? value : []), [value, useWhitelist]);

  const grouped = useMemo(() => {
    const byCat = new Map(CATEGORY_ORDER.map((c) => [c, []]));
    for (const w of WIDGETS) {
      const cat = byCat.get(w.category) ?? [];
      cat.push(w);
      byCat.set(w.category, cat);
    }
    return [...byCat.entries()].filter(([, arr]) => arr.length > 0);
  }, []);

  const toggleWhitelist = (on) => onChange(on ? [] : null);
  const toggleKey = (id) => {
    if (!useWhitelist) return;
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };
  const toggleCategory = (widgetsInCat) => {
    if (!useWhitelist) return;
    const ids = widgetsInCat.map((w) => w.id);
    const allOn = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    if (allOn) ids.forEach((id) => next.delete(id));
    else        ids.forEach((id) => next.add(id));
    onChange([...next]);
  };
  const selectAll  = () => onChange(WIDGETS.map((w) => w.id));
  const clearAll   = () => onChange([]);

  return (
    <>
      <div className={styles.permHeader}>
        <div>
          <h2 className={styles.cardHeading}>Dashboard Cards</h2>
          <p className={styles.cardSub}>
            Choose which dashboard cards this role sees. Leave the toggle off to
            use the default behavior (cards visible by permission category).
          </p>
        </div>
        <label
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: '#475569', cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={useWhitelist}
            onChange={(e) => toggleWhitelist(e.target.checked)}
          />
          Limit to specific cards
        </label>
      </div>

      {useWhitelist && (
        <>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0 14px' }}>
            <button type="button" className={styles.btnSelectAll}  onClick={selectAll}>Select All</button>
            <button type="button" className={styles.btnUnselectAll} onClick={clearAll}>Unselect All</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
              {selected.size} / {WIDGETS.length} cards selected
            </span>
          </div>

          <div className={styles.groupList}>
            {grouped.map(([cat, widgetsInCat]) => {
              const allOn  = widgetsInCat.every((w) => selected.has(w.id));
              const someOn = !allOn && widgetsInCat.some((w) => selected.has(w.id));
              return (
                <div key={cat} className={styles.group}>
                  <div className={styles.groupHeader}>
                    <label className={styles.groupCheckLabel}>
                      <input
                        type="checkbox"
                        className={styles.hidden}
                        checked={allOn}
                        ref={(el) => { if (el) el.indeterminate = someOn; }}
                        onChange={() => toggleCategory(widgetsInCat)}
                      />
                      <span className={`${styles.customCheck} ${allOn ? styles.customCheckOn : ''} ${someOn ? styles.customCheckPartial : ''}`}>
                        {(allOn || someOn) && <Check />}
                      </span>
                      <span className={styles.groupName}>{cat}</span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {widgetsInCat.filter((w) => selected.has(w.id)).length} / {widgetsInCat.length}
                    </span>
                  </div>

                  <div className={styles.featureList}>
                    {widgetsInCat.map((w) => {
                      const on = selected.has(w.id);
                      return (
                        <div key={w.id} className={styles.featureRow}>
                          <label className={styles.featureCheckLabel}>
                            <input
                              type="checkbox"
                              className={styles.hidden}
                              checked={on}
                              onChange={() => toggleKey(w.id)}
                            />
                            <span className={`${styles.customCheck} ${styles.customCheckSm} ${on ? styles.customCheckOn : ''}`}>
                              {on && <Check small />}
                            </span>
                            <span className={styles.featureName}>{w.title}</span>
                          </label>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{w.chart}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

DashboardWidgetPicker.propTypes = {
  value:    PropTypes.array,           // null = unrestricted; array = whitelist
  onChange: PropTypes.func.isRequired,
};

DashboardWidgetPicker.defaultProps = { value: null };

function Check({ small }) {
  const s = small ? 9 : 10;
  return (
    <svg width={s} height={s} viewBox="0 0 10 8" fill="none" aria-hidden="true">
      <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
