import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useAuth } from '../../contexts/AuthContext';
import { isUserAdmin } from '../../utils/authUtils';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import AdminBreadcrumbs from './AdminBreadcrumbs';
import { adminApiService } from '../../services/api/adminApi';
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
      navigate('/login');
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
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (logoutError) {
      navigate('/login');
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

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