import logger from '../services/logger';

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
  useMantineColorScheme,
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
  IconUsers,
  IconShield,
} from '@tabler/icons-react';
import { PageHeader } from '../components';
import { PatientSelector } from '../components/medical';
import { GlobalSearch } from '../components/common';
import { InvitationNotifications } from '../components/dashboard';
import ResponsiveTest from '../components/ResponsiveTest';
import { apiService } from '../services/api';
import frontendLogger from '../services/frontendLogger';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentPatient, useCacheManager } from '../hooks/useGlobalData';
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
  const { colorScheme } = useMantineColorScheme();
  const {
    user: authUser,
    shouldShowProfilePrompts,
    checkIsFirstLogin,
  } = useAuth();

  // Using global state for patient data
  const { patient: user, loading: patientLoading } = useCurrentPatient();
  const {
    invalidatePatient,
    refreshPatient,
    invalidateAll,
    setCurrentPatient,
  } = useCacheManager();

  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentActivePatient, setCurrentActivePatient] = useState(null);
  const [patientSelectorLoading, setPatientSelectorLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [lastActivityUpdate, setLastActivityUpdate] = useState(null);
  const [showWelcomeBox, setShowWelcomeBox] = useState(() => {
    // Check if user has dismissed the welcome box for this user
    const dismissed = localStorage.getItem(
      `welcomeBox_dismissed_${authUser?.id || 'guest'}`
    );
    return dismissed !== 'true';
  });

  // Combine loading states - only show full loading screen during initial load
  const loading =
    (patientLoading || activityLoading || statsLoading) && !initialLoadComplete;

  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        fetchRecentActivity(),
        fetchDashboardStats(),
        checkAdminStatus(),
      ]);
      setInitialLoadComplete(true);
    };
    loadInitialData();
  }, []);

  // Initialize currentActivePatient when user loads
  useEffect(() => {
    if (user && !currentActivePatient) {
      setCurrentActivePatient(user);
    }
  }, [user, currentActivePatient]);

  // Refresh dashboard stats when active patient changes
  useEffect(() => {
    if (currentActivePatient?.id && initialLoadComplete) {
      fetchDashboardStats();
    }
  }, [currentActivePatient?.id, initialLoadComplete]);

  // Refresh recent activity when active patient changes
  useEffect(() => {
    if (currentActivePatient?.id && initialLoadComplete) {
      fetchRecentActivity();
    }
  }, [currentActivePatient?.id, initialLoadComplete]);

  // Auto-refresh recent activity every 30 seconds to catch new updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentActivity();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentActivePatient, user]);

  useEffect(() => {
    if (authUser && user) {
      // Reset welcome box for new user login (different user)
      const currentUserId = authUser.id;
      const dismissed = localStorage.getItem(
        `welcomeBox_dismissed_${currentUserId}`
      );
      setShowWelcomeBox(dismissed !== 'true');
    }
  }, [authUser, user]);

  const checkAdminStatus = async () => {
    try {
      // Use secure storage system instead of direct localStorage
      const { secureStorage, legacyMigration } = await import('../utils/secureStorage');
      await legacyMigration.migrateFromLocalStorage();
      const token = await secureStorage.getItem('token');
      
      logger.info('🔑 DASHBOARD_ADMIN_CHECK: Checking admin status', {
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : null,
        timestamp: new Date().toISOString()
      });
      
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role || '';
        const adminCheck =
          userRole.toLowerCase() === 'admin' ||
          userRole.toLowerCase() === 'administrator';
        
        logger.info('🔑 DASHBOARD_ADMIN_CHECK: Token payload analysis', {
          role: userRole,
          isAdmin: adminCheck,
          fullPayload: payload,
          timestamp: new Date().toISOString()
        });
        
        setIsAdmin(adminCheck);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      frontendLogger.logError('Error checking admin status', {
        error: error.message,
        component: 'Dashboard',
      });
      setIsAdmin(false);
    }
  };

  const handlePatientChange = async newPatient => {
    // Prevent infinite loops by checking if patient actually changed
    if (currentActivePatient?.id === newPatient?.id) {
      return;
    }

    frontendLogger.logInfo('Patient switched from dashboard', {
      component: 'Dashboard',
      newPatientId: newPatient?.id,
      patientName: newPatient
        ? `${newPatient.first_name} ${newPatient.last_name}`
        : null,
    });

    // Show loading state for patient selector during switch
    setPatientSelectorLoading(true);

    // Update local state
    setCurrentActivePatient(newPatient);

    // Invalidate all caches to force refresh of all medical data for new patient
    invalidateAll();
    refreshPatient();

    // Dashboard data will be refreshed automatically by useEffect when currentActivePatient changes

    // Hide loading state
    setPatientSelectorLoading(false);
  };

  const fetchRecentActivity = async (patientId = null) => {
    try {
      setActivityLoading(true);
      const targetPatientId = patientId || currentActivePatient?.id || user?.id;
      const activity = await apiService.getRecentActivity(targetPatientId);
      
      // Filter out erroneous "deleted" patient information activities
      // This is a temporary fix for a backend issue where patient updates are logged as deletions
      const filteredActivity = activity.filter(item => {
        const isPatientModel = item.model_name
          ?.toLowerCase()
          .includes('patient');
        const isDeletedAction = item.action?.toLowerCase() === 'deleted';

        // Exclude deleted patient information activities (backend logging error)
        if (isPatientModel && isDeletedAction) {
          return false;
        }

        return true;
      });

      setRecentActivity(filteredActivity);
      setLastActivityUpdate(new Date());
    } catch (error) {
      frontendLogger.logError('Error fetching activity', {
        error: error.message,
        component: 'Dashboard',
      });
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const patientId = currentActivePatient?.id;
      const stats = await apiService.getDashboardStats(patientId);
      setDashboardStats(stats);
    } catch (error) {
      frontendLogger.logError('Error fetching dashboard stats', {
        error: error.message,
        component: 'Dashboard',
        patientId: currentActivePatient?.id,
      });
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
    {
      title: 'Family History',
      icon: IconUsers,
      color: 'grape',
      link: '/family-history',
    },
  ];

  // Additional resources
  const additionalModules = [
    {
      title: 'Insurance',
      icon: IconShield,
      color: 'violet',
      link: '/insurance',
    },
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

    const handleClick = (e) => {
      logger.info('ModuleCard clicked:', module.link);
      try {
        navigate(module.link);
      } catch (error) {
        logger.error('Navigation error:', error);
        frontendLogger.logError('Navigation error from ModuleCard', {
          error: error.message,
          component: 'Dashboard',
          link: module.link,
        });
      }
    };

    return (
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        onClick={handleClick}
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

    const handleClick = e => {
      if (isClickable && navigationUrl) {
        navigate(navigationUrl);
        frontendLogger.logInfo('Activity item clicked', {
          component: 'Dashboard',
          activity_id: activity.id,
          model_name: activity.model_name,
          action: activity.action,
          navigation_url: navigationUrl,
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
          }}
          styles={(theme) => ({
            root: {
              backgroundColor: colorScheme === 'dark' 
                ? theme.colors.dark[7] 
                : theme.white,
              ...(isClickable
                ? {
                    '&:hover': {
                      backgroundColor: colorScheme === 'dark' 
                        ? theme.colors.dark[6] 
                        : theme.colors.gray[1],
                      transform: 'translateX(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    },
                  }
                : {}),
            },
          })}
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
              {ActivityIcon ? (
                <ActivityIcon size={14} />
              ) : (
                <IconAlertCircle size={14} />
              )}
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
                  <IconChevronRight
                    size={12}
                    style={{ color: 'var(--mantine-color-dimmed)' }}
                  />
                )}
              </Group>

              <Text
                size="sm"
                fw={500}
                lineClamp={2}
                style={{ wordBreak: 'break-word' }}
              >
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
      <Group justify="space-between" mb="md">
        <Title order={3} size="h4">
          Recent Activity
        </Title>
      </Group>

      {lastActivityUpdate && (
        <Text size="xs" c="dimmed" mb="sm">
          Last updated: {lastActivityUpdate.toLocaleTimeString()}
        </Text>
      )}

      {recentActivity.length > 0 ? (
        <Stack gap="xs">
          {recentActivity.slice(0, 4).map((activity, index) => (
            <ActivityItem
              key={`activity-${index}-${activity.id || 'no-id'}-${activity.timestamp || `index-${index}`}`}
              activity={activity}
              index={index}
            />
          ))}
        </Stack>
      ) : (
        <Paper p="md" radius="md" 
          styles={(theme) => ({
            root: {
              backgroundColor: colorScheme === 'dark' 
                ? theme.colors.dark[6] 
                : theme.colors.gray[1],
            },
          })}>
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
    <>
    <Container size="xl" py="md">
      <PageHeader
        title="Medical Records App"
        icon="🏥"
        variant="dashboard"
        showBackButton={false}
      />

      <Stack gap="lg">
        {/* Responsive Test Component (Temporary for PR #1) - Temporarily disabled */}
        {/* <ResponsiveTest /> */}
        
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
              {authUser && (
                <Badge color="rgba(255,255,255,0.2)" variant="filled" size="lg">
                  Hello, {authUser.fullName || authUser.full_name || authUser.username}!
                </Badge>
              )}
            </Group>
          </Paper>
        )}

        {/* Patient Selector and Search Bar - Responsive Layout */}
        <Stack gap="md" mb="xl">
          <Flex
            justify="space-between"
            align="flex-start"
            gap="md"
            direction={{ base: 'column', sm: 'column', md: 'row', lg: 'row' }}
            wrap="wrap"
            style={{ width: '100%' }}
          >
            {/* Patient Selector */}
            <Box style={{ 
              flex: '1 1 auto', 
              maxWidth: '500px',
              minWidth: '200px'
            }}>
              <PatientSelector
                onPatientChange={handlePatientChange}
                currentPatientId={currentActivePatient?.id || user?.id}
                loading={patientSelectorLoading}
                compact={true}
              />
            </Box>

            {/* Search Bar */}
            <Box
              style={{
                flexShrink: 1,
                flex: '0 1 250px',
                maxWidth: '250px',
                minWidth: '150px',
              }}
            >
              <GlobalSearch
                patientId={currentActivePatient?.id}
                placeholder="Search medical records..."
                width="100%"
              />
            </Box>
          </Flex>
        </Stack>

        {/* Main Content Grid */}
        <Grid mb="xl">
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

              {/* Treatments and Procedures */}
              <div>
                <Title order={2} size="h3" mb="md">
                  Treatments and Procedures
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
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  {preventionModules.map((module, index) => (
                    <ModuleCard key={index} module={module} />
                  ))}
                </SimpleGrid>
              </div>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
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
                        onClick={(e) => {
                          logger.info('Additional resource clicked:', module.link);
                          try {
                            navigate(module.link);
                          } catch (error) {
                            logger.error('Navigation error:', error);
                            frontendLogger.logError('Navigation error from additional resource', {
                              error: error.message,
                              component: 'Dashboard',
                              link: module.link,
                            });
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                        withBorder
                        styles={(theme) => ({
                          root: {
                            '&:hover': {
                              backgroundColor: colorScheme === 'dark' 
                                ? theme.colors.dark[6] 
                                : theme.colors.gray[1],
                              transform: 'translateX(4px)',
                              transition: 'all 0.2s ease',
                            },
                          },
                        })}
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
              {/* Invitation Notifications */}
              <InvitationNotifications />

              {/* Recent Activity */}
              <RecentActivityList />

            </Stack>
          </Grid.Col>
        </Grid>

        {/* Stats Row */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {dashboardStatsCards.map((stat, index) => (
            <StatCard key={index} stat={stat} />
          ))}
        </SimpleGrid>
      </Stack>
      </Container>
    </>
  );
};

export default Dashboard;
