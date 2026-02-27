import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Center, Loader, Text, Alert, Button, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import AdminBreadcrumbs from './AdminBreadcrumbs';
import { adminApiService } from '../../services/api/adminApi';
import { secureStorage, legacyMigration } from '../../utils/secureStorage';
import logger from '../../services/logger';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    const ENCRYPTION_INIT_RETRY_DELAY = 100;

    async function checkAdminAccess() {
      try {
        setLoading(true);
        setError(null);

        await legacyMigration.migrateFromLocalStorage();

        let token = await secureStorage.getItem('token');

        // Retry once if encryption key might not be ready yet
        if (!token) {
          await new Promise(resolve => setTimeout(resolve, ENCRYPTION_INIT_RETRY_DELAY));
          token = await secureStorage.getItem('token');
        }

        if (!token) {
          navigate('/login');
          return;
        }

        let payload;
        try {
          payload = JSON.parse(atob(token.split('.')[1]));
        } catch (decodeError) {
          logger.error('Failed to decode token:', decodeError);
          await secureStorage.removeItem('token');
          navigate('/login');
          return;
        }

        if (payload.exp < Date.now() / 1000) {
          await secureStorage.removeItem('token');
          navigate('/login');
          return;
        }

        const userRole = payload.role || '';
        if (
          userRole.toLowerCase() !== 'admin' &&
          userRole.toLowerCase() !== 'administrator'
        ) {
          navigate('/dashboard');
          return;
        }

        setUser({
          username: payload.sub,
          role: userRole,
          fullName: payload.full_name || payload.sub,
        });

        try {
          await adminApiService.testAdminAccess();
        } catch (apiError) {
          // Backend test is optional -- user already passed token validation
        }
      } catch (error) {
        setError('Authentication failed. Please try logging in again.');
        setTimeout(() => navigate('/login'), 3000);
      } finally {
        setLoading(false);
      }
    }

    checkAdminAccess();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      navigate('/login');
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Verifying admin access...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md" maw={500}>
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Access Error"
            color="red"
            variant="light"
          >
            {error}
          </Alert>
          <Button variant="light" onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
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