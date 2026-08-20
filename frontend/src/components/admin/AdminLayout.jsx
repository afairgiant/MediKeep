import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useAuth } from '../../contexts/AuthContext';
import { isUserAdmin } from '../../utils/authUtils';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import AdminBreadcrumbs from './AdminBreadcrumbs';
import { adminApiService } from '../../services/api/adminApi';
import { buildLoginPath } from '../../utils/loginRedirect';
import { currentInternalPath } from '../../utils/safeInternalPath';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    logout,
    sessionEndedReason,
  } = useAuth();

  // Gate admin access on AuthContext user state (populated from /users/me),
  // not client-side JWT decoding — the cookie-auth flow stores the token in
  // an HttpOnly cookie that JS cannot read, so decoding always fails there.
  useEffect(() => {
    // Wait for AuthContext to finish its initial /users/me lookup before deciding.
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !user) {
      // Every /admin route is already wrapped in AdminRoute -> ProtectedRoute,
      // which makes this exact decision. Both fire on an admin logout, so this
      // must carry sessionEndedReason too -- otherwise the two guards race to
      // two different login URLs and the one without it bounces the user
      // straight back to an IdP that still holds a live session.
      //
      // currentInternalPath() rather than the router's `location` so this effect
      // does not have to depend on it -- adding location to the dep array would
      // re-run the admin-access probe on every navigation inside /admin.
      navigate(
        buildLoginPath({
          reason: sessionEndedReason,
          next: currentInternalPath(),
        })
      );
      return;
    }

    if (!isUserAdmin(user)) {
      navigate('/dashboard');
      return;
    }

    // Belt-and-suspenders: confirm with the backend that this user actually
    // has admin access. We don't navigate away on failure because individual
    // admin API calls will 403 the user anyway — this is an early-warning
    // log hook.
    adminApiService.testAdminAccess().catch(() => {
      // Intentionally swallowed: context says admin, backend disagreement
      // will surface on the next admin API call.
    });
  }, [authLoading, isAuthenticated, user, navigate, sessionEndedReason]);

  const handleLogout = async () => {
    try {
      await logout();
      // Navigation is ProtectedRoute's job once the auth state flips; it reads
      // the suppression endSession recorded.
    } catch (logoutError) {
      navigate(buildLoginPath({ reason: 'logged_out' }));
    }
  };

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  // While auth context is still resolving the session (or while we're in the
  // middle of a navigate-away decision), render the loader instead of the
  // admin shell. Once auth is resolved AND the user is confirmed admin, we
  // fall through to the layout render.
  if (authLoading || !user || !isUserAdmin(user)) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Verifying admin access...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <div className="admin-layout">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        currentPath={location.pathname}
      />

      <div
        className={`admin-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
      >
        <AdminHeader
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={toggleSidebar}
        />

        <AdminBreadcrumbs />

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
