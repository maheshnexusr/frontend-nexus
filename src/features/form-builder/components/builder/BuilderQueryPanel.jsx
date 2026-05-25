/**
 * BuilderQueryPanel — right-side details for the currently-selected field
 * when it has an open query attached.
 *
 * Reads `formSlice.selectedId` and looks up the element's `.query` property
 * (set by the data-review flow). Falls back to a sample query payload that
 * matches the design spec when no element is wired up yet.
 */

import { useSelector } from 'react-redux';
import {
  ChevronUp, MapPin, MessageSquarePlus, MoveRight,
  User as UserIcon, Tag,
} from 'lucide-react';
import {
  selectElements, selectSelectedId,
} from '@/features/form-builder/store/formSlice';
import s from './BuilderLayout.module.css';

const FALLBACK_QUERY = {
  id:        'Q-10234',
  status:    'OPEN',
  priority:  'Medium',
  raisedBy:  'Smith Cooper (CRA)',
  raisedAt:  '20 May 2024 11:30 AM',
  type:      'Data Clarification',
  message:   'Systolic BP value is outside the expected range. Please verify and confirm if the value is correct.',
  location:  ['Visit 3 (Week 12)', 'Vitals', 'Blood Pressure', 'Systolic Blood Pressure'],
  fieldValue: '150 mmHg',
  expected:   '90 - 140 mmHg',
  linkedForm: 'Vitals Form',
  linkedInstance: 'V3-W12-F1',
};

function initials(name = '') {
  return name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '').join('') || 'SC';
}

export default function BuilderQueryPanel() {
  const selectedId = useSelector(selectSelectedId);
  const elements   = useSelector(selectElements);
  const active     = elements.find((e) => e.id === selectedId);
  const q = active?.query ?? FALLBACK_QUERY;

  return (
    <aside className={s.qp}>
      <div className={s.qpHead}>
        <span className={s.qpTitle}>Query Details</span>
        <button type="button" className={s.iconBtn}><ChevronUp size={14} /></button>
      </div>

      <div className={s.qpScroll}>
        <div className={s.qpIdRow}>
          <span className={s.qpStatus}>{q.status}</span>
          <span className={s.qpLabel}>Query ID:</span>
          <span className={s.qpId}>{q.id}</span>
        </div>

        <div className={s.qpInline}>
          <span className={s.qpLabel}>Priority:</span>
          <span className={s.fieldQueryPill}>
            <Tag size={11} /> {q.priority}
          </span>
        </div>

        <div className={s.qpRaisedBy}>
          <div className={s.qpRaisedAvatar}>{initials(q.raisedBy)}</div>
          <div>
            <div className={s.qpRaisedName}>Raised by: {q.raisedBy}</div>
            <div className={s.qpRaisedDate}>on {q.raisedAt}</div>
          </div>
        </div>

        <div className={s.qpInline}>
          <UserIcon size={13} color="#64748b" />
          <span className={s.qpLabel}>Type:</span>
          <span className={s.qpVal}>{q.type}</span>
        </div>

        <div className={s.qpRow}>
          <span className={s.qpLabel}>Message</span>
          <div className={s.qpMessage}>{q.message}</div>
        </div>

        <div className={s.qpRow}>
          <span className={s.qpLabel}>Location</span>
          <div className={s.qpLocation}>
            {q.location.map((part, i) => (
              <span key={part} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {part}
                {i < q.location.length - 1 && <MoveRight size={11} />}
              </span>
            ))}
          </div>
        </div>

        <div className={s.qpRow}>
          <span className={s.qpLabel}>Field Value</span>
          <div className={s.qpFieldVal}>{q.fieldValue}</div>
        </div>

        <div className={s.qpRow}>
          <span className={s.qpLabel}>Expected Range</span>
          <div className={s.qpRange}>{q.expected}</div>
        </div>

        <div className={s.qpRow}>
          <span className={s.qpLabel}>Linked Item</span>
          <div className={s.qpVal}>Form: {q.linkedForm}</div>
          <div className={s.qpVal} style={{ color: '#64748b', fontSize: 12 }}>
            Instance: {q.linkedInstance}
          </div>
        </div>
      </div>

      <div className={s.qpFooter}>
        <button type="button" className={s.qpPrimary}>
          <MapPin size={14} /> Go to Location in Form
        </button>
        <button type="button" className={s.qpSecondary}>
          <MessageSquarePlus size={14} /> Add Response
        </button>
      </div>
    </aside>
  );
}
