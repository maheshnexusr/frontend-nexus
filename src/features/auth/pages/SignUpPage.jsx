/**
 * SignUpPage — route: /signup
 * Renders inside AuthLayout via <Outlet />.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import SignUpForm from '../components/SignUpForm';

export default function SignUpPage() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const navigate        = useNavigate();

  // Already signed in → redirect to app
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  return <SignUpForm />;
}
