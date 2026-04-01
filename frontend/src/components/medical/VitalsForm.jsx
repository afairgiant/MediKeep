/**
 * VitalsForm Component - Enhanced Version with Mantine UI
 * Modern form for creating and editing patient vital signs with improved UX
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { notifySuccess, notifyError } from '../../utils/notifyTranslated';
import {
  TextInput,
  NumberInput,
  Textarea,
  Button,
  Group,
  Stack,
  Text,
  Alert,
  Grid,
  Badge,
  ActionIcon,
  Box,
  Card,
  Loader,
  Select,
  Popover,
  Tabs,
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
import { parseDateTimeString } from '../../utils/dateUtils';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';

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
  const { t } = useTranslation(['common', 'errors']);
  // Fields locked from editing (e.g., glucose when editing a day with imported CGM data)
  const lockedFields = vitals?._lockedFields || [];
  const { getCurrentTime } = useTimezone();
  const { patient: currentPatient } = useCurrentPatient();
  const { unitSystem, loading: preferencesLoading } = useUserPreferences();
  const {
    formatDateTimeInput,
    dateFormat,
    dateTimePlaceholder,
    dateInputFormat,
  } = useDateFormat();

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
          required: t(
            'vitals.form.validation.dateRequired',
            'Measurement date and time is required'
          ),
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
          min: {
            value: 50,
            message: t(
              'vitals.form.validation.systolicMin',
              'Systolic BP must be at least 50 mmHg'
            ),
          },
          max: {
            value: 300,
            message: t(
              'vitals.form.validation.systolicMax',
              'Systolic BP cannot exceed 300 mmHg'
            ),
          },
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
          min: {
            value: 30,
            message: t(
              'vitals.form.validation.diastolicMin',
              'Diastolic BP must be at least 30 mmHg'
            ),
          },
          max: {
            value: 200,
            message: t(
              'vitals.form.validation.diastolicMax',
              'Diastolic BP cannot exceed 200 mmHg'
            ),
          },
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
          min: {
            value: 30,
            message: t(
              'vitals.form.validation.heartRateMin',
              'Heart rate must be at least 30 BPM'
            ),
          },
          max: {
            value: 250,
            message: t(
              'vitals.form.validation.heartRateMax',
              'Heart rate cannot exceed 250 BPM'
            ),
          },
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
            message: t(
              'vitals.form.validation.temperatureMin',
              'Temperature must be at least {{min}}{{unit}}',
              { min: ranges.temperature.min, unit: labels.temperature }
            ),
          },
          max: {
            value: ranges.temperature.max,
            message: t(
              'vitals.form.validation.temperatureMax',
              'Temperature cannot exceed {{max}}{{unit}}',
              { max: ranges.temperature.max, unit: labels.temperature }
            ),
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
            message: t(
              'vitals.form.validation.weightMin',
              'Weight must be at least {{min}} {{unit}}',
              { min: ranges.weight.min, unit: labels.weight }
            ),
          },
          max: {
            value: ranges.weight.max,
            message: t(
              'vitals.form.validation.weightMax',
              'Weight cannot exceed {{max}} {{unit}}',
              { max: ranges.weight.max, unit: labels.weight }
            ),
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
          min: {
            value: 5,
            message: t(
              'vitals.form.validation.respiratoryRateMin',
              'Respiratory rate must be at least 5/min'
            ),
          },
          max: {
            value: 100,
            message: t(
              'vitals.form.validation.respiratoryRateMax',
              'Respiratory rate cannot exceed 100/min'
            ),
          },
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
          min: {
            value: 50,
            message: t(
              'vitals.form.validation.oxygenMin',
              'Oxygen saturation must be at least 50%'
            ),
          },
          max: {
            value: 100,
            message: t(
              'vitals.form.validation.oxygenMax',
              'Oxygen saturation cannot exceed 100%'
            ),
          },
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
          min: {
            value: 20,
            message: t(
              'vitals.form.validation.bloodGlucoseMin',
              'Blood glucose must be at least 20 mg/dL'
            ),
          },
          max: {
            value: 800,
            message: t(
              'vitals.form.validation.bloodGlucoseMax',
              'Blood glucose cannot exceed 800 mg/dL'
            ),
          },
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
          min: {
            value: 0,
            message: t(
              'vitals.form.validation.a1cMin',
              'A1C must be at least 0%'
            ),
          },
          max: {
            value: 20,
            message: t(
              'vitals.form.validation.a1cMax',
              'A1C cannot exceed 20%'
            ),
          },
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
          min: {
            value: 0,
            message: t(
              'vitals.form.validation.painScaleMin',
              'Pain scale must be at least 0'
            ),
          },
          max: {
            value: 10,
            message: t(
              'vitals.form.validation.painScaleMax',
              'Pain scale cannot exceed 10'
            ),
          },
        },
      },
      location: {
        label: t('vitals.form.measurementLocation', 'Measurement Location'),
        type: 'select',
        placeholder: t(
          'vitals.form.locationPlaceholder',
          'Where were these readings taken?'
        ),
        icon: IconMapPin,
        options: [
          { value: 'home', label: t('vitals.form.locations.home', 'Home') },
          {
            value: 'clinic',
            label: t('vitals.form.locations.clinic', 'Clinic'),
          },
          {
            value: 'hospital',
            label: t('vitals.form.locations.hospital', 'Hospital'),
          },
          {
            value: 'urgent_care',
            label: t('vitals.form.locations.urgentCare', 'Urgent Care'),
          },
          {
            value: 'pharmacy',
            label: t('vitals.form.locations.pharmacy', 'Pharmacy'),
          },
          {
            value: 'ambulatory',
            label: t('vitals.form.locations.ambulatory', 'Ambulatory Care'),
          },
          { value: 'other', label: t('vitals.form.locations.other', 'Other') },
        ],
      },
      device_used: {
        label: t('vitals.form.deviceUsed', 'Device/Equipment Used'),
        type: 'text',
        placeholder: t(
          'vitals.form.devicePlaceholder',
          'e.g., Digital BP monitor, Thermometer model...'
        ),
        icon: IconDevices,
        validation: {
          maxLength: {
            value: 100,
            message: t(
              'vitals.form.validation.deviceMaxLength',
              'Device name cannot exceed 100 characters'
            ),
          },
        },
      },
      notes: {
        label: t('common.fields.notes.label', 'Notes'),
        type: 'textarea',
        placeholder: t(
          'vitals.form.notesPlaceholder',
          'Additional notes about the vital signs measurement...'
        ),
        icon: IconNotes,
        rows: 3,
        validation: {
          maxLength: {
            value: 5000,
            message: t(
              'vitals.form.validation.notesMaxLength',
              'Notes cannot exceed 5000 characters'
            ),
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
    glucose_context: '',
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
  // Initialize empty, will be set by useEffect once hook is ready
  const [manualDateTimeText, setManualDateTimeText] = useState('');
  const [manualDateTimeError, setManualDateTimeError] = useState(null);
  const [datePickerOpened, setDatePickerOpened] = useState(false);
  const [activeTab, setActiveTab] = useState('datetime');

  // Initialize manualDateTimeText with format-aware formatting once hook is ready
  // Re-format when date format preference changes (for new records only)
  useEffect(() => {
    if (!isEdit && formData.recorded_date instanceof Date) {
      setManualDateTimeText(formatDateTimeInput(formData.recorded_date, false));
    }
  }, [isEdit, formData.recorded_date, formatDateTimeInput]);

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
        glucose_context: vitals.glucose_context || '',
        pain_scale: vitals.pain_scale || '',
        location: vitals.location || '',
        device_used: vitals.device_used || '',
        notes: vitals.notes || '',
      });

      // Sync manual datetime text input
      setManualDateTimeText(formatDateTimeInput(recordedDate, false));
    }
  }, [
    vitals,
    isEdit,
    patientId,
    practitionerId,
    unitSystem,
    formatDateTimeInput,
  ]);

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
      if (isNaN(numValue)) return t('errors:form.mustBeValidNumber');

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
  const handleInputChange = useCallback(
    (fieldName, value) => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value,
      }));

      // Mark field as touched
      setTouchedFields(prev => new Set([...prev, fieldName]));

      // Sync manual text input when DateTimePicker changes
      if (fieldName === 'recorded_date' && value instanceof Date) {
        setManualDateTimeText(formatDateTimeInput(value, false));
        setManualDateTimeError(null);
      }
    },
    [formatDateTimeInput]
  );

  // Handle manual datetime text input (for copy-paste from CSV)
  const handleManualDateTimeChange = useCallback(
    e => {
      const text = e.target.value;
      setManualDateTimeText(text);

      if (!text.trim()) {
        setManualDateTimeError(null);
        return;
      }

      const { date, error } = parseDateTimeString(text, dateFormat);

      if (error) {
        setManualDateTimeError(error);
      } else if (date) {
        // Check if date is in the future
        if (date > new Date()) {
          setManualDateTimeError(
            t(
              'vitals.form.validation.dateInFuture',
              'Date cannot be in the future'
            )
          );
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
    [dateFormat, t]
  );

  // Handle date selection from the picker popover
  const handleDatePickerSelect = useCallback(
    (val, closePopover = false) => {
      if (val) {
        setFormData(prev => ({
          ...prev,
          recorded_date: val,
        }));
        setManualDateTimeText(formatDateTimeInput(val, false));
        setManualDateTimeError(null);
        setTouchedFields(prev => new Set([...prev, 'recorded_date']));
      }
      if (closePopover) {
        setDatePickerOpened(false);
      }
    },
    [formatDateTimeInput]
  );

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    setTouchedFields(new Set(Object.keys(FIELD_CONFIGS)));

    if (!validateForm()) {
      notifyError('notifications:toasts.vitals.formErrors');
      return;
    }

    setIsLoading(true);

    try {
      // Process data for API
      const processedData = {
        ...formData,
        // Send as UTC - backend stores UTC, frontend converts back to local for display
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
        a1c: formData.a1c ? parseFloat(formData.a1c) : null,
        glucose_context: formData.glucose_context || null,
        pain_scale: formData.pain_scale ? parseInt(formData.pain_scale) : null,
        // Text fields
        location: formData.location || null,
        device_used: formData.device_used || null,
        notes: formData.notes || null,
      };

      // Edit: normalize empties to null so the backend clears DB columns.
      // Create: strip empties so only provided fields are sent.
      Object.keys(processedData).forEach(key => {
        const value = processedData[key];
        if (value == null || value === '') {
          if (isEdit) {
            processedData[key] = null;
          } else {
            delete processedData[key];
          }
        }
      });

      await onSave(processedData);
      notifySuccess('notifications:toasts.vitals.savedSuccess', {
        interpolation: { action: isEdit ? 'updated' : 'recorded' },
      });
    } catch (error) {
      logger.error('Error saving vitals:', error);
      notifyError('notifications:toasts.vitals.saveFailed', {
        interpolation: { action: isEdit ? 'update' : 'save' },
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          placeholder={dateInputFormat}
          value={value}
          onChange={val => handleInputChange(fieldName, val)}
          valueFormat={dateInputFormat}
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
        const newDate = new Date(
          year,
          month - 1,
          day,
          currentTime.getHours(),
          currentTime.getMinutes(),
          0,
          0
        );
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
          notifyError('vitals.form.validation.timeInFuture');
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
              placeholder={t(
                'vitals.form.dateTimePlaceholder',
                dateTimePlaceholder
              )}
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
      const isLocked = lockedFields.includes(fieldName);
      return (
        <NumberInput
          key={fieldName}
          label={config.label}
          placeholder={config.placeholder}
          value={value == null ? '' : value}
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
          disabled={isLocked}
          description={
            isLocked
              ? t(
                  'vitals.form.lockedByImport',
                  'Managed by device import average'
                )
              : undefined
          }
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
      {/* Health warnings - applies globally */}
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
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="datetime"
                leftSection={<IconCalendar size={16} />}
              >
                {t('vitals.tabs.dateTime', 'Date & Time')}
              </Tabs.Tab>
              <Tabs.Tab value="vitals" leftSection={<IconActivity size={16} />}>
                {t('vitals.tabs.vitalSigns', 'Vital Signs')}
              </Tabs.Tab>
              <Tabs.Tab value="context" leftSection={<IconMapPin size={16} />}>
                {t('vitals.tabs.context', 'Context')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('vitals.tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Date & Time Tab */}
            <Tabs.Panel value="datetime">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>{renderField('recorded_date')}</Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Vital Signs Tab */}
            <Tabs.Panel value="vitals">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={6}>{renderField('heart_rate')}</Grid.Col>
                  <Grid.Col span={6}>{renderField('systolic_bp')}</Grid.Col>
                  <Grid.Col span={6}>{renderField('diastolic_bp')}</Grid.Col>
                  <Grid.Col span={6}>{renderField('temperature')}</Grid.Col>
                  <Grid.Col span={6}>
                    {renderField('respiratory_rate')}
                  </Grid.Col>
                  <Grid.Col span={6}>
                    {renderField('oxygen_saturation')}
                  </Grid.Col>
                  <Grid.Col span={6}>{renderField('blood_glucose')}</Grid.Col>
                  <Grid.Col span={6}>{renderField('a1c')}</Grid.Col>
                  <Grid.Col span={6}>
                    <Select
                      label={t('vitals.modal.glucoseContext', 'Measurement Type')}
                      placeholder={t('vitals.modal.glucoseContextPlaceholder', 'Optional')}
                      value={formData.glucose_context || null}
                      onChange={(val) => handleInputChange('glucose_context', val || '')}
                      data={[
                        { value: 'fasting', label: t('vitals.glucoseContext.fasting', 'Fasting') },
                        { value: 'before_meal', label: t('vitals.glucoseContext.before_meal', 'Before Meal') },
                        { value: 'after_meal', label: t('vitals.glucoseContext.after_meal', 'After Meal') },
                        { value: 'random', label: t('vitals.glucoseContext.random', 'Random') },
                      ]}
                      leftSection={<IconDropletFilled size={16} />}
                      clearable
                      disabled={!formData.blood_glucose}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>{renderField('pain_scale')}</Grid.Col>
                  <Grid.Col span={6}>{renderField('weight')}</Grid.Col>
                </Grid>
                {patientHeight ? (
                  <Alert
                    variant="light"
                    color="green"
                    icon={<IconUser size={16} />}
                    title={t('vitals.form.patientInfo', 'Patient Information')}
                    mt="md"
                  >
                    {t(
                      'vitals.form.patientHeight',
                      'Patient Height: {{height}} inches (from profile)',
                      { height: patientHeight }
                    )}
                  </Alert>
                ) : (
                  <Alert
                    variant="light"
                    color="orange"
                    icon={<IconAlertTriangle size={16} />}
                    title={t(
                      'vitals.form.missingPatientInfo',
                      'Missing Patient Information'
                    )}
                    mt="md"
                  >
                    {t(
                      'vitals.form.heightNotSet',
                      'Height not set in patient profile - BMI calculation unavailable'
                    )}
                  </Alert>
                )}
                {calculatedBMI && (
                  <Card shadow="xs" p="sm" radius="md" withBorder mt="md">
                    <Group justify="space-between">
                      <Text fw={500}>{t('vitals.stats.bmi', 'BMI')}</Text>
                      <Badge size="lg" variant="light" color="blue">
                        {calculatedBMI}
                      </Badge>
                    </Group>
                  </Card>
                )}
              </Box>
            </Tabs.Panel>

            {/* Context Tab */}
            <Tabs.Panel value="context">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>{renderField('location')}</Grid.Col>
                  <Grid.Col span={12}>{renderField('device_used')}</Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>{renderField('notes')}</Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions - outside tabs */}
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
              {isEdit
                ? t('vitals.form.updateVitals', 'Update Vitals')
                : t('vitals.form.saveVitals', 'Save Vitals')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};

export default VitalsForm;
