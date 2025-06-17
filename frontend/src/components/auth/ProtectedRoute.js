import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import { toast } from 'react-toastify';

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
  const { isAuthenticated, isLoading, user, hasRole, hasAnyRole } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return fallback || <LoadingSpinner message="Verifying authentication..." />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    toast.warn('Please log in to access this page');
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check admin-only access
  if (adminOnly && !user?.isAdmin) {
    toast.error('Access denied: Administrator privileges required');
    return <Navigate to="/dashboard" replace />;
  }

  // Check specific role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    toast.error(`Access denied: ${requiredRole} role required`);
    return <Navigate to="/dashboard" replace />;
  }

  // Check multiple roles requirement (user must have at least one)
  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    toast.error(
      `Access denied: One of these roles required: ${requiredRoles.join(', ')}`
    );
    return <Navigate to="/dashboard" replace />;
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
 * Redirects authenticated users away from auth pages
 */
export function PublicRoute({ children, redirectTo = '/dashboard' }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default ProtectedRoute;
