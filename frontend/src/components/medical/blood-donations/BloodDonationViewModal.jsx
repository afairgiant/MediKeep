import PropTypes from 'prop-types';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import {
  getDonationTypeLabel,
  getDonationTypeColor,
} from '../../../constants/bloodDonationConstants';
import {
  formatBloodPressure,
  formatTemperature,
  formatHemoglobin,
} from './BloodDonationCard';

const DetailItem = ({ label, value }) => (
  <Stack gap="xs">
    <Text fw={500} size="sm" c="dimmed">
      {label}
    </Text>
    <Text size="sm">{value}</Text>
  </Stack>
);

DetailItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
};

const BloodDonationViewModal = ({
  isOpen,
  onClose,
  donation,
  onEdit,
  unitSystem = 'imperial',
  disableEdit = false,
  disableEditTooltip,
}) => {
  const { t } = useTranslation(['medical', 'shared']);
  const { formatLongDate } = useDateFormat();

  if (!isOpen || !donation) return null;

  const handleEdit = () => {
    onEdit(donation);
    onClose();
  };

  const screening = [
    {
      label: t('bloodDonations.fields.bloodPressure', 'Blood Pressure'),
      value: formatBloodPressure(donation),
    },
    {
      label: t('bloodDonations.fields.temperature', 'Temperature'),
      value: formatTemperature(donation.temperature, unitSystem),
    },
    {
      label: t('bloodDonations.fields.hemoglobin', 'Hemoglobin'),
      value: formatHemoglobin(donation.hemoglobin),
    },
  ].filter(item => item.value);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={t('bloodDonations.viewModal.title', 'Blood Donation Details')}
      size="lg"
      centered
      zIndex={2000}
    >
      <Stack gap="lg">
        <Group gap="xs">
          <Badge
            variant="light"
            color={getDonationTypeColor(donation.donation_type)}
          >
            {getDonationTypeLabel(donation.donation_type, t)}
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <DetailItem
            label={t('bloodDonations.fields.donationDate', 'Donation Date')}
            value={formatLongDate(donation.donation_date)}
          />
          <DetailItem
            label={t('bloodDonations.fields.location', 'Location')}
            value={
              donation.location ||
              t('shared:labels.notSpecified', 'Not specified')
            }
          />
        </SimpleGrid>

        {screening.length > 0 && (
          <div>
            <Title order={4} mb="sm">
              {t('bloodDonations.tabs.screening', 'Pre-donation Screening')}
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {screening.map(item => (
                <DetailItem
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </SimpleGrid>
          </div>
        )}

        {donation.notes && (
          <div>
            <Title order={4} mb="sm">
              {t('shared:tabs.notes', 'Notes')}
            </Title>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {donation.notes}
            </Text>
          </div>
        )}

        {donation.tags && donation.tags.length > 0 && (
          <div>
            <Title order={4} mb="sm">
              {t('shared:labels.tags', 'Tags')}
            </Title>
            <Group gap="xs">
              {donation.tags.map(tag => (
                <Badge key={tag} variant="light" color="blue" size="sm">
                  {tag}
                </Badge>
              ))}
            </Group>
          </div>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('shared:labels.close', 'Close')}
          </Button>
          <Tooltip
            label={disableEditTooltip}
            disabled={!disableEdit || !disableEditTooltip}
          >
            <span>
              <Button
                variant="filled"
                onClick={handleEdit}
                leftSection={<IconEdit size={16} />}
                disabled={disableEdit}
              >
                {t('shared:labels.edit', 'Edit')}
              </Button>
            </span>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
};

BloodDonationViewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  donation: PropTypes.shape({
    id: PropTypes.number,
    donation_date: PropTypes.string,
    donation_type: PropTypes.string,
    location: PropTypes.string,
    systolic_bp: PropTypes.number,
    diastolic_bp: PropTypes.number,
    temperature: PropTypes.number,
    hemoglobin: PropTypes.number,
    notes: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
  }),
  onEdit: PropTypes.func.isRequired,
  unitSystem: PropTypes.oneOf(['imperial', 'metric']),
  disableEdit: PropTypes.bool,
  disableEditTooltip: PropTypes.string,
};

export default BloodDonationViewModal;
