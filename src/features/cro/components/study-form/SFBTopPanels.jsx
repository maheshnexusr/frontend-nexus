/**
 * SFBTopPanels — slide-in overlay panels for Submission Controls, Triggers, Collaboration.
 * Rendered above the builder layout when activePanel !== 'builder'.
 */
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Plus, Trash2, Bell, Mail, Zap, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { formResponsesClient } from '@/features/cro/api/formResponsesClient';
import {
  selectSubmissionCtrl, selectTriggers, selectComments,
  updateSubmissionControls, addTrigger, updateTrigger, removeTrigger,
  setActivePanel,
} from '@/features/cro/store/studyFormSlice';
import s from './SFBTopPanels.module.css';

export default function SFBTopPanels({ activePanel }) {
  if (activePanel === 'builder') return null;
  return (
    <div className={s.overlay}>
      <div className={s.drawer}>
        {activePanel === 'submission'     && <SubmissionPanel />}
        {activePanel === 'triggers'       && <TriggersPanel />}
        {activePanel === 'collaboration'  && <CollaborationPanel />}
      </div>
    </div>
  );
}

/* ── Submission Controls ──────────────────────────────────────────────────*/
function SubmissionPanel() {
  const dispatch = useDispatch();
  const ctrl     = useSelector(selectSubmissionCtrl);
  const up       = (k, v) => dispatch(updateSubmissionControls({ [k]: v }));

  return (
    <PanelShell title="Configure Submission Controls">
      <Section title="Save & Submit">
        <Row label="Save Progress"><Toggle value={ctrl.saveProgress} onChange={(v) => up('saveProgress', v)} /><Info>Allow partial saves</Info></Row>
        <Row label="Submit Once"><Toggle value={ctrl.submitOnce} onChange={(v) => up('submitOnce', v)} /><Info>Prevent multiple submissions</Info></Row>
      </Section>

      <Section title="Submit Window">
        <Row label="Enable Window"><Toggle value={ctrl.submitWindowEnabled} onChange={(v) => up('submitWindowEnabled', v)} /></Row>
        {ctrl.submitWindowEnabled && (
          <>
            <Row label="Start Date/Time">
              <input type="datetime-local" className={s.input} value={ctrl.submitWindowStart} onChange={(e) => up('submitWindowStart', e.target.value)} />
            </Row>
            <Row label="End Date/Time">
              <input type="datetime-local" className={s.input} value={ctrl.submitWindowEnd} onChange={(e) => up('submitWindowEnd', e.target.value)} />
            </Row>
          </>
        )}
      </Section>

      <Section title="After Submission">
        <Row label="Confirmation Message" top>
          <textarea
            className={s.textarea}
            rows={3}
            value={ctrl.confirmationMessage}
            onChange={(e) => up('confirmationMessage', e.target.value)}
            placeholder="Thank you for your submission."
          />
        </Row>
        <Row label="Redirect URL">
          <input className={s.input} value={ctrl.redirectUrl} onChange={(e) => up('redirectUrl', e.target.value)} placeholder="https://example.com (optional)" />
        </Row>
      </Section>

      <ResponsesSection />
    </PanelShell>
  );
}

