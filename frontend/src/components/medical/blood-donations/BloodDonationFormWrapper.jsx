import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  Stack,
  Group,
  Button,
  Grid,
  Autocomplete,
  Textarea,
  Select,
  NumberInput,
  Tabs,
  Box,
} from '@mantine/core';
import { IconDroplet, IconHeartbeat, IconNotes } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { DateInput } from '../../adapters/DateInput';
import { useDateFormat } from '../../../hooks/useDateFormat';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import {
  parseDateInput,
  formatDateInputChange,
} from '../../../utils/dateUtils';
import { TagInput } from '../../common/TagInput';
import { unitLabels, validationRanges } from '../../../utils/unitConversion';
import {
  getDonationTypeOptions,
  getHemoglobinDecimals,
  getHemoglobinRange,
  getHemoglobinUnitLabel,
  DEFAULT_HEMOGLOBIN_UNIT,
  HEMOGLOBIN_UNITS,
  SCREENING_RANGES,
} from '../../../constants/bloodDonationConstants';
import logger from '../../../services/logger';

const BloodDonationFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingDonation = null,
  formData,
  onInputChange,
  onSubmit,
  unitSystem = 'imperial',
  hemoglobinUnit = DEFAULT_HEMOGLOBIN_UNIT,
  isLoading = false,
  locationSuggestions = [],
}) => {
  const { t } = useTranslation(['medical', 'shared']);
  const { dateInputFormat, dateParser } = useDateFormat();
  const [activeTab, setActiveTab] = useState('donation');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('donation');
    } else {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const setField = (name, value) => onInputChange({ target: { name, value } });

  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(e);
    } catch (error) {
      logger.error('blood_donation_form_wrapper_error', {
        message: 'Error in BloodDonationFormWrapper',
        donationId: editingDonation?.id,
        error: error.message,
        component: 'BloodDonationFormWrapper',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const temperatureUnit = unitLabels[unitSystem].temperature;
  const temperatureRange = validationRanges[unitSystem].temperature;
  const hemoglobinRange = getHemoglobinRange(hemoglobinUnit);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      closeOnClickOutside={!isLoading && !isSubmitting}
      closeOnEscape={!isLoading && !isSubmitting}
    >
      <FormLoadingOverlay
        visible={isSubmitting || isLoading}
        message={t('bloodDonations.form.saving', 'Saving donation...')}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="donation"
                leftSection={<IconDroplet size={16} />}
              >
                {t('bloodDonations.tabs.donation', 'Donation')}
              </Tabs.Tab>
              <Tabs.Tab
                value="screening"
                leftSection={<IconHeartbeat size={16} />}
              >
                {t('bloodDonations.tabs.screening', 'Pre-donation Screening')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="donation">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t(
                        'bloodDonations.fields.donationDate',
                        'Donation Date'
                      )}
                      value={parseDateInput(formData.donation_date)}
                      onChange={date =>
                        setField('donation_date', formatDateInputChange(date))
                      }
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      dateParser={dateParser}
                      maxDate={new Date()}
                      required
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t(
                        'bloodDonations.fields.donationType',
                        'Donation Type'
                      )}
                      value={formData.donation_type || null}
                      data={getDonationTypeOptions(t)}
                      onChange={value => setField('donation_type', value || '')}
                      required
                      allowDeselect={false}
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Autocomplete
                      label={t('bloodDonations.fields.location', 'Location')}
                      value={formData.location || ''}
                      onChange={value => setField('location', value)}
                      data={locationSuggestions}
                      maxDropdownHeight={200}
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      placeholder={t(
                        'bloodDonations.form.locationPlaceholder',
                        'e.g., Red Cross blood drive, City Hospital'
                      )}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="screening">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={t(
                        'bloodDonations.fields.systolic',
                        'Systolic (mmHg)'
                      )}
                      value={formData.systolic_bp ?? ''}
                      onChange={value => setField('systolic_bp', value)}
                      min={SCREENING_RANGES.systolic_bp.min}
                      max={SCREENING_RANGES.systolic_bp.max}
                      allowDecimal={false}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={t(
                        'bloodDonations.fields.diastolic',
                        'Diastolic (mmHg)'
                      )}
                      value={formData.diastolic_bp ?? ''}
                      onChange={value => setField('diastolic_bp', value)}
                      min={SCREENING_RANGES.diastolic_bp.min}
                      max={SCREENING_RANGES.diastolic_bp.max}
                      allowDecimal={false}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={`${t('bloodDonations.fields.temperature', 'Temperature')} (${temperatureUnit})`}
                      value={formData.temperature ?? ''}
                      onChange={value => setField('temperature', value)}
                      min={temperatureRange.min}
                      max={temperatureRange.max}
                      decimalScale={1}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={`${t('bloodDonations.fields.hemoglobin', 'Hemoglobin')} (${getHemoglobinUnitLabel(hemoglobinUnit)})`}
                      value={formData.hemoglobin ?? ''}
                      onChange={value => setField('hemoglobin', value)}
                      min={hemoglobinRange.min}
                      max={hemoglobinRange.max}
                      decimalScale={getHemoglobinDecimals(hemoglobinUnit)}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="notes">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('shared:tabs.notes', 'Notes')}
                      value={formData.notes || ''}
                      onChange={handleTextInputChange('notes')}
                      placeholder={t(
                        'bloodDonations.form.notesPlaceholder',
                        'Additional notes about this donation'
                      )}
                      autosize
                      minRows={2}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TagInput
                      value={formData.tags || []}
                      onChange={tags => setField('tags', tags)}
                      label={t('shared:labels.tags', 'Tags')}
                      placeholder={t('shared:fields.addTags', 'Add tags...')}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={onClose}
              disabled={isLoading || isSubmitting}
            >
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.donation_date || !formData.donation_type}
            >
              {editingDonation
                ? t('bloodDonations.form.update', 'Update Donation')
                : t('bloodDonations.form.save', 'Save Donation')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

BloodDonationFormWrapper.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  editingDonation: PropTypes.shape({ id: PropTypes.number }),
  formData: PropTypes.shape({
    donation_date: PropTypes.string,
    donation_type: PropTypes.string,
    location: PropTypes.string,
    systolic_bp: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    diastolic_bp: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    temperature: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    hemoglobin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    notes: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onInputChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  unitSystem: PropTypes.oneOf(['imperial', 'metric']),
  hemoglobinUnit: PropTypes.oneOf(HEMOGLOBIN_UNITS),
  isLoading: PropTypes.bool,
  locationSuggestions: PropTypes.arrayOf(PropTypes.string),
};

export default BloodDonationFormWrapper;
