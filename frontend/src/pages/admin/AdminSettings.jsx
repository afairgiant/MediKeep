import { useState, useEffect } from 'react';
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Switch,
  NumberInput,
  Select,
  Alert,
  ThemeIcon,
  Center,
  Loader,
  List,
  Code,
} from '@mantine/core';
import {
  IconSettings,
  IconTrash,
  IconUsers,
  IconLock,
  IconDeviceFloppy,
  IconRestore,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconInfoCircle,
  IconPlugConnected,
} from '@tabler/icons-react';
import { adminApiService } from '../../services/api/adminApi';
import { authService } from '../../services/auth/simpleAuthService';
import AdminLayout from '../../components/admin/AdminLayout';
import frontendLogger from '../../services/frontendLogger';
import { capitalizeFirst } from '../../utils/dateFormatUtils';
import './AdminSettings.css';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    trash_retention_days: 30,
    allow_user_registration: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [ssoConfig, setSSOConfig] = useState({ enabled: false });
  const [ssoTestLoading, setSSOTestLoading] = useState(false);
  const [ssoTestResult, setSSOTestResult] = useState(null);
  useEffect(() => {
    loadSettings();
    loadSSOConfig();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await adminApiService.getRetentionSettings();
      setSettings(data);
    } catch (error) {
      frontendLogger.logError('Error loading settings', {
        error: error.message,
        component: 'AdminSettings',
      });
      setMessage({
        type: 'error',
        text: 'Failed to load settings: ' + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (value === '' || value === undefined) {
      setSettings(prev => ({ ...prev, [field]: '' }));
      return;
    }
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue < 1) {
      return;
    }
    setSettings(prev => ({ ...prev, [field]: numValue }));
  };

  const handleBlur = (field, min = 1) => {
    if (settings[field] === '' || settings[field] < min) {
      setSettings(prev => ({
        ...prev,
        [field]: min,
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const validSettings = {
        trash_retention_days: settings.trash_retention_days || 30,
      };

      setSettings(prev => ({
        ...prev,
        ...validSettings,
      }));

      const updateData = {
        ...validSettings,
        allow_user_registration: settings.allow_user_registration,
      };

      const response =
        await adminApiService.updateRetentionSettings(updateData);

      setMessage({
        type: 'success',
        text: response.message || 'Settings updated successfully',
      });

      if (response.current_settings) {
        setSettings(response.current_settings);
      }

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
    } catch (error) {
      frontendLogger.logError('Error saving settings', {
        error: error.message,
        component: 'AdminSettings',
      });
      setMessage({
        type: 'error',
        text: 'Failed to save settings: ' + error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const loadSSOConfig = async () => {
    try {
      const config = await authService.getSSOConfig();
      setSSOConfig(config);
    } catch (error) {
      frontendLogger.logError('Error loading SSO config', {
        error: error.message,
        component: 'AdminSettings',
      });
    }
  };

  const testSSOConnection = async () => {
    try {
      setSSOTestLoading(true);
      setSSOTestResult(null);

      const result = await authService.testSSOConnection();
      setSSOTestResult(result);
    } catch (error) {
      setSSOTestResult({
        success: false,
        message: error.message || 'Connection test failed',
      });
    } finally {
      setSSOTestLoading(false);
    }
  };

  const handleReset = () => {
    loadSettings();
    loadSSOConfig();
    setSSOTestResult(null);
    setMessage({ type: '', text: '' });
  };

  if (loading) {
    return (
      <AdminLayout>
        <Center h={400}>
          <Stack align="center">
            <Loader size="lg" />
            <Text c="dimmed">Loading settings...</Text>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-settings">
        {/* Page Header */}
        <Card shadow="sm" p="xl" mb="xl" withBorder>
          <Group align="center" mb="xs">
            <ThemeIcon size="xl" variant="light" color="blue">
              <IconSettings size={24} />
            </ThemeIcon>
            <Text size="xl" fw={700}>
              Admin Settings
            </Text>
          </Group>
          <Text c="dimmed" size="md">
            Configure system-wide settings and retention policies
          </Text>
        </Card>

        {/* Success/Error Message */}
        {message.text && (
          <Alert
            color={message.type === 'success' ? 'green' : 'red'}
            icon={
              message.type === 'success' ? (
                <IconCheck size={16} />
              ) : (
                <IconAlertCircle size={16} />
              )
            }
            withCloseButton
            onClose={() => setMessage({ type: '', text: '' })}
            mb="lg"
          >
            {message.text}
          </Alert>
        )}

        {/* Data Retention */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconTrash size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Data Retention
            </Text>
          </Group>
          <Group justify="space-between" align="flex-start">
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={500}>Trash Retention</Text>
              <Text size="sm" c="dimmed">
                Number of days to keep deleted files in trash before permanent
                deletion
              </Text>
            </Stack>
            <NumberInput
              w={160}
              min={1}
              max={365}
              value={settings.trash_retention_days}
              onChange={value => handleInputChange('trash_retention_days', value)}
              onBlur={() => handleBlur('trash_retention_days', 1)}
              suffix=" days"
            />
          </Group>
        </Card>

        {/* User Management */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="teal">
              <IconUsers size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              User Management
            </Text>
          </Group>
          <Group justify="space-between" align="flex-start">
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={500}>Allow New User Registration</Text>
              <Text size="sm" c="dimmed">
                Enable or disable the ability for new users to create accounts
                from the login page
              </Text>
            </Stack>
            <Group gap="sm">
              <Switch
                size="lg"
                checked={settings.allow_user_registration}
                onChange={e =>
                  setSettings(prev => ({
                    ...prev,
                    allow_user_registration: e.currentTarget.checked,
                  }))
                }
              />
              <Badge
                variant="light"
                color={settings.allow_user_registration ? 'green' : 'red'}
              >
                {settings.allow_user_registration ? 'Enabled' : 'Disabled'}
              </Badge>
            </Group>
          </Group>
        </Card>

        {/* SSO Settings */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconLock size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Single Sign-On (SSO)
            </Text>
            <Badge
              variant="light"
              color={ssoConfig.enabled ? 'green' : 'gray'}
            >
              {ssoConfig.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>

          <Stack>
            {ssoConfig.enabled ? (
              <>
                <Group justify="space-between">
                  <Text fw={500}>Provider</Text>
                  <Text c="dimmed">
                    {capitalizeFirst(ssoConfig.provider_type) || 'Unknown'}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text fw={500}>SSO Registration</Text>
                  <Badge
                    variant="light"
                    color={ssoConfig.registration_enabled ? 'green' : 'yellow'}
                  >
                    {ssoConfig.registration_enabled ? 'Allowed' : 'Blocked'}
                  </Badge>
                </Group>

                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text fw={500}>Test Connection</Text>
                    <Text size="sm" c="dimmed">
                      Test the SSO provider connection and configuration
                    </Text>
                  </Stack>
                  <Button
                    variant="light"
                    leftSection={<IconPlugConnected size={16} />}
                    onClick={testSSOConnection}
                    loading={ssoTestLoading}
                  >
                    Test SSO Connection
                  </Button>
                </Group>

                {ssoTestResult && (
                  <Alert
                    color={ssoTestResult.success ? 'green' : 'red'}
                    variant="light"
                    icon={
                      ssoTestResult.success ? (
                        <IconCheck size={16} />
                      ) : (
                        <IconX size={16} />
                      )
                    }
                  >
                    {ssoTestResult.message}
                  </Alert>
                )}
              </>
            ) : (
              <Alert
                variant="light"
                color="blue"
                icon={<IconInfoCircle size={16} />}
              >
                <Text size="sm" mb="xs">
                  SSO is currently disabled. To enable SSO, configure the
                  following environment variables and restart the application:
                </Text>
                <List size="sm" spacing={4}>
                  <List.Item>
                    <Code>SSO_ENABLED=true</Code>
                  </List.Item>
                  <List.Item>
                    <Code>SSO_PROVIDER_TYPE</Code> (google, github, or oidc)
                  </List.Item>
                  <List.Item>
                    <Code>SSO_CLIENT_ID</Code>
                  </List.Item>
                  <List.Item>
                    <Code>SSO_CLIENT_SECRET</Code>
                  </List.Item>
                  <List.Item>
                    <Code>SSO_ISSUER_URL</Code> (for OIDC provider)
                  </List.Item>
                  <List.Item>
                    <Code>SSO_REDIRECT_URI</Code>
                  </List.Item>
                </List>
              </Alert>
            )}
          </Stack>
        </Card>

        {/* Save/Reset Actions */}
        <Card shadow="sm" p="lg" withBorder>
          <Group justify="flex-end">
            <Button
              variant="default"
              leftSection={<IconRestore size={16} />}
              onClick={handleReset}
              disabled={saving}
            >
              Reset All
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              Save All Changes
            </Button>
          </Group>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
