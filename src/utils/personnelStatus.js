// Canonical user-facing personnel statuses + badge styling, shared by the
// sponsor and site personnel listings so both render identically.
//
// The backend derives `displayStatus` for every personnel row:
//   • Active                    — account activated
//   • Inactive                  — deactivated
//   • Invited                   — invitation sent, activation link still valid
//   • Invitation Link Expired   — invitation sent, activation link has lapsed
export const PERSONNEL_STATUSES = [
  'Active',
  'Inactive',
  'Invited',
  'Invitation Link Expired',
];

export const PERSONNEL_STATUS_META = {
  Active:                    { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  Inactive:                  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  Invited:                   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'Invitation Link Expired': { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
};

// Inline style for a status badge, keyed on the user-facing displayStatus.
export const personnelStatusStyle = (status) => {
  const m = PERSONNEL_STATUS_META[status] ?? PERSONNEL_STATUS_META.Inactive;
  return { color: m.color, background: m.bg, borderColor: m.border };
};
