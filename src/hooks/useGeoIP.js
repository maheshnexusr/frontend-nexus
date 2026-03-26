/**
 * useGeoIP — requests browser geolocation and stores lat/lng in Redux.
 *
 * Call once on a page that needs geo context before login:
 *   function SignInPage() {
 *     useGeoIP();
 *     return <SignInTabs />;
 *   }
 *
 * If the user denies permission or geolocation is unavailable the hook
 * silently no-ops — the login flow still works without geo data.
 */

import { useEffect } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { setGeoInfo } from '@/features/auth/authSlice';

export function useGeoIP() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        dispatch(
          setGeoInfo({
            ip:        null,   // populated server-side
            city:      null,   // populated server-side
            latitude:  position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        );
      },
      (err) => {
        // Denied / timed-out / unavailable — fail silently
        if (import.meta.env.DEV) {
          console.debug('[useGeoIP] Geolocation unavailable:', err.message);
        }
      },
      { timeout: 5_000, maximumAge: 300_000 },
    );
  }, [dispatch]);
}
