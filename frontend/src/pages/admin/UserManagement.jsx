import React, { useState, useEffect, useCallback } from 'react';
import {
  Title,
  Text,
  Table,
  Badge,
  Group,
  Stack,
  TextInput,
  Select,
  Button,
  ActionIcon,
  Menu,
  Modal,
  Alert,
  Loader,
  Center,
  Code,
  Avatar,
  Pagination,
  PasswordInput,
  Checkbox,
  Paper,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconFilterOff,
  IconDotsVertical,
  IconUserCog,
  IconKey,
  IconUserOff,
  IconUserCheck,
  IconHistory,
  IconTrash,
  IconAlertTriangle,
  IconInfoCircle,
  IconBrandGoogle,
  IconLink,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useAuth } from '../../contexts/AuthContext';
import logger from '../../services/logger';

const ROLE_COLORS = {
  admin: 'red',
  user: 'blue',
  guest: 'gray',
  doctor: 'green',
  nurse: 'teal',
  staff: 'orange',
};

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

const AUTH_METHOD_OPTIONS = [
  { value: '', label: 'All Auth Methods' },
  { value: 'local', label: 'Local' },
  { value: 'sso', label: 'SSO' },
  { value: 'hybrid', label: 'Hybrid' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const ASSIGNABLE_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

const PER_PAGE = 20;

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const { formatDateTime, formatDate } = useDateFormat();

  // Data state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [authMethodFilter, setAuthMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal states
  const [roleModalOpened, { open: openRoleModal, close: closeRoleModal }] = useDisclosure(false);
  const [passwordModalOpened, { open: openPasswordModal, close: closePasswordModal }] = useDisclosure(false);
  const [toggleActiveModalOpened, { open: openToggleActiveModal, close: closeToggleActiveModal }] = useDisclosure(false);
  const [loginHistoryOpened, { open: openLoginHistory, close: closeLoginHistory }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  // Modal data state
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forceChange, setForceChange] = useState(true);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [adminCount, setAdminCount] = useState(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, per_page: PER_PAGE };
      if (search.trim()) params.search = search.trim();
      const response = await adminApiService.getUsers(params);
      const data = response?.data || response;
      const items = data?.items || data?.records || [];
      const total = data?.total || data?.total_count || items.length;
      setUsers(items);
      setTotalPages(Math.max(1, Math.ceil(total / PER_PAGE)));
    } catch (error) {
      logger.error('user_management_fetch_error', 'Failed to fetch users', { error: error.message });
      notifications.show({ title: 'Error', message: 'Failed to load users', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch admin count for safety checks
  const fetchAdminCount = useCallback(async () => {
    try {
      const stats = await adminApiService.getDashboardStats();
      const data = stats?.data || stats;
      setAdminCount(data?.admin_count ?? data?.total_admins ?? null);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchAdminCount();
  }, [fetchAdminCount]);

  // Client-side filtering
  const filteredUsers = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (authMethodFilter && u.auth_method !== authMethodFilter) return false;
    if (statusFilter === 'active' && u.is_active === false) return false;
    if (statusFilter === 'inactive' && u.is_active !== false) return false;
    return true;
  });

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setAuthMethodFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const hasFilters = search || roleFilter || authMethodFilter || statusFilter;

  // Check if user is the last admin
  const isLastAdmin = (user) => {
    return user.role === 'admin' && adminCount !== null && adminCount <= 1;
  };

  // Action helpers
  const handleOpenRoleModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    openRoleModal();
  };

  const handleOpenPasswordModal = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setForceChange(true);
    openPasswordModal();
  };

  const handleOpenToggleActiveModal = (user) => {
    setSelectedUser(user);
    openToggleActiveModal();
  };

  const handleOpenLoginHistory = async (user) => {
    setSelectedUser(user);
    setLoginHistory([]);
    setLoginHistoryLoading(true);
    openLoginHistory();
    try {
      const response = await adminApiService.getUserLoginHistory(user.id);
      const data = response?.data || response;
      setLoginHistory(data?.items || []);
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to load login history', color: 'red' });
    } finally {
      setLoginHistoryLoading(false);
    }
  };

  const handleOpenDeleteModal = (user) => {
    setSelectedUser(user);
    setDeleteConfirmText('');
    openDeleteModal();
  };

  // Action handlers
  const handleChangeRole = async () => {
    if (!selectedUser || newRole === selectedUser.role) return;
    // Safety: prevent removing last admin
    if (selectedUser.role === 'admin' && newRole !== 'admin' && isLastAdmin(selectedUser)) {
      notifications.show({ title: 'Error', message: 'Cannot remove the last administrator role', color: 'red' });
      return;
    }
    setActionLoading(true);
    try {
      await adminApiService.changeUserRole(selectedUser.id, newRole);
      notifications.show({ title: 'Success', message: `Role changed to ${newRole}`, color: 'green' });
      closeRoleModal();
      fetchUsers();
      fetchAdminCount();
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to change role', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || newPassword.length < 6) return;
    setActionLoading(true);
    try {
      await adminApiService.adminResetPassword(selectedUser.id, newPassword);
      if (forceChange) {
        await adminApiService.updateModelRecord('user', selectedUser.id, { must_change_password: true });
      }
      notifications.show({ title: 'Success', message: 'Password reset successfully', color: 'green' });
      closePasswordModal();
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to reset password', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedUser) return;
    // Safety: prevent deactivating self
    if (selectedUser.is_active && selectedUser.id === currentUser?.id) {
      notifications.show({ title: 'Error', message: 'Cannot deactivate your own account', color: 'red' });
      return;
    }
    // Safety: prevent deactivating last admin
    if (selectedUser.is_active && isLastAdmin(selectedUser)) {
      notifications.show({ title: 'Error', message: 'Cannot deactivate the last administrator', color: 'red' });
      return;
    }
    setActionLoading(true);
    try {
      await adminApiService.toggleUserActive(selectedUser.id, !selectedUser.is_active);
      notifications.show({
        title: 'Success',
        message: selectedUser.is_active ? 'User deactivated' : 'User activated',
        color: 'green',
      });
      closeToggleActiveModal();
      fetchUsers();
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to update user status', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || deleteConfirmText !== selectedUser.username) return;
    // Safety: prevent deleting self
    if (selectedUser.id === currentUser?.id) {
      notifications.show({ title: 'Error', message: 'Cannot delete your own account', color: 'red' });
      return;
    }
    // Safety: prevent deleting last admin
    if (isLastAdmin(selectedUser)) {
      notifications.show({ title: 'Error', message: 'Cannot delete the last administrator', color: 'red' });
      return;
    }
    setActionLoading(true);
    try {
      await adminApiService.deleteUser(selectedUser.id);
      notifications.show({ title: 'Success', message: 'User deleted', color: 'green' });
      closeDeleteModal();
      fetchUsers();
      fetchAdminCount();
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to delete user', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  // Render helpers
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getAuthIcon = (method) => {
    if (method === 'sso') return <IconBrandGoogle size={14} />;
    if (method === 'hybrid') return <IconLink size={14} />;
    return <IconKey size={14} />;
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return formatDate(dateStr);
    } catch {
      return formatDate(dateStr) || '-';
    }
  };

  const isSelf = (user) => user.id === currentUser?.id;

  return (
    <AdminLayout>
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>User Management</Title>
          <Text c="dimmed" size="sm">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</Text>
        </Group>

        {/* Filters */}
        <Paper p="md" withBorder>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <TextInput
              placeholder="Search users..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              data={ROLE_OPTIONS}
              value={roleFilter}
              onChange={(v) => setRoleFilter(v || '')}
              placeholder="Role"
              clearable={false}
              style={{ minWidth: 130 }}
            />
            <Select
              data={AUTH_METHOD_OPTIONS}
              value={authMethodFilter}
              onChange={(v) => setAuthMethodFilter(v || '')}
              placeholder="Auth"
              clearable={false}
              style={{ minWidth: 130 }}
            />
            <Select
              data={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || '')}
              placeholder="Status"
              clearable={false}
              style={{ minWidth: 130 }}
            />
            {hasFilters && (
              <Button
                variant="subtle"
                leftSection={<IconFilterOff size={16} />}
                onClick={clearFilters}
                size="sm"
              >
                Clear
              </Button>
            )}
          </Group>
        </Paper>

        {/* Table */}
        {loading ? (
          <Center py="xl"><Loader size="lg" /></Center>
        ) : filteredUsers.length === 0 ? (
          <Alert variant="light" color="gray" title="No users found">
            {hasFilters ? 'No users match your filters. Try adjusting or clearing filters.' : 'No users in the system.'}
          </Alert>
        ) : (
          <>
            <Table.ScrollContainer minWidth={900}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Full Name</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Auth</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Last Login</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th style={{ width: 60 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredUsers.map((u) => (
                    <Table.Tr key={u.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar size="sm" color={ROLE_COLORS[u.role] || 'blue'} radius="xl">
                            {getInitials(u.full_name || u.username)}
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500}>{u.username}</Text>
                            <Text size="xs" c="dimmed">{u.email}</Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>{u.full_name || '-'}</Table.Td>
                      <Table.Td>
                        <Badge color={ROLE_COLORS[u.role] || 'gray'} variant="light" size="sm">
                          {u.role}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          {getAuthIcon(u.auth_method)}
                          <Text size="sm">{u.auth_method || 'local'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={u.is_active === false ? 'red' : 'green'}
                          variant="light"
                          size="sm"
                        >
                          {u.is_active === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{formatRelativeTime(u.last_login_at)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{formatDate(u.created_at) || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Menu shadow="md" width={200} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" aria-label={`Actions for ${u.username}`}>
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconUserCog size={14} />}
                              onClick={() => handleOpenRoleModal(u)}
                            >
                              Change Role
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconKey size={14} />}
                              onClick={() => handleOpenPasswordModal(u)}
                            >
                              Reset Password
                            </Menu.Item>
                            <Menu.Item
                              leftSection={u.is_active === false ? <IconUserCheck size={14} /> : <IconUserOff size={14} />}
                              onClick={() => handleOpenToggleActiveModal(u)}
                              disabled={isSelf(u)}
                            >
                              {u.is_active === false ? 'Activate' : 'Deactivate'}
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconHistory size={14} />}
                              onClick={() => handleOpenLoginHistory(u)}
                            >
                              Login History
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => handleOpenDeleteModal(u)}
                              disabled={isSelf(u)}
                            >
                              Delete User
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {totalPages > 1 && (
              <Center>
                <Pagination value={page} onChange={setPage} total={totalPages} />
              </Center>
            )}
          </>
        )}
      </Stack>

      {/* Change Role Modal */}
      <Modal opened={roleModalOpened} onClose={closeRoleModal} title="Change User Role">
        {selectedUser && (
          <Stack>
            <Text>Changing role for <strong>{selectedUser.username}</strong></Text>
            <Select
              label="Role"
              data={ASSIGNABLE_ROLES}
              value={newRole}
              onChange={(v) => setNewRole(v || '')}
            />
            {(selectedUser.role === 'admin' || newRole === 'admin') && (
              <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
                {newRole === 'admin'
                  ? 'This will grant full administrator privileges.'
                  : 'This will revoke administrator privileges.'}
              </Alert>
            )}
            {selectedUser.role === 'admin' && newRole !== 'admin' && isLastAdmin(selectedUser) && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                Cannot remove the last administrator role.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={closeRoleModal}>Cancel</Button>
              <Button
                onClick={handleChangeRole}
                loading={actionLoading}
                disabled={newRole === selectedUser.role || (selectedUser.role === 'admin' && newRole !== 'admin' && isLastAdmin(selectedUser))}
              >
                Save
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal opened={passwordModalOpened} onClose={closePasswordModal} title="Reset Password">
        {selectedUser && (
          <Stack>
            <Text>Reset password for <strong>{selectedUser.username}</strong></Text>
            {selectedUser.auth_method === 'sso' && (
              <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                This user authenticates via SSO ({selectedUser.sso_provider}).
                Setting a local password will allow hybrid authentication.
              </Alert>
            )}
            <PasswordInput
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              description="Min 6 characters, at least 1 letter and 1 number"
            />
            <Checkbox
              label="Force password change on next login"
              checked={forceChange}
              onChange={(e) => setForceChange(e.currentTarget.checked)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closePasswordModal}>Cancel</Button>
              <Button
                onClick={handleResetPassword}
                loading={actionLoading}
                disabled={newPassword.length < 6}
              >
                Reset Password
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Toggle Active Modal */}
      <Modal
        opened={toggleActiveModalOpened}
        onClose={closeToggleActiveModal}
        title={selectedUser?.is_active === false ? 'Activate User' : 'Deactivate User'}
      >
        {selectedUser && (
          <Stack>
            <Alert
              color={selectedUser.is_active === false ? 'green' : 'red'}
              icon={selectedUser.is_active === false ? <IconUserCheck size={16} /> : <IconAlertTriangle size={16} />}
            >
              {selectedUser.is_active === false
                ? `Activate "${selectedUser.username}"? They will be able to log in again.`
                : `Deactivate "${selectedUser.username}"? They will not be able to log in until reactivated.`}
            </Alert>
            {selectedUser.is_active && isSelf(selectedUser) && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                You cannot deactivate your own account.
              </Alert>
            )}
            {selectedUser.is_active && isLastAdmin(selectedUser) && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                Cannot deactivate the last administrator.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={closeToggleActiveModal}>Cancel</Button>
              <Button
                color={selectedUser.is_active === false ? 'green' : 'red'}
                onClick={handleToggleActive}
                loading={actionLoading}
                disabled={(selectedUser.is_active && isSelf(selectedUser)) || (selectedUser.is_active && isLastAdmin(selectedUser))}
              >
                {selectedUser.is_active === false ? 'Activate' : 'Deactivate'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Login History Modal */}
      <Modal
        opened={loginHistoryOpened}
        onClose={closeLoginHistory}
        title={`Login History: ${selectedUser?.username || ''}`}
        size="lg"
      >
        {selectedUser && (
          <Stack>
            {loginHistoryLoading ? (
              <Center py="xl"><Loader /></Center>
            ) : loginHistory.length === 0 ? (
              <Text c="dimmed" ta="center" py="md">No login history found</Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date & Time</Table.Th>
                    <Table.Th>IP Address</Table.Th>
                    <Table.Th>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loginHistory.map((entry) => (
                    <Table.Tr key={entry.id}>
                      <Table.Td>{formatDateTime(entry.timestamp) || '-'}</Table.Td>
                      <Table.Td><Code>{entry.ip_address || 'N/A'}</Code></Table.Td>
                      <Table.Td>{entry.description || '-'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        )}
      </Modal>

      {/* Delete User Modal */}
      <Modal opened={deleteModalOpened} onClose={closeDeleteModal} title="Delete User">
        {selectedUser && (
          <Stack>
            <Alert color="red" icon={<IconAlertTriangle size={16} />}>
              This action cannot be undone. All data associated with this user will be permanently deleted.
            </Alert>
            {isSelf(selectedUser) && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                You cannot delete your own account.
              </Alert>
            )}
            {isLastAdmin(selectedUser) && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                Cannot delete the last administrator.
              </Alert>
            )}
            <TextInput
              label={`Type "${selectedUser.username}" to confirm`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.currentTarget.value)}
              disabled={isSelf(selectedUser) || isLastAdmin(selectedUser)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeDeleteModal}>Cancel</Button>
              <Button
                color="red"
                onClick={handleDeleteUser}
                loading={actionLoading}
                disabled={deleteConfirmText !== selectedUser.username || isSelf(selectedUser) || isLastAdmin(selectedUser)}
              >
                Delete User
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </AdminLayout>
  );
};

export default UserManagement;
