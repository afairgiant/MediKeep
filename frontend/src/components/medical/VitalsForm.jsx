/**
 * VitalsForm Component - Enhanced Version with Mantine UI
 * Modern form for creating and editing patient vital signs with improved UX
 */
import logger from '../../services/logger';


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  TextInput,
  NumberInput,
  Textarea,
  Button,
  Group,
  Stack,
  Paper,
  Title,
  Text,
  Alert,
  Divider,
  Grid,
  Badge,
  ActionIcon,
  Box,
  Flex,
  Card,
  Loader,
  Center,
  Select,
  Popover,
} from '@mantine/core';
import {
  IconCalendar,
  IconHeart,
  IconWeight,
  IconActivity,
  IconThermometer,
  IconLungs,
  IconDroplet,
  IconNotes,
  IconDeviceFloppy,
  IconX,
  IconAlertTriangle,
  IconInfoCircle,
  IconTrendingUp,
  IconUser,
  IconMapPin,
  IconDevices,
  IconMoodSad,
  IconDropletFilled,
} from '@tabler/icons-react';
import { DateInput, DatePicker, TimeInput } from '@mantine/dates';
import { vitalsService } from '../../services/medical/vitalsService';
import { useTimezone } from '../../hooks';
import { useCurrentPatient } from '../../hooks/useGlobalData';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { validateDateTime } from '../../utils/helpers';
import {
  unitLabels,
  validationRanges,
  convertForDisplay,
  convertForStorage,
} from '../../utils/unitConversion';
import {
  parseDateTimeString,
  formatDateTimeForInput,
} from '../../utils/dateUtils';

