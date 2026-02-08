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
import { IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../../services/api';
import { useDateFormat } from '../../../hooks/useDateFormat';
import StatusBadge from '../StatusBadge';
import logger from '../../../services/logger';

const MedicationTreatmentsList = ({ medicationId, onTreatmentClick }) => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();

    const fetchTreatments = async () => {
      if (!medicationId) return;
      setLoading(true);
      setError(null);

      try {
        const data = await apiService.getMedicationTreatments(medicationId, controller.signal);
        if (isMountedRef.current && !controller.signal.aborted) {
          setTreatments(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMountedRef.current) {
          setError(err.message);
          logger.error('medication_treatments_list_error', {
            medicationId,
            error: err.message,
            component: 'MedicationTreatmentsList',
          });
        }
      } finally {
        if (isMountedRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchTreatments();

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [medicationId]);

  if (loading) {
    return (
      <Stack align="center" py="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{t('medications.treatments.loading', 'Loading treatments...')}</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
        {t('medications.treatments.loadError', 'Failed to load treatments')}
      </Alert>
    );
  }

  if (treatments.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        {t('medications.treatments.empty', 'This medication is not used in any treatments.')}
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {treatments.map((rel) => {
        const trt = rel.treatment;
        if (!trt) return null;

        return (
          <Paper
            key={rel.id}
            withBorder
            p="xs"
            style={onTreatmentClick ? { cursor: 'pointer' } : undefined}
            onClick={onTreatmentClick ? () => onTreatmentClick(trt.id) : undefined}
          >
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {trt.treatment_name}
                </Text>
                <Group gap="xs">
                  <StatusBadge status={trt.status} />
                  {trt.treatment_type && (
                    <Badge variant="light" color="blue" size="xs">
                      {trt.treatment_type}
                    </Badge>
                  )}
                  {trt.mode === 'advanced' && (
                    <Badge variant="light" color="grape" size="xs">
                      Treatment Plan
                    </Badge>
                  )}
                </Group>
              </Stack>
              <Stack gap={2} align="flex-end">
                {trt.start_date && (
                  <Text size="xs" c="dimmed">
                    {formatDate(trt.start_date)}
                    {trt.end_date ? ` - ${formatDate(trt.end_date)}` : ''}
                  </Text>
                )}
                {trt.condition?.condition_name && (
                  <Badge variant="outline" size="xs" color="orange">
                    {trt.condition.condition_name}
                  </Badge>
                )}
              </Stack>
            </Group>

            {(rel.specific_dosage || rel.specific_frequency) && (
              <Group gap="xs" mt="xs">
                {rel.specific_dosage && (
                  <Badge variant="outline" size="xs">
                    {t('medications.treatments.overrideDosage', 'Dosage')}: {rel.specific_dosage}
                  </Badge>
                )}
                {rel.specific_frequency && (
                  <Badge variant="outline" size="xs" color="cyan">
                    {t('medications.treatments.overrideFrequency', 'Freq')}: {rel.specific_frequency}
                  </Badge>
                )}
              </Group>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
};

MedicationTreatmentsList.propTypes = {
  medicationId: PropTypes.number.isRequired,
  onTreatmentClick: PropTypes.func,
};

export default MedicationTreatmentsList;
