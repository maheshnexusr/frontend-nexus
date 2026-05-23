import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { CATEGORY_ORDER, WIDGETS, isWidgetPermitted } from './widgetRegistry';
import styles from './dashboard.module.css';

export default function ConfigureWidgetsModal({
  open, onClose,
  widgets, orderedWidgetIds, toggleWidget, moveWidget, resetWidgets,
  study, studyConfig, perms,
}) {
  if (!open) return null;

  // Order widgets within each category, preserving user-chosen sequence.
  // Widgets the user's permissions don't allow are omitted entirely — they
  // can't be enabled for a role that wouldn't be allowed to see them.
  const idsByCategory = CATEGORY_ORDER.reduce((acc, cat) => { acc[cat] = []; return acc; }, {});
  for (const id of orderedWidgetIds) {
    const meta = WIDGETS.find((w) => w.id === id);
    if (meta && isWidgetPermitted(meta, perms)) idsByCategory[meta.category]?.push(id);
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Configure Widgets</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {CATEGORY_ORDER.map((cat) => {
            const ids = idsByCategory[cat];
            if (!ids?.length) return null;
            return (
              <section key={cat}>
                <h3 className={styles.catTitle}>{cat}</h3>
                {ids.map((id, idxInCat) => {
                  const meta = WIDGETS.find((w) => w.id === id);
                  const cfg  = widgets[id];
                  const gatedOut = meta.requires ? !meta.requires(study, studyConfig) : false;
                  const isFirst = idxInCat === 0;
                  const isLast  = idxInCat === ids.length - 1;
                  return (
                    <div
                      key={id}
                      className={`${styles.cfgRow} ${gatedOut ? styles.cfgRowDisabled : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={!!cfg?.visible && !gatedOut}
                        disabled={gatedOut}
                        onChange={() => toggleWidget(id)}
                      />
                      <span className={styles.cfgLabel}>{meta.title}</span>
                      {gatedOut && <span className={styles.cfgNote}>disabled by study config</span>}
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => moveWidget(id, 'up')}
                        disabled={isFirst}
                        title="Move up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => moveWidget(id, 'down')}
                        disabled={isLast}
                        title="Move down"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        <div className={styles.modalFoot}>
          <button type="button" className={styles.btn} onClick={resetWidgets}>
            Reset to defaults
          </button>
          <button type="button" className={styles.btn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
