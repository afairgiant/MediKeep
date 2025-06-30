import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  Text,
  Title,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Divider,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Progress,
  Timeline,
  Button,
  Notification,
  Alert,
  TextInput,
  Box,
  Flex,
} from '@mantine/core';
import {
  IconStethoscope,
  IconFlask,
  IconPill,
  IconHeartbeat,
  IconVaccine,
  IconClipboardList,
  IconAlertTriangle,
  IconBrain,
  IconMedicalCross,
  IconCalendarEvent,
  IconFileExport,
  IconUser,
  IconBuilding,
  IconSettings,
  IconChevronRight,
  IconAlertCircle,
  IconInfoCircle,
  IconSearch,
} from '@tabler/icons-react';
import ProfileCompletionModal from '../components/auth/ProfileCompletionModal';
import { PageHeader } from '../components';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentPatient } from '../hooks/useGlobalData';
import { formatDateTime } from '../utils/helpers';

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    user: authUser,
    shouldShowProfilePrompts,
    checkIsFirstLogin,
  } = useAuth();

  // Using global state for patient data
  const { patient: user, loading: patientLoading } = useCurrentPatient();

  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Combine loading states
  const loading = patientLoading || activityLoading;

  useEffect(() => {
    fetchRecentActivity();
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (authUser && user) {
      checkProfileCompletionModal();
    }
  }, [authUser, user]);

  const checkProfileCompletionModal = () => {
    if (
      authUser &&
      user &&
      checkIsFirstLogin() &&
      shouldShowProfilePrompts(user)
    ) {
      setTimeout(() => {
        setShowProfileModal(true);
      }, 1000);
    }
  };

  const checkAdminStatus = () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role || '';
        const adminCheck =
          userRole.toLowerCase() === 'admin' ||
          userRole.toLowerCase() === 'administrator';
        setIsAdmin(adminCheck);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      setActivityLoading(true);
      const activity = await apiService.getRecentActivity();
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  // Placeholder stats data - can be replaced with real data later
  const dashboardStats = [
    { label: 'Total Records*', value: '3', color: 'blue' },
    { label: 'Active Medications*', value: '2', color: 'green' },
    { label: 'Total Lab Tests*', value: '3', color: 'orange' },
    { label: 'Total Procedures*', value: '4', color: 'purple' },
  ];

  // Core medical modules - organized in 2x2 grid sections like the schematic
  const coreModules = [
    {
      title: 'Patient Information',
      icon: IconUser,
      color: 'blue',
      link: '/patients/me',
    },
    {
      title: 'Medications',
      icon: IconPill,
      color: 'green',
      link: '/medications',
    },
    {
      title: 'Lab Results',
      icon: IconFlask,
      color: 'teal',
      link: '/lab-results',
    },
  ];

  const treatmentModules = [
    {
      title: 'Treatments',
      icon: IconClipboardList,
      color: 'cyan',
      link: '/treatments',
    },
    {
      title: 'Procedures',
      icon: IconMedicalCross,
      color: 'indigo',
      link: '/procedures',
    },
  ];

  const monitoringModules = [
    {
      title: 'Vital Signs',
      icon: IconHeartbeat,
      color: 'red',
      link: '/vitals',
    },
    {
      title: 'Conditions',
      icon: IconBrain,
      color: 'pink',
      link: '/conditions',
    },
    {
      title: 'Allergies',
      icon: IconAlertTriangle,
      color: 'orange',
      link: '/allergies',
    },
  ];

  const preventionModules = [
    {
      title: 'Immunizations',
      icon: IconVaccine,
      color: 'purple',
      link: '/immunizations',
    },
    {
      title: 'Visit History',
      icon: IconCalendarEvent,
      color: 'yellow',
      link: '/visits',
    },
  ];

  // Additional resources
  const additionalModules = [
    {
      title: 'Export Records',
      icon: IconFileExport,
      color: 'violet',
      link: '/export',
    },
    {
      title: 'Practitioners',
      icon: IconUser,
      color: 'blue',
      link: '/practitioners',
    },
    {
      title: 'Pharmacies',
      icon: IconBuilding,
      color: 'green',
      link: '/pharmacies',
    },
  ];

  // Add admin dashboard if user is admin
  if (isAdmin) {
    additionalModules.unshift({
      title: 'Admin Dashboard',
      icon: IconSettings,
      color: 'dark',
      link: '/admin',
    });
  }

  const StatCard = ({ stat }) => (
    <Card shadow="sm" padding="lg" radius="md" withBorder h={100}>
      <Stack align="center" justify="center" h="100%">
        <Text size="xl" fw={700} c={stat.color}>
          {stat.value}
        </Text>
        <Text size="sm" c="dimmed" ta="center">
          {stat.label}
        </Text>
      </Stack>
    </Card>
  );

  const ModuleCard = ({ module }) => {
    const Icon = module.icon;

    return (
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        onClick={() => navigate(module.link)}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          height: '120px',
        }}
        styles={{
          root: {
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        <Flex direction="column" justify="center" align="center" h="100%">
          <ThemeIcon
            color={module.color}
            size={40}
            radius="md"
            variant="light"
            mb="xs"
          >
            <Icon size={24} />
          </ThemeIcon>
          <Text size="sm" fw={600} ta="center">
            {module.title}
          </Text>
        </Flex>
      </Card>
    );
  };

  const RecentActivityList = () => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={3} size="h4" mb="md">
        Recent Activity
      </Title>

      {recentActivity.length > 0 ? (
        <Stack gap="sm">
          {recentActivity.slice(0, 4).map((activity, index) => (
            <Group key={index} align="flex-start" gap="sm">
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-blue-6)',
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={500} lineClamp={2}>
                  {activity.description}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatDateTime(activity.timestamp)}
                </Text>
              </Stack>
            </Group>
          ))}
        </Stack>
      ) : (
        <Paper p="md" radius="md" bg="gray.1">
          <Stack align="center" gap="xs">
            <ThemeIcon color="gray" variant="light" size="lg">
              <IconAlertCircle size={20} />
            </ThemeIcon>
            <Text size="sm" fw={500} c="dimmed" ta="center">
              No recent activity
            </Text>
          </Stack>
        </Paper>
      )}
    </Card>
  );

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" justify="center" style={{ minHeight: '60vh' }}>
          <Progress
            value={75}
            size="lg"
            radius="xl"
            w="100%"
            maw={400}
            animate
          />
          <Text c="dimmed">Loading your medical dashboard...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <PageHeader
        title="Medical Records Dashboard"
        icon="🏥"
        variant="dashboard"
        showBackButton={false}
      />

      <Container size="xl" py="xl">
        {/* Welcome Section */}
        <Paper
          p="md"
          radius="md"
          mb="xl"
          bg="var(--mantine-primary-color-filled)"
          c="white"
        >
          <Group justify="space-between" align="center">
            <div>
              <Title order={2} size="h3" fw={600} mb={4}>
                Medical Records Dashboard
              </Title>
              <Text size="sm" opacity={0.9}>
                Manage your health information securely
              </Text>
            </div>
            {user && (
              <Badge color="rgba(255,255,255,0.2)" variant="filled" size="lg">
                Hello, {user.first_name} {user.last_name}!
              </Badge>
            )}
          </Group>
        </Paper>

        {/* Search Bar */}
        <Flex justify="flex-end" mb="xl">
          <TextInput
            placeholder="search"
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={event => setSearchQuery(event.currentTarget.value)}
            w={300}
            radius="md"
          />
        </Flex>

        {/* Stats Row */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
          {dashboardStats.map((stat, index) => (
            <StatCard key={index} stat={stat} />
          ))}
        </SimpleGrid>

        {/* Main Content Grid */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="xl">
              {/* Core Medical Information */}
              <div>
                <Title order={2} size="h3" mb="md">
                  Core Medical Information
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                  {coreModules.map((module, index) => (
                    <ModuleCard key={index} module={module} />
                  ))}
                </SimpleGrid>
              </div>

              {/* Active Treatments */}
              <div>
                <Title order={2} size="h3" mb="md">
                  Active Treatments
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {treatmentModules.map((module, index) => (
                    <ModuleCard key={index} module={module} />
                  ))}
                </SimpleGrid>
              </div>

              {/* Health Monitoring */}
              <div>
                <Title order={2} size="h3" mb="md">
                  Health Monitoring
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                  {monitoringModules.map((module, index) => (
                    <ModuleCard key={index} module={module} />
                  ))}
                </SimpleGrid>
              </div>

              {/* Prevention & History */}
              <div>
                <Title order={2} size="h3" mb="md">
                  Prevention & History
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {preventionModules.map((module, index) => (
                    <ModuleCard key={index} module={module} />
                  ))}
                </SimpleGrid>
              </div>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {/* Recent Activity */}
              <RecentActivityList />

              {/* Additional Resources */}
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Title order={3} size="h4" mb="md">
                  Additional Resources
                </Title>
                <Stack gap="xs">
                  {additionalModules.map((module, index) => {
                    const Icon = module.icon;
                    return (
                      <Paper
                        key={index}
                        p="sm"
                        radius="md"
                        onClick={() => navigate(module.link)}
                        style={{ cursor: 'pointer' }}
                        withBorder
                        styles={{
                          root: {
                            '&:hover': {
                              backgroundColor: 'var(--mantine-color-gray-1)',
                              transform: 'translateX(4px)',
                              transition: 'all 0.2s ease',
                            },
                          },
                        }}
                      >
                        <Group gap="sm">
                          <ThemeIcon
                            color={module.color}
                            size="sm"
                            variant="light"
                          >
                            <Icon size={14} />
                          </ThemeIcon>
                          <Text size="sm" fw={500} style={{ flex: 1 }}>
                            {module.title}
                          </Text>
                          <IconChevronRight size={14} />
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onComplete={() => setShowProfileModal(false)}
      />
    </div>
  );
};

export default Dashboard;
