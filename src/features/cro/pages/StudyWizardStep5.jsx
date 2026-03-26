/**
 * StudyWizardStep5 — Study Team Assignment
 *
 * - Shows assigned team members table
 * - "Add Team Member" button opens a modal to pick from cro_team_members
 * - Each assignment gets a study-specific role (Data Manager, PM, etc.)
 * - Validation: no duplicates; at least one member before Next
 */

import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector }      from 'react-redux';
import {
  UserPlus, Search, Trash2, Edit2, X, ChevronDown,
  ArrowLeft, ArrowRight, Users,
} from 'lucide-react';
import { setStep5, selectStep5 }         from '@/features/cro/store/studyWizardSlice';
import { teamMembersClient }             from '@/features/cro/api/teamMembersClient';
import { rolesClient }                   from '@/features/cro/api/rolesClient';
import { addToast }                      from '@/features/notifications/notificationSlice';
import styles from './StudyWizardStep5.module.css';

const uid = () => `assign_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export default function StudyWizardStep5({ onPrevious, onNext, onCancel }) {
  const dispatch    = useDispatch();
  const saved       = useSelector(selectStep5);

  const [assignments, setAssignments] = useState(saved.assignments ?? []);
  const [showModal,   setShowModal]   = useState(false);
  const [editingId,   setEditingId]   = useState(null);
  const [roleOptions, setRoleOptions] = useState([]);

  useEffect(() => {
    rolesClient.list().then((all) =>
      setRoleOptions(
        all
          .filter((r) => r.status !== 'Inactive')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => r.name),
      ),
    );
  }, []);

  // ── Persist to Redux whenever assignments change ───────────────────────
  const persist = (list) => {
    setAssignments(list);
    dispatch(setStep5({ assignments: list }));
  };

  // ── Remove assignment ─────────────────────────────────────────────────
  const handleRemove = (id) => {
    const next = assignments.filter((a) => a.id !== id);
    persist(next);
    dispatch(addToast({ type: 'success', message: 'Team member removed from study.', duration: 3000 }));
  };

  // ── Change role inline ────────────────────────────────────────────────
  const handleRoleChange = (id, studyRole) => {
    const next = assignments.map((a) => a.id === id ? { ...a, studyRole } : a);
    persist(next);
    setEditingId(null);
  };

  // ── Add assignment from modal ─────────────────────────────────────────
  const handleAdd = (member, studyRole) => {
    const alreadyAssigned = assignments.some((a) => a.memberId === member.id);
    if (alreadyAssigned) {
      dispatch(addToast({ type: 'error', message: 'This team member is already assigned to the study.', duration: 4000 }));
      return false;
    }
    const assignment = {
      id:           uid(),
      memberId:     member.id,
      memberName:   member.fullName,
      memberEmail:  member.email,
      croRole:      member.roleName ?? '',
      studyRole,
      assignedDate: new Date().toISOString(),
    };
    const next = [...assignments, assignment];
    persist(next);
    dispatch(addToast({ type: 'success', message: `Team member ${member.fullName} assigned as ${studyRole}.`, duration: 3000 }));
    return true;
  };

  // ── Navigation ────────────────────────────────────────────────────────
  const handleNext = () => {
    if (assignments.length === 0) {
      dispatch(addToast({ type: 'error', message: 'Please assign at least one team member to the study.', duration: 4000 }));
      return;
    }
    onNext?.();
  };

  return (
    <div className={styles.step}>
      <h2 className={styles.heading}>Study Team Assignment</h2>
      <p className={styles.sub}>
        Assign CRO team members to this study with study-specific roles.
      </p>

      {/* ── Header row ───────────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {assignments.length} member{assignments.length !== 1 ? 's' : ''} assigned
        </span>
        <button
          type="button"
          className={styles.btnAdd}
          onClick={() => setShowModal(true)}
        >
          <UserPlus size={14} />
          Add Team Member
        </button>
      </div>

      {/* ── Assignments table ─────────────────────────────────────────── */}
      {assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <Users size={36} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No team members assigned</p>
          <p className={styles.emptyDesc}>
            Click "Add Team Member" to assign CRO personnel to this study.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Team Member</th>
                <th>CRO Role</th>
                <th>Study Role</th>
                <th>Assigned Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  {/* Member name + email */}
                  <td>
                    <div className={styles.memberCell}>
                      <span className={styles.memberAvatar}>
                        {a.memberName?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                      <div>
                        <div className={styles.memberName}>{a.memberName}</div>
                        <div className={styles.memberEmail}>{a.memberEmail}</div>
                      </div>
                    </div>
                  </td>

                  {/* CRO Role from profile */}
                  <td>
                    <span className={styles.roleBadge}>{a.croRole || '—'}</span>
                  </td>

                  {/* Study Role — inline editable */}
                  <td>
                    {editingId === a.id ? (
                      <RoleSelect
                        value={a.studyRole}
                        roles={roleOptions}
                        onConfirm={(r) => handleRoleChange(a.id, r)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <span className={styles.studyRoleBadge}>{a.studyRole}</span>
                    )}
                  </td>

                  {/* Assigned date */}
                  <td className={styles.dateCell}>
                    {new Date(a.assignedDate).toLocaleDateString('en-US', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>

                  {/* Actions */}
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        title="Change Role"
                        onClick={() => setEditingId(editingId === a.id ? null : a.id)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        title="Remove from Study"
                        onClick={() => handleRemove(a.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button type="button" className={styles.btnPrev} onClick={onPrevious}>
          <ArrowLeft size={14} /> Previous
        </button>
        <div className={styles.footerRight}>
          <button type="button" className={styles.btnCancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.btnNext} onClick={handleNext}>
            Next <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Add Team Member Modal ─────────────────────────────────────── */}
      {showModal && (
        <AddMemberModal
          existingIds={assignments.map((a) => a.memberId)}
          roleOptions={roleOptions}
          onAdd={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

/* ── Inline role selector ────────────────────────────────────────────────*/
function RoleSelect({ value, roles, onConfirm, onCancel }) {
  const [role, setRole] = useState(value || roles[0] || '');
  return (
    <div className={styles.roleSelect}>
      <select
        className={styles.roleSelectInput}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        autoFocus
      >
        {roles.length === 0 && <option value="">No roles available</option>}
        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button className={styles.roleConfirm} onClick={() => onConfirm(role)}>✓</button>
      <button className={styles.roleCancel}  onClick={onCancel}>✕</button>
    </div>
  );
}

/* ── Add Member Modal ────────────────────────────────────────────────────*/
function AddMemberModal({ existingIds, roleOptions, onAdd, onClose }) {
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [selected,   setSelected]   = useState(null);
  const [studyRole,  setStudyRole]  = useState(roleOptions[0] ?? '');
  const [adding,     setAdding]     = useState(false);

  useEffect(() => {
    setLoading(true);
    teamMembersClient.list().then((all) => {
      setMembers(all.filter((m) => m.status !== 'Inactive'));
      setLoading(false);
    });
  }, []);

  // unique CRO roles for filter dropdown
  const croRoles = useMemo(
    () => [...new Set(members.map((m) => m.roleName).filter(Boolean))].sort(),
    [members],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter((m) => {
      const matchSearch = !q ||
        m.fullName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.roleName?.toLowerCase().includes(q);
      const matchRole = !filterRole || m.roleName === filterRole;
      return matchSearch && matchRole;
    });
  }, [members, search, filterRole]);

  const handleConfirm = () => {
    if (!selected || !studyRole) return;
    setAdding(true);
    const ok = onAdd(selected, studyRole);
    setAdding(false);
    if (ok) {
      // keep modal open to allow adding more
      setSelected(null);
      setStudyRole(STUDY_ROLES[0]);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Add Team Member</span>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Search + filter */}
        <div className={styles.modalFilters}>
          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>
            )}
          </div>
          <select
            className={styles.filterSelect}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All Roles</option>
            {croRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Member list */}
        <div className={styles.memberList}>
          {loading ? (
            <div className={styles.modalLoading}>Loading team members…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.modalEmpty}>
              {members.length === 0
                ? 'No team members found. Add team members in Team → Members first.'
                : 'No members match your search.'}
            </div>
          ) : (
            filtered.map((m) => {
              const alreadyAssigned = existingIds.includes(m.id);
              const isSelected      = selected?.id === m.id;
              return (
                <div
                  key={m.id}
                  className={`${styles.memberRow}
                    ${isSelected ? styles.memberRowSelected : ''}
                    ${alreadyAssigned ? styles.memberRowDisabled : ''}`}
                  onClick={() => { if (!alreadyAssigned) setSelected(isSelected ? null : m); }}
                >
                  <span className={styles.memberAvatar}>
                    {m.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{m.fullName}</span>
                    <span className={styles.memberEmail}>{m.email}</span>
                  </div>
                  <span className={styles.memberCroRole}>{m.roleName || '—'}</span>
                  {alreadyAssigned && (
                    <span className={styles.assignedTag}>Assigned</span>
                  )}
                  {isSelected && !alreadyAssigned && (
                    <span className={styles.selectedCheck}>✓</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Study role selector + confirm — shown only when a member is selected */}
        {selected && (
          <div className={styles.modalAssign}>
            <div className={styles.modalAssignMember}>
              <span className={styles.memberAvatar}>{selected.fullName?.charAt(0)?.toUpperCase()}</span>
              <span className={styles.memberName}>{selected.fullName}</span>
            </div>
            <div className={styles.modalAssignRole}>
              <label className={styles.modalAssignLabel}>Assign Study Role</label>
              <div className={styles.roleDropWrap}>
                <select
                  className={styles.roleDropdown}
                  value={studyRole}
                  onChange={(e) => setStudyRole(e.target.value)}
                >
                  {roleOptions.length === 0 && <option value="">No roles — add in Roles &amp; Permissions</option>}
                  {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown size={13} className={styles.roleDropIcon} />
              </div>
            </div>
            <button
              className={styles.btnConfirmAdd}
              onClick={handleConfirm}
              disabled={adding}
            >
              {adding ? 'Adding…' : 'Add to Study'}
            </button>
          </div>
        )}

        {/* Modal footer */}
        <div className={styles.modalFooter}>
          <span className={styles.modalHint}>
            {filtered.length} member{filtered.length !== 1 ? 's' : ''} available
          </span>
          <button className={styles.btnDone} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
