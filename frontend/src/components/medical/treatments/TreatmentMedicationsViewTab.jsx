import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Stack,
  Paper,
  Group,
  Text,
  Badge,
  Loader,
  Alert,
} from '@mantine/core';
import { IconPill, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../../services/api';
import { useDateFormat } from '../../../hooks/useDateFormat';
import logger from '../../../services/logger';

const TreatmentMedicationsViewTab = ({ treatmentId, onMedicationClick }) => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();

    const fetchMedications = async () => {
      if (!treatmentId) return;
      setLoading(true);
      setError(null);

      try {
        const data = await apiService.getTreatmentMedications(treatmentId, controller.signal);
        if (isMountedRef.current && !controller.signal.aborted) {
          setMedications(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMountedRef.current) {
          setError(err.message);
          logger.error('treatment_medications_view_tab_error', {
            treatmentId,
            error: err.message,
            component: 'TreatmentMedicationsViewTab',
          });
        }
      } finally {
        if (isMountedRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchMedications();

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [treatmentId]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{t('treatments.medications.loading', 'Loading medications...')}</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        {t('treatments.medications.loadError', 'Failed to load medications')}
      </Alert>
    );
  }

  if (medications.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        {t('treatments.medications.empty', 'No medications linked to this treatment plan.')}
      </Text>
    );
  }

  const defaultSuffix = t('treatments.medications.default', '(from medication)');

  const renderValue = (specificValue, fallbackValue) => {
    if (specificValue) {
      return <Text size="sm" fw={500}>{specificValue}</Text>;
    }
    if (fallbackValue) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          {fallbackValue} {defaultSuffix}
        </Text>
      );
    }
    return null;
  };

  const renderDateValue = (specificDate, effectiveDate) => {
    if (specificDate) {
      return <Text size="sm" fw={500}>{formatDate(specificDate)}</Text>;
    }
    if (effectiveDate) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          {formatDate(effectiveDate)} {defaultSuffix}
        </Text>
      );
    }
    return null;
  };

  const renderNameValue = (specificObj, effectiveObj) => {
    if (specificObj) {
      return <Text size="sm" fw={500}>{specificObj.name}</Text>;
    }
    if (effectiveObj) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          {effectiveObj.name} {defaultSuffix}
        </Text>
      );
    }
    return null;
  };

  return (
    <Stack gap="sm">
      {medications.map((rel) => {
        const med = rel.medication;
        const medName = med?.medication_name || `Medication #${rel.medication_id}`;

        return (
          <Paper key={rel.id} withBorder p="sm">
            <Stack gap="xs">
              <Group gap="sm" wrap="wrap">
                <Badge
                  variant="light"
                  color="teal"
                  size="lg"
                  leftSection={<IconPill size={14} />}
                  style={onMedicationClick ? { cursor: 'pointer' } : undefined}
                  onClick={onMedicationClick ? () => onMedicationClick(rel.medication_id) : undefined}
                >
                  {medName}
                </Badge>
                {med?.status && (
                  <Badge variant="outline" size="sm" color="green">
                    {med.status}
                  </Badge>
                )}
                {med?.route && (
                  <Badge variant="outline" size="sm" color="gray">
                    {med.route}
                  </Badge>
                )}
              </Group>

              <Group gap="xl" wrap="wrap">
                {rel.effective_dosage && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t('treatments.medications.dosage', 'Dosage')}
                    </Text>
                    {renderValue(rel.specific_dosage, med?.dosage)}
                  </Stack>
                )}
                {rel.effective_frequency && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t('treatments.medications.frequency', 'Frequency')}
                    </Text>
                    {renderValue(rel.specific_frequency, med?.frequency)}
                  </Stack>
                )}
                {rel.specific_duration && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t('treatments.medications.duration', 'Duration')}
                    </Text>
                    <Text size="sm">{rel.specific_duration}</Text>
                  </Stack>
                )}
              </Group>

              <Group gap="xl" wrap="wrap">
                {rel.effective_start_date && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t('treatments.medications.startDate', 'Start Date')}
                    </Text>
                    {renderDateValue(rel.specific_start_date, rel.effective_start_date)}
                  </Stack>
                )}
                {(rel.effective_end_date || rel.effective_start_date) && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t('treatments.medications.endDate', 'End Date')}
                    </Text>
                    {renderDateValue(rel.specific_end_date, rel.effective_end_date) || (
                      <Text size="sm" c="dimmed" fs="italic">
                        {t('treatments.medications.ongoing', 'Ongoing')}
                      </Text>
                    )}
                  </Stack>
                )}
              </Group>

              <Group gap="xl" wrap="wrap">
                {rel.effective_prescriber && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t('treatments.medications.prescriber', 'Prescriber')}
                    </Text>
                    {renderNameValue(rel.specific_prescriber, rel.effective_prescriber)}
                  </Stack>
                )}
                {rel.effective_pharmacy && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t('treatments.medications.pharmacy', 'Pharmacy')}
                    </Text>
                    {renderNameValue(rel.specific_pharmacy, rel.effective_pharmacy)}
                  </Stack>
                )}
              </Group>

              {rel.timing_instructions && (
                <Text size="sm" c="dimmed">
                  <strong>{t('treatments.medications.timing', 'Timing')}:</strong> {rel.timing_instructions}
                </Text>
              )}

              {rel.relevance_note && (
                <Text size="sm" c="dimmed" fs="italic">
                  {rel.relevance_note}
                </Text>
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
};

TreatmentMedicationsViewTab.propTypes = {
  treatmentId: PropTypes.number.isRequired,
  onMedicationClick: PropTypes.func,
};

export default TreatmentMedicationsViewTab;
