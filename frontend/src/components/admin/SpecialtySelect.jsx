import { useEffect, useState, useCallback } from 'react';
import { Button, Group, Modal, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import specialtyApi from '../../services/api/specialtyApi';
import logger from '../../services/logger';

const QUICK_ADD_FOOTER_VALUE = '__add_new__';

const SpecialtySelect = ({
  value,
  onChange,
  disabled,
  placeholder,
  hasError,
}) => {
  const { t } = useTranslation(['admin', 'common', 'shared']);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSpecialties = useCallback(async () => {
    setLoading(true);
    try {
      await specialtyApi.migrateLegacyCustomSpecialties();
      const items = await specialtyApi.list();
      setSpecialties(Array.isArray(items) ? items : []);
    } catch (err) {
      logger.error(
        'specialty_select_load_error',
        'Failed to load medical specialties',
        { error: err.message, component: 'SpecialtySelect' }
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpecialties();
  }, [loadSpecialties]);

  const data = [
    ...specialties.map(s => ({
      value: String(s.id),
      label: s.description ? `${s.name} - ${s.description}` : s.name,
    })),
    {
      value: QUICK_ADD_FOOTER_VALUE,
      label: t('admin:practitioner.quickAddSpecialty', '+ Add new specialty…'),
    },
  ];

  const handleChange = nextValue => {
    if (nextValue === QUICK_ADD_FOOTER_VALUE) {
      setModalOpen(true);
      return;
    }
    onChange(nextValue === null || nextValue === '' ? null : Number(nextValue));
  };

  const handleQuickAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const created = await specialtyApi.create({
        name: trimmed,
        description: newDescription.trim() || null,
      });
      await loadSpecialties();
      onChange(created.id);
      notifications.show({
        title: t('shared:labels.success', 'Success'),
        message: t(
          'admin:practitioner.specialtyCreated',
          'Specialty created'
        ),
        color: 'green',
      });
      setModalOpen(false);
      setNewName('');
      setNewDescription('');
    } catch (err) {
      notifications.show({
        title: t('shared:labels.error', 'Error'),
        message: err?.message || t('shared:labels.unknownError', 'Unknown error'),
        color: 'red',
      });
      logger.error(
        'specialty_quick_add_failed',
        'Quick-add specialty failed',
        { error: err.message, component: 'SpecialtySelect' }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Select
        data={data}
        value={value ? String(value) : null}
        onChange={handleChange}
        disabled={disabled || loading}
        placeholder={
          placeholder ||
          t('admin:practitioner.specialtyPlaceholder', 'Select a specialty')
        }
        error={hasError}
        searchable
        clearable
      />

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('admin:practitioner.quickAddSpecialty', 'Add new specialty')}
        zIndex={2200}
      >
        <Stack gap="sm">
          <TextInput
            label={t('admin:medicalSpecialty.name', 'Name')}
            value={newName}
            onChange={e => setNewName(e.currentTarget.value)}
            required
          />
          <Textarea
            label={t('admin:medicalSpecialty.description', 'Description')}
            value={newDescription}
            onChange={e => setNewDescription(e.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleQuickAdd}
              loading={saving}
              disabled={!newName.trim()}
            >
              {t('shared:labels.save', 'Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default SpecialtySelect;
