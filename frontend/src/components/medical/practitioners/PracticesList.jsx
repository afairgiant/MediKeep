import { useState, useMemo, useCallback } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../../services/api';
import { usePractices } from '../../../hooks';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveTable } from '../../adapters';
import EmptyState from '../../shared/EmptyState';
import MedicalPageLoading from '../../shared/MedicalPageLoading';
import PracticeEditModal from './PracticeEditModal';
import frontendLogger from '../../../services/frontendLogger';

const PracticesList = ({ onPracticeSaved }) => {
  const { t } = useTranslation(['common', 'shared']);
  const responsive = useResponsive();
  const { practices, loading, error, refresh } = usePractices();

  const [search, setSearch] = useState('');
  const [practiceEditData, setPracticeEditData] = useState(null);
  const [showPracticeEditModal, setShowPracticeEditModal] = useState(false);

  const filteredPractices = useMemo(() => {
    if (!search.trim()) return practices;
    const term = search.toLowerCase();
    return practices.filter(p => p.name.toLowerCase().includes(term));
  }, [practices, search]);

  const unusedCount = useMemo(
    () => practices.filter(p => (p.practitioner_count ?? 0) === 0).length,
    [practices]
  );

  const handleEditPractice = useCallback(async (practiceId) => {
    try {
      const data = await apiService.getPractice(practiceId);
      setPracticeEditData(data);
      setShowPracticeEditModal(true);
    } catch (err) {
      notifications.show({
        title: t('shared:labels.error'),
        message: t('practitioners.editPracticeError'),
        color: 'red',
      });
      frontendLogger.logError('Failed to load practice for editing', {
        practiceId,
        error: err.message,
        component: 'PracticesList',
      });
    }
  }, [t]);

  const handleDeletePractice = useCallback(async (practice) => {
    if (
      !window.confirm(
        t('practitioners.practices.deleteConfirm', { name: practice.name })
      )
    ) {
      return;
    }

    try {
      await apiService.deletePractice(practice.id);
      notifications.show({
        title: t('shared:labels.success', 'Success'),
        message: t('practitioners.practices.deleteSuccess'),
        color: 'green',
      });
      await refresh();
      if (onPracticeSaved) onPracticeSaved();
    } catch (err) {
      notifications.show({
        title: t('shared:labels.error'),
        message: t('practitioners.practices.deleteError'),
        color: 'red',
      });
      frontendLogger.logError('Failed to delete practice', {
        practiceId: practice.id,
        error: err.message,
        component: 'PracticesList',
      });
    }
  }, [t, refresh, onPracticeSaved]);

  const handlePracticeSaved = useCallback(() => {
    refresh();
    if (onPracticeSaved) onPracticeSaved();
  }, [refresh, onPracticeSaved]);

  if (loading) {
    return <MedicalPageLoading message={t('practitioners.loading')} />;
  }

  return (
    <>
      <Group justify="space-between" mb="sm">
        <TextInput
          placeholder={t('practitioners.practices.searchPlaceholder')}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="sm"
          style={{ flex: 1 }}
        />
        <Button
          size="sm"
          leftSection={<IconPlus size={16} />}
          onClick={() => { setPracticeEditData(null); setShowPracticeEditModal(true); }}
        >
          {t('practitioners.practices.addNew', 'Add Practice')}
        </Button>
      </Group>

      {error && (
        <Alert color="red" mb="sm">
          {t('practitioners.errors.loadFailed')}
        </Alert>
      )}

      {filteredPractices.length === 0 ? (
        <EmptyState
          icon={IconSearch}
          title={t('practitioners.practices.emptyTitle')}
          hasActiveFilters={search.trim().length > 0}
          filteredMessage={t('practitioners.practices.searchPlaceholder')}
          noDataMessage={t('practitioners.practices.emptyNoData')}
        />
      ) : (
        <Paper shadow="sm" radius="md" withBorder>
          <ResponsiveTable
            persistKey="practices-list"
            data={filteredPractices}
            size="sm"
            sortable={false}
            columns={[
              { header: t('shared:labels.name'), accessor: 'name', priority: 'high', width: 200 },
              { header: t('shared:labels.phone'), accessor: 'phone_number', priority: 'low', width: 130 },
              { header: t('shared:labels.website'), accessor: 'website', priority: 'low', width: 160 },
              {
                header: t('shared:categories.practitioners'),
                accessor: 'practitioner_count',
                priority: 'high',
                width: 60,
              },
              {
                header: t('shared:labels.actions'),
                accessor: 'id',
                priority: 'high',
                width: 140,
              },
            ]}
            tableName={t('practitioners.tabs.practices')}
            formatters={{
              phone_number: (value) => value || '-',
              website: (value) => value || '-',
              practitioner_count: (value) => {
                const count = value ?? 0;
                return (
                  <Badge size="sm" color={count === 0 ? 'red' : 'blue'} variant="light">
                    {count}
                  </Badge>
                );
              },
              id: (value, row) => {
                const count = row.practitioner_count ?? 0;
                return (
                  <Group gap="xs" wrap="nowrap" className="no-print" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      leftSection={<IconEdit size={14} />}
                      onClick={() => handleEditPractice(row.id)}
                    >
                      {t('shared:labels.edit', 'Edit')}
                    </Button>
                    <Tooltip
                      label={t('practitioners.practices.cannotDelete')}
                      disabled={count === 0}
                    >
                      <Button
                        variant="subtle"
                        color="red"
                        size="compact-xs"
                        leftSection={<IconTrash size={14} />}
                        disabled={count > 0}
                        onClick={() => handleDeletePractice(row)}
                      >
                        {t('buttons.delete', 'Delete')}
                      </Button>
                    </Tooltip>
                  </Group>
                );
              },
            }}
            dataType="medical"
            responsive={responsive}
          />
        </Paper>
      )}

      <Group mt="xs" gap="md">
        <Text size="sm" c="dimmed">
          {t('practitioners.practices.totalCount', { count: practices.length })}
        </Text>
        <Text size="sm" c="dimmed">
          {t('practitioners.practices.unusedCount', { count: unusedCount })}
        </Text>
      </Group>

      <PracticeEditModal
        isOpen={showPracticeEditModal}
        onClose={() => { setShowPracticeEditModal(false); setPracticeEditData(null); }}
        practiceData={practiceEditData}
        onSaved={handlePracticeSaved}
      />
    </>
  );
};

export default PracticesList;
