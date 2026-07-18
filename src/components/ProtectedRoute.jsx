import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Spinner from '@/components/shared/Spinner';
import { usePrefetchDashboard } from '@/hooks/usePrefetchDashboard';

const DefaultFallback = () => <Spinner fullScreen label="Checking authentication" />;

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const {
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authChecked,
    authError,
    checkUserAuth,
  } = useAuth();

  usePrefetchDashboard(isAuthenticated && authChecked);

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingPublicSettings || isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}
