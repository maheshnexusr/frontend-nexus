/**
 * SignInPage — route: /signin
 * Renders inside AuthLayout via <Outlet />.
 * Triggers useGeoIP on mount to populate lat/lng before the user submits.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated, selectCurrentUser } from '@/features/auth/authSlice';
import { useGeoIP } from '@/hooks/useGeoIP';
import { getRoleRedirect } from '@/lib/roleRedirect';
import SignInTabs  from '../components/SignInTabs';

export default function SignInPage() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const currentUser     = useAppSelector(selectCurrentUser);
  const navigate        = useNavigate();

  // Populate Redux geoInfo silently in the background
  useGeoIP();

  // Already signed in → redirect to the correct workspace for this role
  useEffect(() => {
    if (isAuthenticated) navigate(getRoleRedirect(currentUser), { replace: true });
  }, [isAuthenticated, currentUser, navigate]);

  return <SignInTabs />;
}
