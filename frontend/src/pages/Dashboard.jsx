import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Paper,
  SimpleGrid,
  ThemeIcon,
  Progress,
  Box,
  Flex,
  Tooltip,
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
  IconX,
  IconPhoneCall,
  IconUsers,
  IconShield,
  IconBandage,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import { PageHeader } from '../components';
import { PatientSelector } from '../components/medical';
import { GlobalSearch } from '../components/common';
import { InvitationNotifications } from '../components/dashboard';
import { apiService } from '../services/api';
import frontendLogger from '../services/frontendLogger';
import logger from '../services/logger';
import { timezoneService } from '../services/timezoneService';
import { useAuth } from '../contexts/AuthContext';
import { useViewport } from '../hooks/useViewport';
import { useCurrentPatient, useCacheManager } from '../hooks/useGlobalData';
import { useDateFormat } from '../hooks/useDateFormat';
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
  const { t } = useTranslation(['navigation', 'common', 'shared']);
  const { formatDateTime } = useDateFormat();
  const { colorScheme } = useMantineColorScheme();
  const { isMobile } = useViewport();
  const {
    user: authUser,
    shouldShowProfilePrompts,
    checkIsFirstLogin,
  } = useAuth();

  // Using global state for patient data
  const { patient: currentPatient, loading: patientLoading } = useCurrentPatient();
  const {
    refreshPatient,
    invalidateAll,
    setCurrentPatient,
  } = useCacheManager();

  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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

  // Note: currentPatient is now managed by useCurrentPatient hook
  // No need for local state management

  // Refresh dashboard stats when active patient changes
  useEffect(() => {
    if (currentPatient?.id && initialLoadComplete) {
      fetchDashboardStats();
    }
  }, [currentPatient?.id, initialLoadComplete]);

  // Refresh recent activity when active patient changes
  useEffect(() => {
    if (currentPatient?.id && initialLoadComplete) {
      fetchRecentActivity();
    }
  }, [currentPatient?.id, initialLoadComplete]);

  // Auto-refresh recent activity every 30 seconds to catch new updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentActivity();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentPatient]);

  useEffect(() => {
    if (authUser && currentPatient) {
      // Reset welcome box for new user login (different user)
      const currentUserId = authUser.id;
      const dismissed = localStorage.getItem(
        `welcomeBox_dismissed_${currentUserId}`
      );
      setShowWelcomeBox(dismissed !== 'true');
    }
  }, [authUser, currentPatient]);

  const checkAdminStatus = async () => {
    try {
      // Use secure storage system instead of direct localStorage
      const { secureStorage, legacyMigration } = await import(
        '../utils/secureStorage'
      );
      await legacyMigration.migrateFromLocalStorage();
      const token = await secureStorage.getItem('token');

      logger.info('🔑 DASHBOARD_ADMIN_CHECK: Checking admin status', {
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : null,
        timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
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
    if (currentPatient?.id === newPatient?.id) {
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
    setCurrentPatient(newPatient);

    // Invalidate all caches to force refresh of all medical data for new patient
    invalidateAll();
    refreshPatient();

    // Dashboard data will be refreshed automatically by useEffect when currentPatient changes

    // Hide loading state
    setPatientSelectorLoading(false);
  };

  const fetchRecentActivity = async (patientId = null) => {
    try {
      setActivityLoading(true);
      const targetPatientId = patientId || currentPatient?.id;
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
      const patientId = currentPatient?.id;
      const stats = await apiService.getDashboardStats(patientId);
      setDashboardStats(stats);
    } catch (error) {
      frontendLogger.logError('Error fetching dashboard stats', {
        error: error.message,
        component: 'Dashboard',
        patientId: currentPatient?.id,
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
  const dashboardStatsCards = [
    {
      label: t('dashboard.stats.totalRecords', 'Total Records'),
      value: dashboardStats?.total_records?.toString() || '0',
      color: 'blue',
    },
    {
      label: t('dashboard.stats.activeMedications', 'Active Medications'),
      value: dashboardStats?.active_medications?.toString() || '0',
      color: 'green',
    },
    {
      label: t('shared:categories.lab_results', 'Lab Results'),
      value: dashboardStats?.total_lab_results?.toString() || '0',
      color: 'orange',
    },
    {
      label: t('shared:categories.procedures', 'Procedures'),
      value: dashboardStats?.total_procedures?.toString() || '0',
      color: 'violet',
    },
  ];

  // Core medical modules - organized in 2x2 grid sections like the schematic
  const coreModules = [
    {
      title: t('dashboard.modules.patientInfo', 'Patient Information'),
      icon: IconUser,
      color: 'blue',
      link: '/patients/me',
    },
    {
      title: t('shared:categories.medications', 'Medications'),
      icon: IconPill,
      color: 'green',
      link: '/medications',
    },
    {
      title: t('shared:categories.lab_results', 'Lab Results'),
      icon: IconFlask,
      color: 'teal',
      link: '/lab-results',
    },
  ];

  const treatmentModules = [
    {
      title: t('shared:categories.treatments', 'Treatments'),
      icon: IconClipboardList,
      color: 'cyan',
      link: '/treatments',
    },
    {
      title: t('shared:categories.procedures', 'Procedures'),
      icon: IconMedicalCross,
      color: 'indigo',
      link: '/procedures',
    },
  ];

  const monitoringModules = [
    {
      title: t('shared:categories.vital_signs', 'Vital Signs'),
      icon: IconHeartbeat,
      color: 'red',
      link: '/vitals',
    },
    {
      title: t('shared:categories.symptoms', 'Symptoms'),
      icon: IconStethoscope,
      color: 'blue',
      link: '/symptoms',
    },
    {
      title: t('shared:categories.conditions', 'Conditions'),
      icon: IconBrain,
      color: 'pink',
      link: '/conditions',
    },
    {
      title: t('shared:categories.allergies', 'Allergies'),
      icon: IconAlertTriangle,
      color: 'orange',
      link: '/allergies',
    },
    {
      title: t('shared:categories.injuries', 'Injuries'),
      icon: IconBandage,
      color: 'red',
      link: '/injuries',
    },
  ];

  const preventionModules = [
    {
      title: t('shared:categories.immunizations', 'Immunizations'),
      icon: IconVaccine,
      color: 'violet',
      link: '/immunizations',
    },
    {
      title: t('dashboard.modules.visitHistory', 'Visit History'),
      icon: IconCalendarEvent,
      color: 'yellow',
      link: '/visits',
    },
    {
      title: t('shared:categories.family_history', 'Family History'),
      icon: IconUsers,
      color: 'grape',
      link: '/family-history',
    },
  ];

  // Additional resources
  const additionalModules = [
    {
      title: t('shared:categories.insurance', 'Insurance'),
      icon: IconShield,
      color: 'violet',
      link: '/insurance',
    },
    {
      title: t('shared:categories.emergency_contacts', 'Emergency Contacts'),
      icon: IconPhoneCall,
      color: 'red',
      link: '/emergency-contacts',
    },
    {
      title: t('dashboard.modules.exportRecords', 'Export Records'),
      icon: IconFileExport,
      color: 'violet',
      link: '/export',
    },
    {
      title: t('shared:categories.practitioners', 'Practitioners'),
      icon: IconUser,
      color: 'blue',
      link: '/practitioners',
    },
    {
      title: t('shared:categories.pharmacies', 'Pharmacies'),
      icon: IconBuilding,
      color: 'green',
      link: '/pharmacies',
    },
    {
      title: t('shared:categories.medical_equipment', 'Medical Equipment'),
      icon: IconDeviceDesktop,
      color: 'orange',
      link: '/medical-equipment',
    },
  ];

  // Add admin dashboard if user is admin
  if (isAdmin) {
    additionalModules.unshift({
      title: t('dashboard.modules.adminDashboard', 'Admin Dashboard'),
      icon: IconSettings,
      color: 'indigo',
      link: '/admin',
    });
  }

  const StatsRow = (props) => (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={12} {...props}>
      {dashboardStatsCards.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </SimpleGrid>
  );

  const StatCard = ({ stat }) => (
    <Paper
      className={`dashboard-stat-card ${stat.color}`}
      withBorder
      radius="md"
      p="md"
      h={90}
    >
      <Stack align="center" justify="center" h="100%">
        <Text size={isMobile ? '18px' : '22px'} fw={700} c={colorScheme === 'dark' ? `${stat.color}.3` : stat.color}>
          {stat.value}
        </Text>
        <Text size="12px" c="dimmed" ta="center">
          {stat.label}
        </Text>
      </Stack>
    </Paper>
  );

  const ModuleCard = ({ module }) => {
    const Icon = module.icon;

    const handleClick = e => {
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
      <Paper
        className={`dashboard-module-card ${module.color}`}
        withBorder
        radius="md"
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e);
          }
        }}
      >
        <Flex direction="column" justify="center" align="center" h="100%">
          <Box
            className="icon-circle"
            mb="xs"
            style={{ background: `var(--mantine-color-${module.color}-light)` }}
          >
            <Icon size={20} color={`var(--mantine-color-${module.color}-filled)`} />
          </Box>
          <Text size="13px" fw={600} ta="center">
            {module.title}
          </Text>
        </Flex>
      </Paper>
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
    const actionDisplayName = t(`activity.actions.${activity.action?.toLowerCase()}`, activity.action);

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
          className={isClickable ? 'dashboard-activity-item' : undefined}
          p={isMobile ? '8px 10px' : '10px 12px'}
          radius="sm"
          withBorder
          style={{
            cursor: isClickable ? 'pointer' : 'default',
          }}
          styles={theme => ({
            root: {
              backgroundColor:
                colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
              ...(isClickable
                ? {
                    '&:hover': {
                      backgroundColor:
                        colorScheme === 'dark'
                          ? theme.colors.dark[6]
                          : theme.colors.gray[1],
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
              size={22}
              radius={4}
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
                  {actionDisplayName}
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
    <Card shadow="sm" padding={16} radius="md" withBorder>
      <Group justify="space-between" mb={12}>
        <Text size="15px" fw={600}>
          {t('dashboard.sections.recentActivity', 'Recent Activity')}
        </Text>
      </Group>

      {lastActivityUpdate && (

        <Text size="11px" c="dimmed" mb={10}>
          {t('dashboard.activity.lastUpdated', 'Last updated')}: {lastActivityUpdate.toLocaleTimeString([], { timeZone: timezoneService.getTimezone() })}

        </Text>
      )}

      {recentActivity.length > 0 ? (
        <Stack gap={8}>
          {recentActivity.slice(0, 4).map((activity, index) => (
            <ActivityItem
              key={`activity-${index}-${activity.id || 'no-id'}-${activity.timestamp || `index-${index}`}`}
              activity={activity}
              index={index}
            />
          ))}
        </Stack>
      ) : (
        <Paper
          p="md"
          radius="md"
          styles={theme => ({
            root: {
              backgroundColor:
                colorScheme === 'dark'
                  ? theme.colors.dark[6]
                  : theme.colors.gray[1],
            },
          })}
        >
          <Stack align="center" gap="xs">
            <ThemeIcon color="gray" variant="light" size="lg">
              <IconAlertCircle size={20} />
            </ThemeIcon>
            <Text size="sm" fw={500} c="dimmed" ta="center">
              {t('dashboard.activity.noActivity', 'No recent activity')}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              {t('dashboard.activity.noActivityDescription', 'Your medical record activities will appear here')}
            </Text>
          </Stack>
        </Paper>
      )}
    </Card>
  );

  if (loading) {
    return (
      <Container size={1400} py="xl">
        <Stack align="center" justify="center" style={{ minHeight: '60vh' }}>
          <Progress
            value={75}
            size="lg"
            radius="xl"
            w="100%"
            maw={400}
            animate
          />
          <Text c="dimmed">{t('dashboard.loading', 'Loading your medical dashboard...')}</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size={1400} py="md" px={{ base: 12, sm: 16, md: 'md' }}>
        <PageHeader
          title="MediKeep"
          icon={<img src="/medikeep-icon.svg" alt="" width={36} height={36} style={{ verticalAlign: 'middle' }} />}
          variant="dashboard"
          showBackButton={false}
        />

        <Stack gap={{ base: 16, md: 20 }} mt={{ base: 12, md: 20 }}>
          {/* Welcome Section */}
          {showWelcomeBox && (
            <Paper
              p="14px 20px"
              radius="md"
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
                  zIndex: 1,
                }}
              >
                <IconX size={14} />
              </ActionIcon>

              <Flex
                justify="space-between"
                align="center"
                pr={{ base: 32, sm: 'xl' }}
                direction={{ base: 'column', sm: 'row' }}
                gap={{ base: 8, sm: 'xs' }}
                wrap="wrap"
              >
                <div>
                  <Title order={2} size="18px" fw={600} mb={4}>
                    {t('dashboard.title', 'MediKeep Dashboard')}
                  </Title>
                  <Text size="13px" opacity={0.9}>
                    {t('dashboard.subtitle', 'Manage your health information securely')}
                  </Text>
                </div>
                {authUser && (
                  <Badge
                    bg="rgba(255,255,255,0.2)"
                    variant="filled"
                    size="lg"
                    radius="xl"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {t('dashboard.hello', 'Hello')},{' '}
                    {authUser.fullName ||
                      authUser.full_name ||
                      authUser.username}
                    !
                  </Badge>
                )}
              </Flex>
            </Paper>
          )}

          {/* Patient Selector and Search Bar - Responsive Layout */}
          <Flex
            justify="space-between"
            align="flex-end"
            gap="md"
            direction={{ base: 'column', sm: 'row' }}
            wrap="wrap"
            style={{ width: '100%' }}
          >
            {/* Patient Selector */}
            <Box
              style={{
                flex: '1 1 auto',
                maxWidth: isMobile ? '100%' : '500px',
                minWidth: '200px',
                width: '100%',
              }}
            >
              <PatientSelector
                onPatientChange={handlePatientChange}
                currentPatientId={currentPatient?.id}
                loading={patientSelectorLoading}
                compact={true}
              />
            </Box>

            {/* Search Bar + Advanced Search link */}
            <Group gap="xs" align="flex-end" style={{ width: '100%', maxWidth: isMobile ? '100%' : 350 }}>
              <Box style={{ flex: 1, minWidth: 120 }}>
                <GlobalSearch
                  patientId={currentPatient?.id}
                  placeholder={t('dashboard.search.placeholder', 'Search medical records...')}
                  width="100%"
                />
              </Box>
              <Text
                size="xs"
                c="dimmed"
                td="underline"
                mb={6}
                style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => navigate('/search')}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/search');
                  }
                }}
              >
                {t('dashboard.search.advancedSearch', 'Advanced Search')}
              </Text>
            </Group>
          </Flex>

          {/* Main Content Grid */}
          <Grid mb={24}>
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <Stack gap={{ base: 16, md: 24 }}>
                {/* Core Medical Information */}
                <div>
                  <Text size="16px" fw={600} mb={12}>
                    {t('dashboard.sections.coreMedical', 'Core Medical Information')}
                  </Text>
                  <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={12}>
                    {coreModules.map((module, index) => (
                      <ModuleCard key={index} module={module} />
                    ))}
                  </SimpleGrid>
                </div>

                {/* Treatments and Procedures */}
                <div>
                  <Text size="16px" fw={600} mb={12}>
                    {t('dashboard.sections.treatments', 'Treatments and Procedures')}
                  </Text>
                  <SimpleGrid cols={2} spacing={12}>
                    {treatmentModules.map((module, index) => (
                      <ModuleCard key={index} module={module} />
                    ))}
                  </SimpleGrid>
                </div>

                {/* Health Monitoring */}
                <div>
                  <Text size="16px" fw={600} mb={12}>
                    {t('dashboard.sections.healthMonitoring', 'Health Monitoring')}
                  </Text>
                  <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={12}>
                    {monitoringModules.map((module, index) => (
                      <ModuleCard key={index} module={module} />
                    ))}
                  </SimpleGrid>
                </div>

                {/* Prevention & History */}
                <div>
                  <Text size="16px" fw={600} mb={12}>
                    {t('dashboard.sections.prevention', 'Prevention & History')}
                  </Text>
                  <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={12}>
                    {preventionModules.map((module, index) => (
                      <ModuleCard key={index} module={module} />
                    ))}
                  </SimpleGrid>
                </div>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4 }} className="dashboard-sidebar">
              <Stack gap={16}>
                {/* Additional Resources */}
                <Card shadow="sm" padding={16} radius="md" withBorder>
                  <Text size="15px" fw={600} mb={12}>
                    {t('dashboard.sections.additionalResources', 'Additional Resources')}
                  </Text>
                  <Stack gap={6}>
                    {additionalModules.map((module, index) => {
                      const Icon = module.icon;
                      return (
                        <Paper
                          key={index}
                          className="dashboard-resource-item"
                          p="8px 10px"
                          radius="sm"
                          onClick={e => {
                            logger.info(
                              'Additional resource clicked:',
                              module.link
                            );
                            try {
                              navigate(module.link);
                            } catch (error) {
                              logger.error('Navigation error:', error);
                              frontendLogger.logError(
                                'Navigation error from additional resource',
                                {
                                  error: error.message,
                                  component: 'Dashboard',
                                  link: module.link,
                                }
                              );
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                          withBorder
                        >
                          <Group gap="sm">
                            <Box
                              className="dashboard-resource-icon"
                              style={{ background: `var(--mantine-color-${module.color}-light)` }}
                            >
                              <Icon size={12} color={`var(--mantine-color-${module.color}-filled)`} />
                            </Box>
                            <Text size="13px" fw={500} style={{ flex: 1 }}>
                              {module.title}
                            </Text>
                            <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
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
          <StatsRow />
        </Stack>
    </Container>
  );
};

export default Dashboard;
