/**
 * usePermissions — convenience hook for permission checks
 *
 * @returns {{ canAccess: (permission: string) => boolean, permissions: string[] }}
 *
 * @example
 *   const { canAccess } = usePermissions();
 *   if (canAccess('team:read')) { ... }
 */

import { useAppSelector } from '@/app/hooks';

export const usePermissions = () => {
  const permissions = useAppSelector((state) => state.auth.permissions);

  const isAdmin = permissions.includes('*');

  /** Check a dot-notation permission string e.g. 'teamAdmin.teamMembers.view' */
  const canAccess = (permission) => isAdmin || permissions.includes(permission);

  /** Convenience: can('teamAdmin', 'teamMembers', 'view') */
  const can = (group, feature, perm) => isAdmin || permissions.includes(`${group}.${feature}.${perm}`);

  return { canAccess, can, isAdmin, permissions };
};
