import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ActionIcon, Group, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUserPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { usePractitioners } from '../../../hooks/useGlobalData';
import { apiService } from '../../../services/api';
import logger from '../../../services/logger';
import { cleanPractitionerFormData } from '../../../utils/practitionerFormUtils';
import PractitionerFormWrapper from './PractitionerFormWrapper';

interface Practitioner {
  id: number;
  name: string;
  specialty?: string | null;
}

interface Props {
  value: string | null;
  onChange: (_value: string | null) => void;
  practitioners: Practitioner[];
  label: string;
  placeholder?: string;
  description?: string;
}

interface FormData {
  name: string;
  specialty_id: number | null;
  practice_id: string;
  phone_number: string;
  email: string;
  website: string;
  rating: string;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  specialty_id: null,
  practice_id: '',
  phone_number: '',
  email: '',
  website: '',
  rating: '',
};

const PractitionerSelectWithCreate = ({
  value,
  onChange,
  practitioners,
  label,
  placeholder,
  description,
}: Props) => {
  const { t } = useTranslation(['common', 'shared', 'medical']);
  const { refresh } = usePractitioners(false);

  const [localOptions, setLocalOptions] = useState(() =>
    practitioners.map(p => ({
      value: String(p.id),
      label: `${p.name}${p.specialty ? ` - ${p.specialty}` : ''}`,
    }))
  );
  const [subModalOpen, setSubModalOpen] = useState(false);
  // Incremented each time the sub-modal opens to guarantee a fresh mount of
  // PractitionerFormWrapper (and therefore SpecialtySelect) every open cycle.
  // Fixes a lifecycle issue where SpecialtySelect's useEffect does not fire
  // reliably when rendered inside a nested Mantine Modal Portal.
  const [modalKey, setModalKey] = useState(0);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement> | { target: { name: string; value: unknown } }
  ) => {
    const { name, value: val } = e.target;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleOpen = () => {
    setModalKey(k => k + 1);
    setSubModalOpen(true);
  };

  const handleClose = () => {
    setSubModalOpen(false);
    setIsLoading(false);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      notifications.show({
        title: t('shared:labels.error', 'Error'),
        message: t(
          'common:practitioners.createInline.nameRequired',
          'Name is required'
        ),
        color: 'red',
      });
      return;
    }
    if (!formData.specialty_id) {
      notifications.show({
        title: t('shared:labels.error', 'Error'),
        message: t(
          'common:practitioners.createInline.specialtyRequired',
          'Medical specialty is required'
        ),
        color: 'red',
      });
      return;
    }

    setIsLoading(true);
    try {
      const dataToSubmit = cleanPractitionerFormData(formData);
      const result = await apiService.createPractitioner(dataToSubmit);

      const newOption = {
        value: String(result.id),
        label: `${result.name}${result.specialty ? ` - ${result.specialty}` : ''}`,
      };
      setLocalOptions(prev => [...prev, newOption]);
      onChange(String(result.id));

      notifications.show({
        title: t('shared:labels.success', 'Success'),
        message: t(
          'common:practitioners.createInline.successMessage',
          'Practitioner created and selected'
        ),
        color: 'green',
      });

      handleClose();
      refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('create_practitioner_inline_failed', {
        message: 'Failed to create practitioner inline',
        component: 'PractitionerSelectWithCreate',
        error: message,
      });
      notifications.show({
        title: t('shared:labels.error', 'Error'),
        message: t(
          'common:practitioners.createInline.createError',
          'Failed to create practitioner. Please try again.'
        ),
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack gap={2}>
      <Select
        data={localOptions}
        value={value}
        onChange={onChange}
        label={label}
        description={description}
        placeholder={placeholder}
        searchable
        clearable
        comboboxProps={{ withinPortal: true, zIndex: 3000 }}
      />
      <Group gap={4} mt={2}>
        <ActionIcon
          size="xs"
          variant="subtle"
          onClick={handleOpen}
          aria-label={t(
            'common:practitioners.createInline.buttonTooltip',
            'New practitioner'
          )}
        >
          <IconUserPlus size={14} />
        </ActionIcon>
        <Text
          size="xs"
          c="dimmed"
          style={{ cursor: 'pointer' }}
          onClick={handleOpen}
        >
          {t('common:practitioners.createInline.buttonTooltip', 'New practitioner')}
        </Text>
      </Group>

      <PractitionerFormWrapper
        key={modalKey}
        isOpen={subModalOpen}
        onClose={handleClose}
        title={t('common:practitioners.form.addTitle', 'Add New Practitioner')}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingItem={null}
        isLoading={isLoading}
        zIndex={2100}
      />
    </Stack>
  );
};

export default PractitionerSelectWithCreate;
