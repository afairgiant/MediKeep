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

  // Medical modules configuration - organized by user-centric categories
  const medicalModules = {
    // Core medical information - most users need these
    core: [
      {
        title: 'Patient Information',
        description: 'View and update your personal details',
        icon: IconStethoscope,
        color: 'blue',
        link: '/patients/me',
      },
      {
        title: 'Medications',
        description: 'Track your current medications',
        icon: IconPill,
        color: 'green',
        link: '/medications',
      },
      {
        title: 'Lab Results',
        description: 'Access your laboratory test results',
        icon: IconFlask,
        color: 'teal',
        link: '/lab-results',
      },
    ],

    // Treatment & medications - for active treatment
    treatment: [
      {
        title: 'Treatments',
        description: 'Review your treatments',
        icon: IconClipboardList,
        color: 'cyan',
        link: '/treatments',
      },
      {
        title: 'Procedures',
        description: 'Review your medical procedures',
        icon: IconMedicalCross,
        color: 'indigo',
        link: '/procedures',
      },
    ],

    // Health monitoring - for ongoing health tracking
    monitoring: [
      {
        title: 'Vital Signs',
        description: 'Record and view your vital signs',
        icon: IconHeartbeat,
        color: 'red',
        link: '/vitals',
      },
      {
        title: 'Conditions',
        description: 'Review your medical conditions',
        icon: IconBrain,
        color: 'pink',
        link: '/conditions',
      },
      {
        title: 'Allergies',
        description: 'Review your allergies',
        icon: IconAlertTriangle,
        color: 'orange',
        link: '/allergies',
      },
    ],

    // Prevention & history - for preventive care and records
    prevention: [
      {
        title: 'Immunizations',
        description: 'Check your immunization records',
        icon: IconVaccine,
        color: 'purple',
        link: '/immunizations',
      },
      {
        title: 'Visit History',
        description: 'Review your medical visits',
        icon: IconCalendarEvent,
        color: 'yellow',
        link: '/visits',
      },
    ],
  };

  // Secondary modules
  const secondaryModules = [
    {
      title: 'Export Records',
      description: 'Download your medical data',
      icon: IconFileExport,
      color: 'violet',
      link: '/export',
    },
    {
      title: 'Practitioners',
      description: 'View practitioner information',
      icon: IconUser,
      color: 'blue',
      link: '/practitioners',
    },
    {
      title: 'Pharmacies',
      description: 'View pharmacy information',
      icon: IconBuilding,
      color: 'green',
      link: '/pharmacies',
    },
  ];

  // Add admin dashboard if user is admin
  if (isAdmin) {
    secondaryModules.unshift({
      title: 'Admin Dashboard',
      description: 'System administration and management',
      icon: IconSettings,
      color: 'dark',
      link: '/admin',
    });
  }

  // Category descriptions for better UX
  const categoryInfo = {
    core: {
      title: 'Core Medical Information',
      description: 'Essential records everyone needs',
      badge: 'Essential',
      badgeColor: 'blue',
    },
    treatment: {
      title: 'Active Treatments',
      description: 'Medical treatments and procedures',
      badge: 'Active Care',
      badgeColor: 'green',
    },
    monitoring: {
      title: 'Health Monitoring',
      description: 'Track ongoing health conditions and metrics',
      badge: 'Monitoring',
      badgeColor: 'orange',
    },
    prevention: {
      title: 'Prevention & History',
      description: 'Preventive care and historical records',
      badge: 'Prevention',
      badgeColor: 'purple',
    },
  };

  const MedicalModuleCard = ({ module, size = 'normal' }) => {
    const Icon = module.icon;

    return (
      <Card
        shadow="sm"
        padding={size === 'large' ? 'xl' : 'md'}
        radius="md"
        withBorder
        onClick={() => navigate(module.link)}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          height: size === 'large' ? '140px' : '120px',
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
        <Group justify="space-between" mb="xs">
          <ThemeIcon
            color={module.color}
            size={size === 'large' ? 40 : 32}
            radius="md"
            variant="light"
          >
            <Icon size={size === 'large' ? 24 : 18} />
          </ThemeIcon>
          <ActionIcon variant="subtle" color="gray" size="sm">
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>

        <Text size={size === 'large' ? 'lg' : 'md'} fw={600} mb={4}>
          {module.title}
        </Text>

        <Text size={size === 'large' ? 'sm' : 'xs'} c="dimmed" lineClamp={2}>
          {module.description}
        </Text>

        {module.priority === 'high' && size === 'large' && (
          <Badge color={module.color} variant="light" size="xs" mt="xs">
            Essential
          </Badge>
        )}
      </Card>
    );
  };

  const RecentActivityTimeline = () => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3} size="h4">
          Recent Medical Activity
        </Title>
        <Badge color="blue" variant="light">
          {recentActivity.length} items
        </Badge>
      </Group>

      {recentActivity.length > 0 ? (
        <Timeline active={recentActivity.length} bulletSize={20} lineWidth={2}>
          {recentActivity.slice(0, 5).map((activity, index) => (
            <Timeline.Item
              key={index}
              bullet={<IconInfoCircle size={12} />}
              title={
                <Text size="sm" fw={500}>
                  {activity.description}
                </Text>
              }
            >
              <Text size="xs" c="dimmed">
                {formatDateTime(activity.timestamp)}
              </Text>
            </Timeline.Item>
          ))}
        </Timeline>
      ) : (
        <Paper p="md" radius="md" bg="gray.1">
          <Group justify="center">
            <ThemeIcon color="gray" variant="light" size="lg">
              <IconAlertCircle size={20} />
            </ThemeIcon>
            <Stack gap={4} align="center">
              <Text size="sm" fw={500} c="dimmed">
                No recent medical activity
              </Text>
              <Text size="xs" c="dimmed">
                Start by adding medications, lab results, or other medical
                information
              </Text>
            </Stack>
          </Group>
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

        {/* Essential Medical Modules */}
        <Stack gap="xl">
          <div>
            <Group justify="space-between" align="center" mb="md">
              <div>
                <Title order={2} size="h3">
                  {categoryInfo.core.title}
                </Title>
                <Text size="sm" c="dimmed">
                  {categoryInfo.core.description}
                </Text>
              </div>
              <Badge color={categoryInfo.core.badgeColor} variant="light">
                {categoryInfo.core.badge}
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {medicalModules.core.map((module, index) => (
                <MedicalModuleCard key={index} module={module} size="large" />
              ))}
            </SimpleGrid>
          </div>

          {/* Main Content Grid */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              {/* Treatment & Medications */}
              <Stack gap="xl">
                <div>
                  <Group justify="space-between" align="center" mb="md">
                    <div>
                      <Title order={2} size="h3">
                        {categoryInfo.treatment.title}
                      </Title>
                      <Text size="sm" c="dimmed">
                        {categoryInfo.treatment.description}
                      </Text>
                    </div>
                    <Badge
                      color={categoryInfo.treatment.badgeColor}
                      variant="light"
                    >
                      {categoryInfo.treatment.badge}
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {medicalModules.treatment.map((module, index) => (
                      <MedicalModuleCard key={index} module={module} />
                    ))}
                  </SimpleGrid>
                </div>

                <div>
                  <Group justify="space-between" align="center" mb="md">
                    <div>
                      <Title order={2} size="h3">
                        {categoryInfo.monitoring.title}
                      </Title>
                      <Text size="sm" c="dimmed">
                        {categoryInfo.monitoring.description}
                      </Text>
                    </div>
                    <Badge
                      color={categoryInfo.monitoring.badgeColor}
                      variant="light"
                    >
                      {categoryInfo.monitoring.badge}
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    {medicalModules.monitoring.map((module, index) => (
                      <MedicalModuleCard key={index} module={module} />
                    ))}
                  </SimpleGrid>
                </div>

                <div>
                  <Group justify="space-between" align="center" mb="md">
                    <div>
                      <Title order={2} size="h3">
                        {categoryInfo.prevention.title}
                      </Title>
                      <Text size="sm" c="dimmed">
                        {categoryInfo.prevention.description}
                      </Text>
                    </div>
                    <Badge
                      color={categoryInfo.prevention.badgeColor}
                      variant="light"
                    >
                      {categoryInfo.prevention.badge}
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    {medicalModules.prevention.map((module, index) => (
                      <MedicalModuleCard key={index} module={module} />
                    ))}
                  </SimpleGrid>
                </div>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                {/* Recent Activity */}
                <RecentActivityTimeline />

                {/* Additional Resources */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Title order={3} size="h4" mb="md">
                    Additional Resources
                  </Title>
                  <Stack gap="xs">
                    {secondaryModules.map((module, index) => {
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
                                backgroundColor:
                                  'var(--mantine-color-gray-light-hover)',
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
                            <div style={{ flex: 1 }}>
                              <Text size="sm" fw={500}>
                                {module.title}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {module.description}
                              </Text>
                            </div>
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
        </Stack>

        {/* Footer */}
        <Paper p="md" radius="md" mt="xl" bg="gray" c="white" ta="center">
          <Text size="sm">
            &copy; 2025 Medical Records System. All rights reserved.
          </Text>
        </Paper>
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
