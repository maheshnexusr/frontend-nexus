/**
 * rolesClient — localStorage CRUD for CRO Roles.
 * Storage key: 'edc_roles'
 *
 * Seed on first access:
 *   • "CRO Administrator" — system role, all permissions enabled, cannot be deleted/edited.
 *   • 8 common CRO role names with empty permissions (available for team member assignment).
 */

import { buildPermissions } from '@/features/cro/constants/permissionsSchema';

const KEY = 'edc_roles';

// ── Seed data ─────────────────────────────────────────────────────────────────
const SYSTEM_ROLE_ID = 'role-system-admin';

function buildSeed(now) {
  return [
    {
      id:          SYSTEM_ROLE_ID,
      name:        'CRO Administrator',
      description: 'Full administrative access to the platform. All permissions are enabled.',
      isSystem:    true,
      permissions: buildPermissions(true),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-2',
      name:        'Project Manager',
      description: 'Oversees study planning and execution.',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-3',
      name:        'Data Manager',
      description: 'Manages study data integrity and validation.',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-4',
      name:        'Clinical Research Associate',
      description: 'Monitors clinical study sites (CRA).',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-5',
      name:        'Site Monitor',
      description: 'Performs on-site monitoring activities.',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-6',
      name:        'Statistician',
      description: 'Statistical analysis and data review.',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-7',
      name:        'Medical Monitor',
      description: 'Medical oversight and patient safety review.',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-8',
      name:        'Regulatory Affairs Specialist',
      description: 'Regulatory submissions and compliance.',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
    {
      id:          'role-9',
      name:        'Study Coordinator',
      description: 'Coordinates day-to-day study operations.',
      isSystem:    false,
      permissions: buildPermissions(false),
      createdAt:   now,
      updatedAt:   now,
    },
  ];
}

// ── Storage helpers ───────────────────────────────────────────────────────────
function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid() { return `role-${++_counter}`; }

function getAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const seeded = buildSeed(now());
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// ── Client ────────────────────────────────────────────────────────────────────
export const rolesClient = {
  list()      { return Promise.resolve(getAll()); },
  getById(id) { return Promise.resolve(getAll().find((r) => r.id === id) ?? null); },

  create(data) {
    const all    = getAll();
    const record = {
      id:          uid(),
      isSystem:    false,
      permissions: buildPermissions(false),
      ...data,
      createdAt:   now(),
      updatedAt:   now(),
    };
    persist([...all, record]);
    return Promise.resolve(record);
  },

  update(id, data) {
    const all = getAll();
    const target = all.find((r) => r.id === id);
    // Prevent editing the system role
    if (target?.isSystem) return Promise.reject(new Error('System role cannot be edited.'));
    let updated;
    const next = all.map((r) => {
      if (r.id !== id) return r;
      updated = { ...r, ...data, id, isSystem: r.isSystem, updatedAt: now() };
      return updated;
    });
    persist(next);
    return Promise.resolve(updated ?? null);
  },

  delete(id) {
    const all    = getAll();
    const target = all.find((r) => r.id === id);
    if (target?.isSystem) return Promise.reject(new Error('System role cannot be deleted.'));
    persist(all.filter((r) => r.id !== id));
    return Promise.resolve();
  },

  /** Returns true if a role with the given name already exists (excluding `excludeId`). */
  nameExists(name, excludeId = null) {
    const norm   = (name ?? '').toLowerCase().trim();
    const exists = getAll().some(
      (r) => r.name?.toLowerCase().trim() === norm && r.id !== excludeId,
    );
    return Promise.resolve(exists);
  },

  /** Returns true if the role is assigned to at least one team member. */
  isInUse(id) {
    try {
      const members = JSON.parse(localStorage.getItem('edc_team_members') ?? '[]');
      return Promise.resolve(members.some((m) => m.roleId === id));
    } catch {
      return Promise.resolve(false);
    }
  },
};
