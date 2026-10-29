import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle } from '@tabler/icons-react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { notifySuccess } from '../../../utils/notifyTranslated';
import UnsavedChangesBar from './UnsavedChangesBar';
import {
  DEFAULT_SECTION,
  SECTIONS,
  sectionHasChanges,
  type SectionId,
} from './sections';
import { useAdminSettings } from './useAdminSettings';
import './AdminSettingsPage.css';

const AdminSettingsPage = () => {
  const { t } = useTranslation(['admin', 'shared']);
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const state = useAdminSettings();

  const sectionLabels: Record<SectionId, string> = {
    general: t('settings.sections.general', 'General'),
    users: t('settings.sections.users', 'Users and sign-in'),
    data: t('settings.sections.data', 'Data and storage'),
    backups: t('settings.sections.backups', 'Backups'),
    deployment: t('settings.sections.deployment', 'Set by deployment'),
  };

  if (!SECTIONS.some(s => s.id === section)) {
    return <Navigate to={`/admin/settings/${DEFAULT_SECTION}`} replace />;
  }

  const handleSave = async () => {
    if (await state.save()) {
      notifySuccess('admin:settings.saveBar.saved');
    }
  };

  const header = (
    <Box mb="lg">
      <Title order={2}>{t('settings.title', 'Settings')}</Title>
      <Text c="dimmed" size="sm">
        {t(
          'settings.subtitle',
          'System-wide settings for this MediKeep instance'
        )}
      </Text>
    </Box>
  );

  if (state.loading) {
    return (
      <AdminLayout>
        <div className="admin-settings-page">
          {header}
          <Stack
            gap="md"
            aria-busy="true"
            aria-label={t('settings.loading', 'Loading settings...')}
          >
            <Skeleton height={36} width="40%" />
            <Skeleton height={160} />
            <Skeleton height={120} />
          </Stack>
        </div>
      </AdminLayout>
    );
  }

  if (state.loadError) {
    return (
      <AdminLayout>
        <div className="admin-settings-page">
          {header}
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{state.loadError}</Text>
              <Button size="xs" variant="light" onClick={state.load}>
                {t('shared:labels.retry', 'Retry')}
              </Button>
            </Stack>
          </Alert>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-settings-page">
        {header}

        {state.saveError && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            withCloseButton
            onClose={() => state.setSaveError(null)}
            mb="md"
          >
            {state.saveError.scope === 'schedule'
              ? t(
                  'settings.errors.scheduleNotSaved',
                  'Your other changes were saved, but the backup schedule was not: {{error}}',
                  { error: state.saveError.message }
                )
              : state.saveError.message}
          </Alert>
        )}

        <Tabs
          className="admin-settings-tabs"
          value={section}
          onChange={value => value && navigate(`/admin/settings/${value}`)}
          orientation={isMobile ? 'horizontal' : 'vertical'}
          variant="pills"
          keepMounted={false}
        >
          <Tabs.List mb={isMobile ? 'md' : 0} mr={isMobile ? 0 : 'lg'}>
            {SECTIONS.map(s => (
              <Tabs.Tab
                key={s.id}
                value={s.id}
                rightSection={
                  sectionHasChanges(s, state) ? (
                    <Box
                      component="span"
                      w={8}
                      h={8}
                      bg="yellow.6"
                      style={{ borderRadius: '50%', display: 'inline-block' }}
                      role="img"
                      aria-label={t(
                        'settings.saveBar.region',
                        'Unsaved changes'
                      )}
                    />
                  ) : null
                }
              >
                {sectionLabels[s.id]}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {SECTIONS.map(({ id, Component }) => (
            <Tabs.Panel key={id} value={id}>
              <Stack gap="md">
                <Component state={state} />
                <UnsavedChangesBar
                  count={state.unsavedCount}
                  saving={state.saving}
                  canSave={state.canSave}
                  onSave={handleSave}
                  onDiscard={state.discard}
                />
              </Stack>
            </Tabs.Panel>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;
