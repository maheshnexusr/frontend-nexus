/**
 * useStorageSync — propagates logout across browser tabs via localStorage events.
 *
 * How it works:
 *   1. When isAuthenticated transitions to false (this tab logged out), it writes
 *      a broadcast key to localStorage so other tabs can detect it.
 *   2. Every tab listens for that key via the native "storage" event
 *      (only fires for changes made by OTHER tabs) and dispatches logout().
 *
 * Mount once at the app root or inside BrowserRouter:
 *   function App() {
 *     useStorageSync();
 *     return <RouterOutlet />;
 *   }
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout, selectIsAuthenticated } from '@/features/auth/authSlice';

const BROADCAST_KEY = 'auth:logout-broadcast';

export function useStorageSync() {
  const dispatch        = useAppDispatch();
  const navigate        = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const prevAuthRef     = useRef(isAuthenticated);

  /* Broadcast logout to other tabs when this tab signs out */
  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current    = isAuthenticated;

    if (wasAuthenticated && !isAuthenticated) {
      // Stamp with timestamp so repeated logouts each fire the storage event
      localStorage.setItem(BROADCAST_KEY, Date.now().toString());
    }
  }, [isAuthenticated]);

  /* Listen for logout broadcast from other tabs */
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== BROADCAST_KEY || e.newValue === null) return;
      // Another tab signed out — mirror that here
      dispatch(logout());
      navigate('/', { replace: true });
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [dispatch, navigate]);
}
