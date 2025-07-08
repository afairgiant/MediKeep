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
  Tooltip,
  HoverCard,
  Select,
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
  IconX,
  IconPhoneCall,
} from '@tabler/icons-react';
import ProfileCompletionModal from '../components/auth/ProfileCompletionModal';
import { PageHeader } from '../components';
import { apiService } from '../services/api';
import frontendLogger from '../services/frontendLogger';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentPatient } from '../hooks/useGlobalData';
import { formatDateTime } from '../utils/helpers';
import {
  getActivityNavigationUrl,
  getActivityIcon,
  getActionBadgeColor,
  getActionIcon,
  formatActivityDescription,
  isActivityClickable,
  getActivityTooltip,
} from '../utils/activityNavigation';

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
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWelcomeBox, setShowWelcomeBox] = useState(() => {
    // Check if user has dismissed the welcome box for this user
    const dismissed = localStorage.getItem(
      `welcomeBox_dismissed_${authUser?.id || 'guest'}`
    );
    return dismissed !== 'true';
  });

  // Combine loading states
  const loading = patientLoading || activityLoading || statsLoading;

  useEffect(() => {
    fetchRecentActivity();
    fetchDashboardStats();
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (authUser && user) {
      checkProfileCompletionModal();
      // Reset welcome box for new user login (different user)
      const currentUserId = authUser.id;
      const dismissed = localStorage.getItem(
        `welcomeBox_dismissed_${currentUserId}`
      );
      setShowWelcomeBox(dismissed !== 'true');
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
      frontendLogger.logError('Error checking admin status', { error: error.message, component: 'Dashboard' });
      setIsAdmin(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      setActivityLoading(true);
      const activity = await apiService.getRecentActivity();
      setRecentActivity(activity);
    } catch (error) {
      frontendLogger.logError('Error fetching activity', { error: error.message, component: 'Dashboard' });
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const stats = await apiService.getDashboardStats();
      setDashboardStats(stats);
    } catch (error) {
      frontendLogger.logError('Error fetching dashboard stats', { error: error.message, component: 'Dashboard' });
      // Set fallback stats on error
      setDashboardStats({
        total_records: 0,
        active_medications: 0,
        total_lab_results: 0,
        total_procedures: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };


  // Dashboard stats data - using real data from API
  const dashboardStatsCards = dashboardStats
    ? [
        {
          label: 'Total Records',
          value: dashboardStats.total_records?.toString() || '0',
          color: 'blue',
        },
        {
          label: 'Active Medications',
          value: dashboardStats.active_medications?.toString() || '0',
          color: 'green',
        },
        {
          label: 'Lab Results',
          value: dashboardStats.total_lab_results?.toString() || '0',
          color: 'orange',
        },
        {
          label: 'Procedures',
          value: dashboardStats.total_procedures?.toString() || '0',
          color: 'purple',
        },
      ]
    : [
        { label: 'Total Records', value: '0', color: 'blue' },
        { label: 'Active Medications', value: '0', color: 'green' },
        { label: 'Lab Results', value: '0', color: 'orange' },
        { label: 'Procedures', value: '0', color: 'purple' },
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
      title: 'Emergency Contacts',
      icon: IconPhoneCall,
      color: 'red',
      link: '/emergency-contacts',
    },
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

  const ActivityItem = ({ activity, index }) => {
    const isClickable = isActivityClickable(activity);
    const navigationUrl = getActivityNavigationUrl(activity);
    const ActivityIcon = getActivityIcon(activity.model_name);
    const ActionIcon = getActionIcon(activity.action);
    const actionColor = getActionBadgeColor(activity.action);
    const tooltip = getActivityTooltip(activity);
    const formattedDescription = formatActivityDescription(activity);

    const handleClick = (e) => {
      if (isClickable && navigationUrl) {
        navigate(navigationUrl);
        frontendLogger.logInfo('Activity item clicked', { 
          component: 'Dashboard', 
          activity_id: activity.id,
          model_name: activity.model_name,
          action: activity.action,
          navigation_url: navigationUrl
        });
      }
    };

    return (
      <Tooltip label={tooltip} position="left" disabled={!tooltip}>
        <Paper
          p="sm"
          radius="md"
          withBorder
          style={{
            cursor: isClickable ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
            backgroundColor: isClickable ? 'transparent' : 'var(--mantine-color-gray-0)',
          }}
          styles={{
            root: isClickable ? {
              '&:hover': {
                backgroundColor: 'var(--mantine-color-gray-1)',
                transform: 'translateX(4px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              },
            } : {},
          }}
          onClick={handleClick}
        >
          <Group align="flex-start" gap="sm" wrap="nowrap">
            {/* Activity Type Icon */}
            <ThemeIcon
              color={ActivityIcon ? 'blue' : 'gray'}
              variant="light"
              size="sm"
              radius="md"
              mt={2}
              style={{ flexShrink: 0 }}
            >
              {ActivityIcon ? <ActivityIcon size={14} /> : <IconAlertCircle size={14} />}
            </ThemeIcon>

            {/* Content */}
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs" align="center" wrap="nowrap">
                {/* Action Badge */}
                <Badge
                  color={actionColor}
                  variant="light"
                  size="xs"
                  radius="sm"
                  leftSection={ActionIcon && <ActionIcon size={10} />}
                >
                  {activity.action}
                </Badge>
                
                {/* Clickable indicator */}
                {isClickable && (
                  <IconChevronRight size={12} color="var(--mantine-color-dimmed)" />
                )}
              </Group>

              <Text size="sm" fw={500} lineClamp={2} style={{ wordBreak: 'break-word' }}>
                {formattedDescription}
              </Text>
              
              <Text size="xs" c="dimmed">
                {formatDateTime(activity.timestamp)}
              </Text>
            </Stack>
          </Group>
        </Paper>
      </Tooltip>
    );
  };

  const RecentActivityList = () => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={3} size="h4" mb="md">
        Recent Activity
      </Title>

      {recentActivity.length > 0 ? (
        <Stack gap="xs">
          {recentActivity.slice(0, 4).map((activity, index) => (
            <ActivityItem key={`activity-${index}-${activity.id || 'no-id'}-${activity.timestamp || Date.now()}`} activity={activity} index={index} />
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
            <Text size="xs" c="dimmed" ta="center">
              Your medical record activities will appear here
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
        title="Medical Records App"
        icon="🏥"
        variant="dashboard"
        showBackButton={false}
      />

      <Container size="xl" py="xl">
        {/* Welcome Section */}
        {showWelcomeBox && (
          <Paper
            p="md"
            radius="md"
            mb="xl"
            bg="var(--mantine-primary-color-filled)"
            c="white"
            pos="relative"
          >
            <ActionIcon
              variant="subtle"
              color="rgba(255,255,255,0.7)"
              size="sm"
              pos="absolute"
              top={8}
              right={8}
              onClick={() => {
                setShowWelcomeBox(false);
                // Persist the dismissal for this user
                if (authUser?.id) {
                  localStorage.setItem(
                    `welcomeBox_dismissed_${authUser.id}`,
                    'true'
                  );
                }
              }}
              title="Close welcome message"
              style={{
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <IconX size={14} />
            </ActionIcon>

            <Group justify="space-between" align="center" pr="xl">
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
        )}

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
          {dashboardStatsCards.map((stat, index) => (
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