/* ── Form Responses Viewer ────────────────────────────────────────────────*/
function ResponsesSection() {
  const [responses, setResponses] = useState([]);
  const [expanded,  setExpanded]  = useState(null);

  const load = () => formResponsesClient.list().then(setResponses);

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    await formResponsesClient.delete(id);
    load();
    if (expanded === id) setExpanded(null);
  };

  const handleClearAll = async () => {
    await formResponsesClient.clearAll();
    setResponses([]);
    setExpanded(null);
  };

  return (
    <div className={s.responsesSection}>
      <div className={s.responsesSectionHeader}>
        <span className={s.responsesSectionTitle}>
          <ClipboardList size={14} /> Form Responses
          {responses.length > 0 && <span className={s.responsesCount}>{responses.length}</span>}
        </span>
        {responses.length > 0 && (
          <button className={s.clearAllBtn} onClick={handleClearAll}>Clear All</button>
        )}
      </div>

      {responses.length === 0 ? (
        <div className={s.responsesEmpty}>
          <p>No submissions yet.</p>
          <p>Use <strong>Preview</strong> mode to fill and submit the form.</p>
        </div>
      ) : (
        <div className={s.responsesList}>
          {responses.map((r) => {
            const isOpen = expanded === r.id;
            const entries = Object.values(r.responses ?? {});
            return (
              <div key={r.id} className={s.responseCard}>
                <div className={s.responseCardHeader} onClick={() => setExpanded(isOpen ? null : r.id)}>
                  <div className={s.responseCardMeta}>
                    <span className={s.responseCardTitle}>Submission #{r.id.slice(-4).toUpperCase()}</span>
                    <span className={s.responseCardDate}>
                      {new Date(r.submittedAt).toLocaleString()}
                    </span>
                    <span className={s.responseCardCount}>{entries.length} field{entries.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={s.responseCardActions}>
                    <button className={s.responseDelBtn} onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>
                      <Trash2 size={12} />
                    </button>
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </div>
                </div>

                {isOpen && (
                  <div className={s.responseCardBody}>
                    {entries.length === 0 ? (
                      <p className={s.responseNoData}>No field data recorded.</p>
                    ) : (
                      entries.map(({ label, value }, i) => (
                        <div key={i} className={s.responseRow}>
                          <span className={s.responseLabel}>{label || `Field ${i + 1}`}</span>
                          <span className={s.responseValue}>
                            {Array.isArray(value) ? value.join(', ') : String(value ?? '—')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Triggers ─────────────────────────────────────────────────────────────*/
function TriggersPanel() {
  const dispatch  = useDispatch();
  const triggers  = useSelector(selectTriggers);
  const [sel, setSel] = useState(null);
  const current = triggers.find((t) => t.id === sel);

  return (
    <PanelShell title="Triggers">
      <div className={s.triggersLayout}>
        {/* List */}
        <div className={s.triggerList}>
          <button className={s.addTriggerBtn} onClick={() => { dispatch(addTrigger({})); }}>
            <Plus size={13} /> New Trigger
          </button>
          {triggers.length === 0 && (
            <p className={s.emptyMsg}>No triggers yet. Create one to send emails or notifications upon form events.</p>
          )}
          {triggers.map((t) => (
            <div
              key={t.id}
              className={`${s.triggerItem} ${sel === t.id ? s.triggerItemActive : ''}`}
              onClick={() => setSel(t.id)}
            >
              <div className={s.triggerIcon}>
                {t.type === 'email' ? <Mail size={14} /> : <Bell size={14} />}
              </div>
              <div className={s.triggerInfo}>
                <span className={s.triggerName}>{t.name || 'Untitled Trigger'}</span>
                <span className={s.triggerType}>{t.type} · {t.event}</span>
              </div>
              <button className={s.triggerDel} onClick={(e) => { e.stopPropagation(); dispatch(removeTrigger(t.id)); if (sel === t.id) setSel(null); }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Editor */}
        {current ? (
          <TriggerEditor trigger={current} />
        ) : (
          <div className={s.triggerEmpty}>
            <Zap size={28} style={{ color: '#cbd5e1' }} />
            <p>Select a trigger to configure it</p>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function TriggerEditor({ trigger }) {
  const dispatch = useDispatch();
  const up = (k, v) => dispatch(updateTrigger({ id: trigger.id, updates: { [k]: v } }));
  const upCond = (k, v) => up('conditions', { ...trigger.conditions, [k]: v });

  const EVENT_OPTIONS = [
    { value: 'field_answer',   label: 'Specific answer given' },
    { value: 'form_complete',  label: 'Form completed' },
    { value: 'threshold',      label: 'Data threshold reached' },
  ];

  const addRecipient = () => up('recipients', [...(trigger.recipients ?? []), '']);
  const upRecipient  = (i, v) => up('recipients', (trigger.recipients ?? []).map((r, j) => j === i ? v : r));
  const delRecipient = (i) => up('recipients', (trigger.recipients ?? []).filter((_, j) => j !== i));

  return (
    <div className={s.triggerEditor}>
      <Section title="Basic">
        <Row label="Name"><input className={s.input} value={trigger.name} onChange={(e) => up('name', e.target.value)} placeholder="e.g. Notify on completion" /></Row>
        <Row label="Type">
          <div className={s.pills}>
            {[{v:'email',l:'Email'},{v:'notification',l:'Notification'}].map((o) => (
              <button key={o.v} className={`${s.pill} ${trigger.type === o.v ? s.pillActive : ''}`} onClick={() => up('type', o.v)}>{o.l}</button>
            ))}
          </div>
        </Row>
        <Row label="Event">
          <select className={s.select} value={trigger.event} onChange={(e) => up('event', e.target.value)}>
            {EVENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="Conditions">
        <Row label="Logic">
          <div className={s.pills}>
            {['AND','OR'].map((o) => (
              <button key={o} className={`${s.pill} ${trigger.conditions?.logic === o ? s.pillActive : ''}`} onClick={() => upCond('logic', o)}>{o}</button>
            ))}
          </div>
        </Row>
        {/* Simplified: show one rule row */}
        <p className={s.condHint}>Trigger fires when conditions match (AND/OR logic).</p>
      </Section>

      {trigger.type === 'email' && (
        <Section title="Email">
          <Row label="Recipients" top>
            <div className={s.recipientsList}>
              {(trigger.recipients ?? []).map((r, i) => (
                <div key={i} className={s.recipientRow}>
                  <input className={s.input} value={r} onChange={(e) => upRecipient(i, e.target.value)} placeholder="email@example.com" />
                  <button className={s.iconBtnSm} onClick={() => delRecipient(i)}><X size={11} /></button>
                </div>
              ))}
              <button className={s.addBtn} onClick={addRecipient}><Plus size={12} /> Add recipient</button>
            </div>
          </Row>
          <Row label="Message" top>
            <textarea className={s.textarea} rows={3} value={trigger.message ?? ''} onChange={(e) => up('message', e.target.value)} placeholder="Email body…" />
          </Row>
        </Section>
      )}
      {trigger.type === 'notification' && (
        <Section title="Notification">
          <Row label="Message" top>
            <textarea className={s.textarea} rows={3} value={trigger.message ?? ''} onChange={(e) => up('message', e.target.value)} placeholder="Notification message…" />
          </Row>
        </Section>
      )}
    </div>
  );
}

/* ── Collaboration ────────────────────────────────────────────────────────*/
function CollaborationPanel() {
  const comments = useSelector(selectComments);
  const allComments = comments ?? [];

  return (
    <PanelShell title="Collaboration & Audit">
      <Section title="Comments / Annotations">
        {allComments.length === 0 ? (
          <p className={s.emptyMsg}>No comments yet. Select a field and add comments from the right panel.</p>
        ) : (
          <div className={s.commentsList}>
            {allComments.map((c) => (
              <div key={c.id} className={`${s.commentCard} ${c.resolved ? s.commentResolved : ''}`}>
                <div className={s.commentCardMeta}>
                  <strong>{c.author}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(c.timestamp).toLocaleString()}</span>
                  {c.resolved && <span className={s.resolvedTag}>Resolved</span>}
                </div>
                <p className={s.commentCardText}>{c.text}</p>
                {c.fieldId && <span className={s.commentCardRef}>Field: {c.fieldId}</span>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Approval Workflow">
        <p className={s.emptyMsg}>
          Use the page properties (right panel) to set page review status:
          <br />
          <strong>Ready for Review</strong> → <strong>Approved</strong> → <strong>Changes Requested</strong>
        </p>
      </Section>
    </PanelShell>
  );
}

/* ── Shared ───────────────────────────────────────────────────────────────*/
function PanelShell({ title, children }) {
  const dispatch = useDispatch();
  return (
    <div className={s.shell}>
      <div className={s.shellHeader}>
        <span className={s.shellTitle}>{title}</span>
        <button className={s.closeBtn} onClick={() => dispatch(setActivePanel('builder'))}><X size={16} /></button>
      </div>
      <div className={s.shellBody}>{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className={s.section}>
      <p className={s.sectionTitle}>{title}</p>
      <div className={s.sectionBody}>{children}</div>
    </div>
  );
}

function Row({ label, top = false, children }) {
  return (
    <div className={`${s.row} ${top ? s.rowTop : ''}`}>
      <span className={s.rowLabel}>{label}</span>
      <div className={s.rowControl}>{children}</div>
    </div>
  );
}

function Info({ children }) {
  return <span className={s.info}>{children}</span>;
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      className={s.toggle}
      style={{ background: value ? 'var(--color-primary,#2563eb)' : '#cbd5e1' }}
      onClick={() => onChange(!value)}
    >
      <span className={s.toggleThumb} style={{ transform: value ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}
