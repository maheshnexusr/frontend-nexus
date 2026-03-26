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

  const canAccess = (permission) => permissions.includes(permission);

  return { canAccess, permissions };
};
