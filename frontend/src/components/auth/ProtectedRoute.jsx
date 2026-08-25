import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isUserAdmin } from '../../utils/authUtils';
import LoadingSpinner from '../ui/LoadingSpinner';
import { notifyError, notifyWarning } from '../../utils/notifyTranslated';
import { buildLoginPath } from '../../utils/loginRedirect';
import { useRegistrationAvailable } from '../../hooks/useRegistrationAvailable';

/**
 * Enhanced Protected Route Component
 * Provides comprehensive authentication and authorization protection
 */
function ProtectedRoute({
  children,
  requiredRole = null,
  requiredRoles = [],
  adminOnly = false,
  fallback = null,
}) {
  const {
    isAuthenticated,
    isLoading,
    user,
    hasRole,
    hasAnyRole,
    mustChangePassword,
    sessionEndedReason,
  } = useAuth();
  const location = useLocation();
  const toastShownRef = useRef(false);

  // Determine redirect reason and target
  const getRedirectInfo = () => {
    if (isLoading) {
      return null;
    }

    if (!isAuthenticated) {
      // This is the one redirect that is SUPPOSED to reach the identity provider
      // when SSO_AUTO_REDIRECT is on -- someone asked for a protected page and
      // needs to sign in. It only carries suppression when the session ended by
      // our own action, which AuthContext records as sessionEndedReason.
      //
      // The return path travels in the URL, not in router state: several callers
      // reach the login page through a full page load, which discards state. The
      // `from` state below is kept as a fallback for the soft-navigation case.
      return {
        to: buildLoginPath({
          reason: sessionEndedReason,
          next: `${location.pathname}${location.search}${location.hash}`,
        }),
        reason: 'unauthenticated',
      };
    }

    // Authenticated but must change password — block access to all other routes
    if (mustChangePassword && location.pathname !== '/change-password') {
      return { to: '/change-password', reason: 'must-change-password' };
    }

    // Derive admin status from user.role via the canonical util — the
    // `user.isAdmin` cache is only populated on the SSO login path, so
    // regular-login and session-restored users would otherwise be falsely
    // denied admin access even with role='admin'.
    if (adminOnly && !isUserAdmin(user)) {
      return { to: '/dashboard', reason: 'admin-required' };
    }

    if (requiredRole && !hasRole(requiredRole)) {
      return { to: '/dashboard', reason: 'role-required', role: requiredRole };
    }

    if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
      return {
        to: '/dashboard',
        reason: 'roles-required',
        roles: requiredRoles,
      };
    }

    return null;
  };

  const redirectInfo = getRedirectInfo();

  // Show toast notifications after render using useEffect
  useEffect(() => {
    // Reset toast flag when authentication state changes
    toastShownRef.current = false;
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    // Only show toast if we have redirect info and haven't shown one yet
    if (redirectInfo && !toastShownRef.current && !isLoading) {
      toastShownRef.current = true;

      switch (redirectInfo.reason) {
        case 'unauthenticated':
          notifyWarning('notifications:toasts.auth.loginRequired');
          break;
        case 'admin-required':
          notifyError('notifications:toasts.auth.accessDeniedAdmin');
          break;
        case 'role-required':
          notifyError('notifications:toasts.auth.accessDeniedRole', {
            interpolation: { role: redirectInfo.role },
          });
          break;
        case 'roles-required':
          notifyError('notifications:toasts.auth.accessDeniedRoles', {
            interpolation: { roles: redirectInfo.roles.join(', ') },
          });
          break;
        default:
          break;
      }
    }
  }, [redirectInfo, isLoading]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return fallback || <LoadingSpinner message="Verifying authentication..." />;
  }

  // If we need to redirect, do it without showing toast (toast handled in useEffect)
  if (redirectInfo) {
    return <Navigate to={redirectInfo.to} state={{ from: location }} replace />;
  }

  // All checks passed - render the protected content
  return children;
}

/**
 * Admin-only Protected Route
 * Convenience wrapper for admin-only pages
 */
export function AdminRoute({ children, ...props }) {
  return (
    <ProtectedRoute adminOnly={true} {...props}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * Role-based Protected Route
 * Convenience wrapper for role-specific pages
 */
export function RoleRoute({ role, roles, children, ...props }) {
  return (
    <ProtectedRoute requiredRole={role} requiredRoles={roles || []} {...props}>
      {children}
    </ProtectedRoute>
  );
}

/**
 * Public Route Component
 * Redirects authenticated users away from auth pages.
 * If the user must change their password, they are sent to /change-password
 * rather than the default dashboard so the forced-change flow is not skipped.
 */
export function PublicRoute({
  children,
  redirectTo = '/dashboard',
  requiresRegistration = false,
}) {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();
  // Opt-in, and skipped entirely for a signed-in user: they are being sent to
  // the dashboard below and should not wait on a request that cannot change
  // that. /login and the SSO callback pass no prop and issue no request.
  const registration = useRegistrationAvailable(
    requiresRegistration && !isAuthenticated
  );

  if (isLoading || registration.loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={mustChangePassword ? '/change-password' : redirectTo}
        replace
      />
    );
  }

  // Registration is unavailable -- because SSO_ONLY_MODE is on, or because
  // ALLOW_USER_REGISTRATION is off. Either way this page can do nothing but
  // fail at submit, so send them somewhere that can help.
  //
  // No reason attached: nobody was signed out. Attaching one would tell a
  // visitor they had been, and would suppress a redirect to the identity
  // provider that should happen under SSO_AUTO_REDIRECT.
  if (requiresRegistration && !registration.available) {
    return <Navigate to={buildLoginPath()} replace />;
  }

  return children;
}

export default ProtectedRoute;
