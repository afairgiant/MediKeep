import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import { notifyError, notifyWarning } from '../../utils/notifyTranslated';

/**
 * Enhanced Protected Route Component
 * Provides comprehensive authentication and authorization protection
 */
function ProtectedRoute({
  children,
  requiredRole = null,
  requiredRoles = [],
  adminOnly = false,
  redirectTo = '/login',
  fallback = null,
}) {
  const { isAuthenticated, isLoading, user, hasRole, hasAnyRole, mustChangePassword } = useAuth();
  const location = useLocation();
  const toastShownRef = useRef(false);

  // Determine redirect reason and target
  const getRedirectInfo = () => {
    if (isLoading) {
      return null;
    }

    if (!isAuthenticated) {
      return { to: redirectTo, reason: 'unauthenticated' };
    }

    // Authenticated but must change password — block access to all other routes
    if (mustChangePassword && location.pathname !== '/change-password') {
      return { to: '/change-password', reason: 'must-change-password' };
    }

    if (adminOnly && !user?.isAdmin) {
      return { to: '/dashboard', reason: 'admin-required' };
    }
    
    if (requiredRole && !hasRole(requiredRole)) {
      return { to: '/dashboard', reason: 'role-required', role: requiredRole };
    }
    
    if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
      return { to: '/dashboard', reason: 'roles-required', roles: requiredRoles };
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
          notifyError('notifications:toasts.auth.accessDeniedRole', { interpolation: { role: redirectInfo.role } });
          break;
        case 'roles-required':
          notifyError('notifications:toasts.auth.accessDeniedRoles', { interpolation: { roles: redirectInfo.roles.join(', ') } });
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
export function PublicRoute({ children, redirectTo = '/dashboard' }) {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? '/change-password' : redirectTo} replace />;
  }

  return children;
}

export default ProtectedRoute;
