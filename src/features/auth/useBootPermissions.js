/**
 * useBootPermissions — refresh permissions from /api/v1/profile/me/permissions
 * whenever the user has at least one token in any scope.
 *
 * Mount once at app root (inside the Router so React Router context exists if
 * the hook ever uses it). Re-runs whenever the authenticated user changes, so
 * sign-in / sign-out / scope switches all trigger a refresh.
 *
 * Failures are ALL silent — the sidebar gracefully falls back to whatever
 * permissions are cached in localStorage / Redux. This hook must never sign
 * the user out on its own: that path produced "unable to login" symptoms for
 * sponsor users when the endpoint returned 404 mid-login.
 */

import { useEffect } from 'react';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { profileClient } from '@/api/profileClient';
import { applyPermissions } from '@/features/auth/applyPermissions';

/** A token must be a non-empty string of plausible length to attach as a
 *  Bearer. Guarding against literal "null" / empty / suspiciously short
 *  values means /profile/me/permissions can NEVER fire without auth. */
function isUsableToken(t) {
  return typeof t === 'string' && t.length > 10 && t !== 'null' && t !== 'undefined';
}

function hasAnyToken() {
  if (typeof window === 'undefined') return false;
  return (
       isUsableToken(localStorage.getItem('accessToken'))
    || isUsableToken(localStorage.getItem('sponsorAccessToken'))
    || isUsableToken(localStorage.getItem('sponsorViewToken'))
    || isUsableToken(localStorage.getItem('siteAccessToken'))
  );
}

/** Sponsor users skip this endpoint entirely — their menu is driven by
 *  study scope + study config, not by a role permission tree. */
function isSponsorSession() {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('sponsorAccessToken');
}

/** Site users skip this endpoint too — their permissions live in
 *  siteStudyContext.permissions (written by POST /site/studies/choose) and
 *  the session token (siteAccessToken) doesn't carry studyId/personnelId,
 *  so /profile/me/permissions would return 404/401 anyway. */
function isSiteSession() {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('siteAccessToken');
}

export function useBootPermissions() {
  // Re-fire when the user identity changes (login / logout / scope switch).
  const user   = useAppSelector(selectCurrentUser);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!hasAnyToken()) return;
    if (isSponsorSession()) return;
    if (isSiteSession()) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await profileClient.fetchMyPermissions();
        if (cancelled) return;
        applyPermissions(payload);
      } catch {
        // Silent — fall back to cached permissions. Do NOT logout / redirect.
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
}