const VitalsForm = ({
  vitals = null,
  patientId,
  practitionerId,
  onSave,
  onCancel,
  isEdit = false,
  createItem,
  updateItem,
  error,
  clearError,
}) => {
  const { t } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const { isReady, getCurrentTime, facilityTimezone } = useTimezone();
  const { patient: currentPatient } = useCurrentPatient();
  const { unitSystem, loading: preferencesLoading } = useUserPreferences();

  // Generate dynamic configs based on user's unit system
  const FORM_FIELDS = useMemo(() => ({
    basic: {
      title: t('vitals.form.sections.basicInfo', 'Basic Information'),
      icon: IconCalendar,
      fields: ['recorded_date'],
    },
    bloodPressure: {
      title: t('vitals.stats.bloodPressure', 'Blood Pressure'),
      icon: IconHeart,
      fields: ['systolic_bp', 'diastolic_bp'],
      description: t('vitals.form.bloodPressureDesc', 'Measured in mmHg'),
    },
    physical: {
      title: t('vitals.form.sections.physicalMeasurements', 'Physical Measurements'),
      icon: IconWeight,
      fields: ['weight'],
      description: t('vitals.form.weightDesc', 'Weight in {{unit}}', { unit: unitLabels[unitSystem].weightLong }),
    },
    vitals: {
      title: t('vitals.modal.vitalSigns', 'Vital Signs'),
      icon: IconActivity,
      fields: [
        'heart_rate',
        'temperature',
        'respiratory_rate',
        'oxygen_saturation',
      ],
      description: t('vitals.form.vitalSignsDesc', 'Core physiological measurements'),
    },
    additional: {
      title: t('vitals.modal.additionalMeasurements', 'Additional Measurements'),
      icon: IconDropletFilled,
      fields: ['blood_glucose', 'a1c', 'pain_scale'],
      description: t('vitals.form.additionalMeasurementsDesc', 'Supplementary health indicators'),
    },
    metadata: {
      title: t('vitals.form.sections.recordingInfo', 'Recording Information'),
      icon: IconMapPin,
      fields: ['location', 'device_used'],
      description: t('vitals.form.contextDesc', 'Context about the measurements'),
    },
    notes: {
      title: t('vitals.form.sections.additionalInfo', 'Additional Information'),
      icon: IconNotes,
      fields: ['notes'],
    },
  }), [unitSystem, t]);

  const FIELD_CONFIGS = useMemo(() => {
    const ranges = validationRanges[unitSystem];
    const labels = unitLabels[unitSystem];

    return {
      recorded_date: {
        label: t('vitals.form.recordedDateTime', 'Measurement Date & Time'),
        type: 'datetime',
        required: true,
        icon: IconCalendar,
        validation: {
          required: t('vitals.form.validation.dateRequired', 'Measurement date and time is required'),
          custom: value => {
            const result = validateDateTime(value, 'Recorded Date');
            return result.isValid ? null : result.error;
          },
        },
      },
      systolic_bp: {
        label: t('vitals.form.systolicBP', 'Systolic BP'),
        type: 'number',
        unit: t('vitals.units.mmHg', 'mmHg'),
        placeholder: '120',
        icon: IconHeart,
        min: 50,
        max: 300,
        step: 1,
        validation: {
          min: { value: 50, message: t('vitals.form.validation.systolicMin', 'Systolic BP must be at least 50 mmHg') },
          max: { value: 300, message: t('vitals.form.validation.systolicMax', 'Systolic BP cannot exceed 300 mmHg') },
        },
      },
      diastolic_bp: {
        label: t('vitals.form.diastolicBP', 'Diastolic BP'),
        type: 'number',
        unit: t('vitals.units.mmHg', 'mmHg'),
        placeholder: '80',
        icon: IconHeart,
        min: 30,
        max: 200,
        step: 1,
        validation: {
          min: { value: 30, message: t('vitals.form.validation.diastolicMin', 'Diastolic BP must be at least 30 mmHg') },
          max: { value: 200, message: t('vitals.form.validation.diastolicMax', 'Diastolic BP cannot exceed 200 mmHg') },
        },
      },
      heart_rate: {
        label: t('vitals.stats.heartRate', 'Heart Rate'),
        type: 'number',
        unit: t('vitals.units.bpm', 'BPM'),
        placeholder: '72',
        icon: IconActivity,
        min: 30,
        max: 250,
        step: 1,
        validation: {
          min: { value: 30, message: t('vitals.form.validation.heartRateMin', 'Heart rate must be at least 30 BPM') },
          max: { value: 250, message: t('vitals.form.validation.heartRateMax', 'Heart rate cannot exceed 250 BPM') },
        },
      },
      temperature: {
        label: t('vitals.stats.temperature', 'Temperature'),
        type: 'number',
        unit: labels.temperature,
        placeholder: unitSystem === 'imperial' ? '98.6' : '37.0',
        icon: IconThermometer,
        min: ranges.temperature.min,
        max: ranges.temperature.max,
        step: 0.1,
        validation: {
          min: {
            value: ranges.temperature.min,
            message: t('vitals.form.validation.temperatureMin', 'Temperature must be at least {{min}}{{unit}}', { min: ranges.temperature.min, unit: labels.temperature }),
          },
          max: {
            value: ranges.temperature.max,
            message: t('vitals.form.validation.temperatureMax', 'Temperature cannot exceed {{max}}{{unit}}', { max: ranges.temperature.max, unit: labels.temperature }),
          },
        },
      },
      weight: {
        label: t('vitals.stats.weight', 'Weight'),
        type: 'number',
        unit: labels.weight,
        placeholder: unitSystem === 'imperial' ? '150' : '68',
        icon: IconWeight,
        min: ranges.weight.min,
        max: ranges.weight.max,
        step: 0.1,
        validation: {
          min: {
            value: ranges.weight.min,
            message: t('vitals.form.validation.weightMin', 'Weight must be at least {{min}} {{unit}}', { min: ranges.weight.min, unit: labels.weight }),
          },
          max: {
            value: ranges.weight.max,
            message: t('vitals.form.validation.weightMax', 'Weight cannot exceed {{max}} {{unit}}', { max: ranges.weight.max, unit: labels.weight }),
          },
        },
      },
      respiratory_rate: {
        label: t('vitals.modal.respiratoryRate', 'Respiratory Rate'),
        type: 'number',
        unit: t('vitals.units.perMin', '/min'),
        placeholder: '16',
        icon: IconLungs,
        min: 5,
        max: 100,
        step: 1,
        validation: {
          min: { value: 5, message: t('vitals.form.validation.respiratoryRateMin', 'Respiratory rate must be at least 5/min') },
          max: { value: 100, message: t('vitals.form.validation.respiratoryRateMax', 'Respiratory rate cannot exceed 100/min') },
        },
      },
      oxygen_saturation: {
        label: t('vitals.card.oxygenSaturation', 'Oxygen Saturation'),
        type: 'number',
        unit: '%',
        placeholder: '98',
        icon: IconDroplet,
        min: 50,
        max: 100,
        step: 1,
        validation: {
          min: { value: 50, message: t('vitals.form.validation.oxygenMin', 'Oxygen saturation must be at least 50%') },
          max: { value: 100, message: t('vitals.form.validation.oxygenMax', 'Oxygen saturation cannot exceed 100%') },
        },
      },

      blood_glucose: {
        label: t('vitals.modal.bloodGlucose', 'Blood Glucose'),
        type: 'number',
        unit: t('vitals.units.mgdl', 'mg/dL'),
        placeholder: '100',
        icon: IconDropletFilled,
        min: 20,
        max: 800,
        step: 1,
        validation: {
          min: { value: 20, message: t('vitals.form.validation.bloodGlucoseMin', 'Blood glucose must be at least 20 mg/dL') },
          max: { value: 800, message: t('vitals.form.validation.bloodGlucoseMax', 'Blood glucose cannot exceed 800 mg/dL') },
        },
      },
      a1c: {
        label: t('vitals.modal.a1c', 'A1C'),
        type: 'number',
        unit: '%',
        placeholder: '5.7',
        icon: IconDropletFilled,
        min: 0,
        max: 20,
        step: 0.1,
        validation: {
          min: { value: 0, message: t('vitals.form.validation.a1cMin', 'A1C must be at least 0%') },
          max: { value: 20, message: t('vitals.form.validation.a1cMax', 'A1C cannot exceed 20%') },
        },
      },
      pain_scale: {
        label: t('vitals.modal.painScale', 'Pain Scale'),
        type: 'number',
        unit: t('vitals.form.painScaleUnit', '(0-10)'),
        placeholder: '0',
        icon: IconMoodSad,
        min: 0,
        max: 10,
        step: 1,
        validation: {
          min: { value: 0, message: t('vitals.form.validation.painScaleMin', 'Pain scale must be at least 0') },
          max: { value: 10, message: t('vitals.form.validation.painScaleMax', 'Pain scale cannot exceed 10') },
        },
      },
      location: {
        label: t('vitals.form.measurementLocation', 'Measurement Location'),
        type: 'select',
        placeholder: t('vitals.form.locationPlaceholder', 'Where were these readings taken?'),
        icon: IconMapPin,
        options: [
          { value: 'home', label: t('vitals.form.locations.home', 'Home') },
          { value: 'clinic', label: t('vitals.form.locations.clinic', 'Clinic') },
          { value: 'hospital', label: t('vitals.form.locations.hospital', 'Hospital') },
          { value: 'urgent_care', label: t('vitals.form.locations.urgentCare', 'Urgent Care') },
          { value: 'pharmacy', label: t('vitals.form.locations.pharmacy', 'Pharmacy') },
          { value: 'ambulatory', label: t('vitals.form.locations.ambulatory', 'Ambulatory Care') },
          { value: 'other', label: t('vitals.form.locations.other', 'Other') },
        ],
      },
      device_used: {
        label: t('vitals.form.deviceUsed', 'Device/Equipment Used'),
        type: 'text',
        placeholder: t('vitals.form.devicePlaceholder', 'e.g., Digital BP monitor, Thermometer model...'),
        icon: IconDevices,
        validation: {
          maxLength: {
            value: 100,
            message: t('vitals.form.validation.deviceMaxLength', 'Device name cannot exceed 100 characters'),
          },
        },
      },
      notes: {
        label: t('common.fields.notes.label', 'Notes'),
        type: 'textarea',
        placeholder: t('vitals.form.notesPlaceholder', 'Additional notes about the vital signs measurement...'),
        icon: IconNotes,
        rows: 3,
        validation: {
          maxLength: {
            value: 1000,
            message: t('vitals.form.validation.notesMaxLength', 'Notes cannot exceed 1000 characters'),
          },
        },
      },
    };
  }, [unitSystem, t]);

  // Form state
  const [formData, setFormData] = useState({
    patient_id: patientId || '',
    practitioner_id: practitionerId || null,
    recorded_date: new Date(),
    systolic_bp: '',
    diastolic_bp: '',
    heart_rate: '',
    temperature: '',
    weight: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    blood_glucose: '',
    a1c: '',
    pain_scale: '',
    location: '',
    device_used: '',
    notes: '', // Ensure notes is always a string, never null
  });

  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [touchedFields, setTouchedFields] = useState(new Set());
  // State for manual datetime text input (for copy-paste support)
  // Initialize with current datetime formatted for new records
  const [manualDateTimeText, setManualDateTimeText] = useState(() =>
    formatDateTimeForInput(new Date(), false)
  );
  const [manualDateTimeError, setManualDateTimeError] = useState(null);
  const [datePickerOpened, setDatePickerOpened] = useState(false);

  // Get height from patient profile
  const patientHeight = useMemo(() => {
    return currentPatient?.height || null;
  }, [currentPatient?.height]);

  // Initialize form data when editing
  useEffect(() => {
    if (vitals && isEdit) {
      const recordedDate = vitals.recorded_date
        ? new Date(vitals.recorded_date)
        : new Date();

      setFormData({
        patient_id: vitals.patient_id || patientId || '',
        practitioner_id: vitals.practitioner_id || practitionerId || null,
        recorded_date: recordedDate,
        systolic_bp: vitals.systolic_bp || '',
        diastolic_bp: vitals.diastolic_bp || '',
        heart_rate: vitals.heart_rate || '',
        // Convert stored imperial values to display units
        temperature: vitals.temperature
          ? convertForDisplay(vitals.temperature, 'temperature', unitSystem)
          : '',
        weight: vitals.weight
          ? convertForDisplay(vitals.weight, 'weight', unitSystem)
          : '',
        respiratory_rate: vitals.respiratory_rate || '',
        oxygen_saturation: vitals.oxygen_saturation || '',
        blood_glucose: vitals.blood_glucose || '',
        a1c: vitals.a1c || '',
        pain_scale: vitals.pain_scale || '',
        location: vitals.location || '',
        device_used: vitals.device_used || '',
        notes: vitals.notes || '', // Ensure notes is always a string, never null
      });

      // Sync manual datetime text input
      setManualDateTimeText(formatDateTimeForInput(recordedDate, false));
    }
  }, [vitals, isEdit, patientId, practitionerId]);

  // Calculated values
  const calculatedBMI = useMemo(() => {
    if (formData.weight && patientHeight) {
      // Convert weight to imperial for BMI calculation (BMI service expects imperial units)
      const weightInImperial = convertForStorage(
        parseFloat(formData.weight),
        'weight',
        unitSystem
      );
      return vitalsService.calculateBMI(
        weightInImperial,
        parseFloat(patientHeight)
      );
    }
    return null;
  }, [formData.weight, patientHeight, unitSystem]);

  // Field validation
  const validateField = useCallback((fieldName, value) => {
    const config = FIELD_CONFIGS[fieldName];
    if (!config || !config.validation) return null;

    const validation = config.validation;

    // Required validation
    if (validation.required && (!value || value.toString().trim() === '')) {
      return validation.required;
    }

    // Skip other validations if field is empty (and not required)
    if (!value || value.toString().trim() === '') return null;

    // Numeric validations
    if (config.type === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return tErrors('form.mustBeValidNumber');

      if (validation.min && numValue < validation.min.value) {
        return validation.min.message;
      }
      if (validation.max && numValue > validation.max.value) {
        return validation.max.message;
      }
    }

    // Text length validations
    if (validation.maxLength && value.length > validation.maxLength.value) {
      return validation.maxLength.message;
    }

    // Custom validation
    if (validation.custom) {
      return validation.custom(value);
    }

    return null;
  }, []);

  // Real-time validation
  const validateForm = useCallback(() => {
    const newErrors = {};

    Object.keys(FIELD_CONFIGS).forEach(fieldName => {
      const error = validateField(fieldName, formData[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // Validate on form change
  useEffect(() => {
    if (touchedFields.size > 0) {
      validateForm();
    }
  }, [formData, validateForm, touchedFields]);

  // Handle input changes
  const handleInputChange = useCallback((fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value,
    }));

    // Mark field as touched
    setTouchedFields(prev => new Set([...prev, fieldName]));

    // Sync manual text input when DateTimePicker changes
    if (fieldName === 'recorded_date' && value instanceof Date) {
      setManualDateTimeText(formatDateTimeForInput(value, false));
      setManualDateTimeError(null);
    }
  }, []);

  // Handle manual datetime text input (for copy-paste from CSV)
  const handleManualDateTimeChange = useCallback(
    e => {
      const text = e.target.value;
      setManualDateTimeText(text);

      if (!text.trim()) {
        setManualDateTimeError(null);
        return;
      }

      const { date, error } = parseDateTimeString(text);

      if (error) {
        setManualDateTimeError(error);
      } else if (date) {
        // Check if date is in the future
        if (date > new Date()) {
          setManualDateTimeError(t('vitals.form.validation.dateInFuture', 'Date cannot be in the future'));
        } else {
          setManualDateTimeError(null);
          // Update the form data with parsed date
          setFormData(prev => ({
            ...prev,
            recorded_date: date,
          }));
          setTouchedFields(prev => new Set([...prev, 'recorded_date']));
        }
      }
    },
    [t]
  );

  // Handle date selection from the picker popover
  const handleDatePickerSelect = useCallback((val, closePopover = false) => {
    if (val) {
      setFormData(prev => ({
        ...prev,
        recorded_date: val,
      }));
      setManualDateTimeText(formatDateTimeForInput(val, false));
      setManualDateTimeError(null);
      setTouchedFields(prev => new Set([...prev, 'recorded_date']));
    }
    if (closePopover) {
      setDatePickerOpened(false);
    }
  }, []);

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    setTouchedFields(new Set(Object.keys(FIELD_CONFIGS)));

    if (!validateForm()) {
      toast.error('Please correct the form errors');
      return;
    }

    setIsLoading(true);

    try {
      // Process data for API
      const processedData = {
        ...formData,
        recorded_date:
          formData.recorded_date instanceof Date
            ? formData.recorded_date.toISOString()
            : formData.recorded_date,
        // Include patient's height from profile for BMI calculation
        height: patientHeight ? parseFloat(patientHeight) : null,
        // Process numeric fields
        systolic_bp: formData.systolic_bp
          ? parseInt(formData.systolic_bp)
          : null,
        diastolic_bp: formData.diastolic_bp
          ? parseInt(formData.diastolic_bp)
          : null,
        heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : null,
        // Convert display values to storage format (imperial)
        temperature: formData.temperature
          ? convertForStorage(
              parseFloat(formData.temperature),
              'temperature',
              unitSystem
            )
          : null,
        weight: formData.weight
          ? convertForStorage(parseFloat(formData.weight), 'weight', unitSystem)
          : null,
        respiratory_rate: formData.respiratory_rate
          ? parseInt(formData.respiratory_rate)
          : null,
        oxygen_saturation: formData.oxygen_saturation
          ? parseInt(formData.oxygen_saturation)
          : null,
        blood_glucose: formData.blood_glucose
          ? parseFloat(formData.blood_glucose)
          : null,
        a1c: formData.a1c
          ? parseFloat(formData.a1c)
          : null,
        pain_scale: formData.pain_scale ? parseInt(formData.pain_scale) : null,
        // Text fields
        location: formData.location || null,
        device_used: formData.device_used || null,
        notes: formData.notes || null,
      };

      // Remove empty/null values
      Object.keys(processedData).forEach(key => {
        if (
          processedData[key] === '' ||
          processedData[key] === null ||
          processedData[key] === undefined
        ) {
          delete processedData[key];
        }
      });

      await onSave(processedData);
      toast.success(`Vitals ${isEdit ? 'updated' : 'recorded'} successfully!`);
    } catch (error) {
      logger.error('Error saving vitals:', error);
      toast.error(`Failed to ${isEdit ? 'update' : 'save'} vitals`);
    } finally {
      setIsLoading(false);
    }
  };

  // Form steps
  const formSteps = Object.entries(FORM_FIELDS);

  // Render field with Mantine components
  const renderField = fieldName => {
    const config = FIELD_CONFIGS[fieldName];
    const value = formData[fieldName];
    const error = touchedFields.has(fieldName) ? errors[fieldName] : null;
    const IconComponent = config.icon;

    if (config.type === 'date') {
      return (
        <DateInput
          key={fieldName}
          label={config.label}
          placeholder={t('vitals.form.selectDate', 'Select date')}
          value={value}
          onChange={val => handleInputChange(fieldName, val)}
          leftSection={<IconComponent size={16} />}
          required={config.required}
          error={error}
          maxDate={new Date()}
          popoverProps={{ withinPortal: true, zIndex: 3000 }}
        />
      );
    }

    if (config.type === 'datetime') {
      const isValidDate = value instanceof Date && !isNaN(value.getTime());
      const pad = num => String(num).padStart(2, '0');
      const timeValue = isValidDate
        ? `${pad(value.getHours())}:${pad(value.getMinutes())}`
        : '';

      const handleDateSelect = dateStr => {
        if (!dateStr) return;
        const [year, month, day] = dateStr.split('-').map(Number);
        const currentTime = isValidDate ? value : new Date();
        const newDate = new Date(year, month - 1, day, currentTime.getHours(), currentTime.getMinutes(), 0, 0);
        handleDatePickerSelect(newDate);
      };

      const handleTimeChange = e => {
        const timeStr = e.target.value;
        if (!timeStr) return;
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return;
        const now = new Date();
        const newDate = isValidDate ? new Date(value) : new Date(now);
        newDate.setHours(hours, minutes, 0, 0);
        if (newDate <= now) {
          handleDatePickerSelect(newDate);
        } else {
          toast.error(t('vitals.form.validation.timeInFuture', 'Selected time cannot be in the future'));
        }
      };

      const getDateString = date => {
        if (!(date instanceof Date)) return null;
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      };

      const today = new Date();
      const maxDateStr = getDateString(today);

      return (
        <Popover
          key={fieldName}
          opened={datePickerOpened}
          onChange={setDatePickerOpened}
          position="bottom-start"
          withinPortal
        >
          <Popover.Target>
            <TextInput
              label={config.label}
              placeholder={t('vitals.form.pasteDateTimePlaceholder', 'e.g., 07/29/2015 23:58:21')}
              description={t(
                'vitals.form.pasteDateTimeDescription',
                'Type or paste date/time, or click calendar to select'
              )}
              value={manualDateTimeText}
              onChange={handleManualDateTimeChange}
              leftSection={<IconComponent size={16} />}
              rightSection={
                <ActionIcon
                  variant="subtle"
                  onClick={() => setDatePickerOpened(o => !o)}
                  aria-label={t('vitals.form.openCalendar', 'Open calendar')}
                >
                  <IconCalendar size={16} />
                </ActionIcon>
              }
              required={config.required}
              error={manualDateTimeError || error}
            />
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="sm">
              <DatePicker
                value={isValidDate ? getDateString(value) : null}
                onChange={handleDateSelect}
                maxDate={maxDateStr}
              />
              <TimeInput
                label={t('vitals.form.selectTime', 'Time')}
                value={timeValue}
                onChange={handleTimeChange}
              />
              <Button
                size="xs"
                variant="light"
                onClick={() => setDatePickerOpened(false)}
              >
                {t('buttons.done', 'Done')}
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      );
    }

    if (config.type === 'number') {
      return (
        <NumberInput
          key={fieldName}
          label={config.label}
          placeholder={config.placeholder}
          value={value === null || value === undefined ? '' : value}
          onChange={val => handleInputChange(fieldName, val)}
          leftSection={<IconComponent size={16} />}
          rightSection={
            config.unit && (
              <Text size="sm" c="dimmed">
                {config.unit}
              </Text>
            )
          }
          min={config.min}
          max={config.max}
          step={config.step}
          precision={config.step < 1 ? 1 : 0}
          required={config.required}
          error={error}
        />
      );
    }

    if (config.type === 'textarea') {
      return (
        <Textarea
          key={fieldName}
          label={config.label}
          placeholder={config.placeholder}
          value={value || ''} // Ensure value is never null or undefined
          onChange={e => handleInputChange(fieldName, e.target.value)}
          rows={config.rows}
          error={error}
        />
      );
    }

    if (config.type === 'select') {
      return (
        <Select
          key={fieldName}
          label={config.label}
          placeholder={config.placeholder}
          value={value || null}
          onChange={val => handleInputChange(fieldName, val)}
          leftSection={<IconComponent size={16} />}
          data={config.options}
          required={config.required}
          error={error}
          clearable
        />
      );
    }

    return (
      <TextInput
        key={fieldName}
        label={config.label}
        placeholder={config.placeholder}
        value={value || ''} // Ensure value is never null or undefined
        onChange={e => handleInputChange(fieldName, e.target.value)}
        leftSection={<IconComponent size={16} />}
        required={config.required}
        error={error}
      />
    );
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      {isReady && (
        <Alert
          variant="light"
          color="blue"
          icon={<IconInfoCircle size={16} />}
          title={t('vitals.form.timezoneInfo', 'Timezone Information')}
        >
          {t('vitals.form.timesShownIn', 'Times shown in {{timezone}}', { timezone: facilityTimezone })}
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert
          variant="light"
          color="orange"
          icon={<IconAlertTriangle size={16} />}
          title={t('vitals.form.healthAlerts', 'Health Alerts')}
        >
          <Stack gap="xs">
            {warnings.map((warning, index) => (
              <Text key={index} size="sm">
                {warning}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Form Sections */}
          {formSteps.map(([sectionKey, section], index) => {
            const SectionIcon = section.icon;
            return (
              <Paper key={sectionKey} shadow="sm" p="md" radius="md">
                <Stack gap="md">
                  <Group gap="sm">
                    <ActionIcon variant="light" size="md" radius="md">
                      <SectionIcon size={18} />
                    </ActionIcon>
                    <Box>
                      <Title order={4}>{section.title}</Title>
                      {section.description && (
                        <Text size="sm" c="dimmed">
                          {section.description}
                        </Text>
                      )}
                    </Box>
                  </Group>

                  <Grid>
                    {section.fields.map(fieldName => {
                      const isFullWidth = fieldName === 'notes' || fieldName === 'recorded_date';
                      return (
                        <Grid.Col key={fieldName} span={isFullWidth ? 12 : 6}>
                          {renderField(fieldName)}
                        </Grid.Col>
                      );
                    })}
                  </Grid>
                </Stack>
              </Paper>
            );
          })}

          {/* Patient Height Info */}
          {patientHeight ? (
            <Alert
              variant="light"
              color="green"
              icon={<IconUser size={16} />}
              title={t('vitals.form.patientInfo', 'Patient Information')}
            >
              {t('vitals.form.patientHeight', 'Patient Height: {{height}} inches (from profile)', { height: patientHeight })}
            </Alert>
          ) : (
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={16} />}
              title={t('vitals.form.missingPatientInfo', 'Missing Patient Information')}
            >
              {t('vitals.form.heightNotSet', 'Height not set in patient profile - BMI calculation unavailable')}
            </Alert>
          )}

          {/* Calculated Values */}
          {calculatedBMI && (
            <Paper shadow="sm" p="md" radius="md">
              <Stack gap="md">
                <Group gap="sm">
                  <ActionIcon
                    variant="light"
                    size="md"
                    radius="md"
                    color="blue"
                  >
                    <IconTrendingUp size={18} />
                  </ActionIcon>
                  <Title order={4}>{t('vitals.form.calculatedValues', 'Calculated Values')}</Title>
                </Group>

                <Card shadow="xs" p="sm" radius="md" withBorder>
                  <Group justify="space-between">
                    <Text fw={500}>{t('vitals.stats.bmi', 'BMI')}</Text>
                    <Badge size="lg" variant="light" color="blue">
                      {calculatedBMI}
                    </Badge>
                  </Group>
                </Card>
              </Stack>
            </Paper>
          )}

          {/* Form Actions */}
          <Group justify="flex-end" gap="md">
            <Button
              variant="light"
              leftSection={<IconX size={16} />}
              onClick={onCancel}
              disabled={isLoading}
            >
              {t('buttons.cancel', 'Cancel')}
            </Button>

            <Button
              type="submit"
              leftSection={
                isLoading ? (
                  <Loader size={16} />
                ) : (
                  <IconDeviceFloppy size={16} />
                )
              }
              loading={isLoading}
            >
              {isEdit ? t('vitals.form.updateVitals', 'Update Vitals') : t('vitals.form.saveVitals', 'Save Vitals')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};

export default VitalsForm;
