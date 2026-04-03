import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Group,
  Button,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import apiService from '../../../services/api';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';

const emptyForm = {
  name: '',
  phone_number: '',
  fax_number: '',
  website: '',
  patient_portal_url: '',
  notes: '',
};

const PracticeEditModal = ({ isOpen, onClose, practiceData, onSaved }) => {
  const { t } = useTranslation(['common', 'medical', 'shared']);
  const isEditing = Boolean(practiceData);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (practiceData) {
        setFormData({
          name: practiceData.name || '',
          phone_number: practiceData.phone_number || '',
          fax_number: practiceData.fax_number || '',
          website: practiceData.website || '',
          patient_portal_url: practiceData.patient_portal_url || '',
          notes: practiceData.notes || '',
        });
      } else {
        setFormData(emptyForm);
      }
    }
  }, [practiceData, isOpen]);

  const handleChange = (field) => (event) => {
    const value = event?.target?.value ?? event;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = { ...formData };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === '') {
          payload[key] = null;
        }
      });
      payload.name = formData.name.trim();

      if (isEditing) {
        await apiService.updatePractice(practiceData.id, payload);
      } else {
        await apiService.createPractice(payload);
      }
      notifications.show({
        title: t('common:messages.updateSuccess', 'Success'),
        message: isEditing
          ? t('common:practitioners.viewModal.practiceUpdateSuccess', 'Practice updated successfully')
          : t('common:practitioners.practices.createSuccess', 'Practice created successfully'),
        color: 'green',
      });
      onSaved();
      onClose();
    } catch {
      notifications.show({
        title: t('common:labels.error', 'Error'),
        message: t('common:practitioners.viewModal.practiceUpdateError', 'Failed to update practice'),
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={isEditing
        ? t('common:practitioners.viewModal.editPractice', 'Edit Practice')
        : t('common:practitioners.practices.createTitle', 'Add Practice')
      }
      size="md"
      centered
      zIndex={2100}
    >
      <FormLoadingOverlay
        visible={isSubmitting}
        message={t('common:messages.processing')}
      />
      <Stack gap="md">
        <TextInput
          label={t('medical:practices.form.name.label')}
          placeholder={t('medical:practices.form.name.placeholder')}
          description={t('medical:practices.form.name.description')}
          value={formData.name}
          onChange={handleChange('name')}
          required
        />
        <TextInput
          label={t('medical:practices.form.phone.label')}
          placeholder={t('medical:practices.form.phone.placeholder')}
          description={t('medical:practices.form.phone.description')}
          value={formData.phone_number}
          onChange={handleChange('phone_number')}
        />
        <TextInput
          label={t('medical:practices.form.fax.label')}
          placeholder={t('medical:practices.form.fax.placeholder')}
          description={t('medical:practices.form.fax.description')}
          value={formData.fax_number}
          onChange={handleChange('fax_number')}
        />
        <TextInput
          label={t('medical:practices.form.website.label')}
          placeholder={t('medical:practices.form.website.placeholder')}
          description={t('medical:practices.form.website.description')}
          value={formData.website}
          onChange={handleChange('website')}
        />
        <TextInput
          label={t('medical:practices.form.patientPortal.label')}
          placeholder={t('medical:practices.form.patientPortal.placeholder')}
          description={t('medical:practices.form.patientPortal.description')}
          value={formData.patient_portal_url}
          onChange={handleChange('patient_portal_url')}
        />
        <Textarea
          label={t('shared:tabs.notes')}
          placeholder={t('medical:practices.form.notes.placeholder')}
          description={t('medical:practices.form.notes.description')}
          value={formData.notes}
          onChange={handleChange('notes')}
          minRows={3}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('common:buttons.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!formData.name.trim()}
          >
            {t('common:practitioners.viewModal.savePractice', 'Save Practice')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default PracticeEditModal;
