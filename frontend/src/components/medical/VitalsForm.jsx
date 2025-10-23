/**
 * VitalsForm Component - Enhanced Version with Mantine UI
 * Modern form for creating and editing patient vital signs with improved UX
 */
import logger from '../../services/logger';


import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { DateInput, DateTimePicker } from '@mantine/dates';
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

// Function to get form field configurations based on unit system
const getFormFields = unitSystem => ({
  basic: {
    title: 'Basic Information',
    icon: IconCalendar,
    fields: ['recorded_date'],
  },
  bloodPressure: {
    title: 'Blood Pressure',
    icon: IconHeart,
    fields: ['systolic_bp', 'diastolic_bp'],
    description: 'Measured in mmHg',
  },
  physical: {
    title: 'Physical Measurements',
    icon: IconWeight,
    fields: ['weight'],
    description: `Weight in ${unitLabels[unitSystem].weightLong}`,
  },
  vitals: {
    title: 'Vital Signs',
    icon: IconActivity,
    fields: [
      'heart_rate',
      'temperature',
      'respiratory_rate',
      'oxygen_saturation',
    ],
    description: 'Core physiological measurements',
  },
  additional: {
    title: 'Additional Measurements',
    icon: IconDropletFilled,
    fields: ['blood_glucose', 'pain_scale'],
    description: 'Supplementary health indicators',
  },
  metadata: {
    title: 'Recording Information',
    icon: IconMapPin,
    fields: ['location', 'device_used'],
    description: 'Context about the measurements',
  },
  notes: {
    title: 'Additional Information',
    icon: IconNotes,
    fields: ['notes'],
  },
});

// Function to get field configurations based on unit system
const getFieldConfigs = unitSystem => {
  const ranges = validationRanges[unitSystem];
  const labels = unitLabels[unitSystem];

  return {
    recorded_date: {
      label: 'Measurement Date & Time',
      type: 'datetime',
      required: true,
      icon: IconCalendar,
      validation: {
        required: 'Measurement date and time is required',
        custom: value => {
          const result = validateDateTime(value, 'Recorded Date');
          return result.isValid ? null : result.error;
        },
      },
    },
    systolic_bp: {
      label: 'Systolic BP',
      type: 'number',
      unit: 'mmHg',
      placeholder: '120',
      icon: IconHeart,
      min: 50,
      max: 300,
      step: 1,
      validation: {
        min: { value: 50, message: 'Systolic BP must be at least 50 mmHg' },
        max: { value: 300, message: 'Systolic BP cannot exceed 300 mmHg' },
      },
    },
    diastolic_bp: {
      label: 'Diastolic BP',
      type: 'number',
      unit: 'mmHg',
      placeholder: '80',
      icon: IconHeart,
      min: 30,
      max: 200,
      step: 1,
      validation: {
        min: { value: 30, message: 'Diastolic BP must be at least 30 mmHg' },
        max: { value: 200, message: 'Diastolic BP cannot exceed 200 mmHg' },
      },
    },
    heart_rate: {
      label: 'Heart Rate',
      type: 'number',
      unit: 'BPM',
      placeholder: '72',
      icon: IconActivity,
      min: 30,
      max: 250,
      step: 1,
      validation: {
        min: { value: 30, message: 'Heart rate must be at least 30 BPM' },
        max: { value: 250, message: 'Heart rate cannot exceed 250 BPM' },
      },
    },
    temperature: {
      label: 'Temperature',
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
          message: `Temperature must be at least ${ranges.temperature.min}${labels.temperature}`,
        },
        max: {
          value: ranges.temperature.max,
          message: `Temperature cannot exceed ${ranges.temperature.max}${labels.temperature}`,
        },
      },
    },
    weight: {
      label: 'Weight',
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
          message: `Weight must be at least ${ranges.weight.min} ${labels.weight}`,
        },
        max: {
          value: ranges.weight.max,
          message: `Weight cannot exceed ${ranges.weight.max} ${labels.weight}`,
        },
      },
    },
    respiratory_rate: {
      label: 'Respiratory Rate',
      type: 'number',
      unit: '/min',
      placeholder: '16',
      icon: IconLungs,
      min: 5,
      max: 100,
      step: 1,
      validation: {
        min: { value: 5, message: 'Respiratory rate must be at least 5/min' },
        max: { value: 100, message: 'Respiratory rate cannot exceed 100/min' },
      },
    },
    oxygen_saturation: {
      label: 'Oxygen Saturation',
      type: 'number',
      unit: '%',
      placeholder: '98',
      icon: IconDroplet,
      min: 50,
      max: 100,
      step: 1,
      validation: {
        min: { value: 50, message: 'Oxygen saturation must be at least 50%' },
        max: { value: 100, message: 'Oxygen saturation cannot exceed 100%' },
      },
    },

    blood_glucose: {
      label: 'Blood Glucose',
      type: 'number',
      unit: 'mg/dL',
      placeholder: '100',
      icon: IconDropletFilled,
      min: 20,
      max: 800,
      step: 1,
      validation: {
        min: { value: 20, message: 'Blood glucose must be at least 20 mg/dL' },
        max: { value: 800, message: 'Blood glucose cannot exceed 800 mg/dL' },
      },
    },
    pain_scale: {
      label: 'Pain Scale',
      type: 'number',
      unit: '(0-10)',
      placeholder: '0',
      icon: IconMoodSad,
      min: 0,
      max: 10,
      step: 1,
      validation: {
        min: { value: 0, message: 'Pain scale must be at least 0' },
        max: { value: 10, message: 'Pain scale cannot exceed 10' },
      },
    },
    location: {
      label: 'Measurement Location',
      type: 'select',
      placeholder: 'Where were these readings taken?',
      icon: IconMapPin,
      options: [
        { value: 'home', label: 'Home' },
        { value: 'clinic', label: 'Clinic' },
        { value: 'hospital', label: 'Hospital' },
        { value: 'urgent_care', label: 'Urgent Care' },
        { value: 'pharmacy', label: 'Pharmacy' },
        { value: 'ambulatory', label: 'Ambulatory Care' },
        { value: 'other', label: 'Other' },
      ],
    },
    device_used: {
      label: 'Device/Equipment Used',
      type: 'text',
      placeholder: 'e.g., Digital BP monitor, Thermometer model...',
      icon: IconDevices,
      validation: {
        maxLength: {
          value: 100,
          message: 'Device name cannot exceed 100 characters',
        },
      },
    },
    notes: {
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Additional notes about the vital signs measurement...',
      icon: IconNotes,
      rows: 3,
      validation: {
        maxLength: {
          value: 1000,
          message: 'Notes cannot exceed 1000 characters',
        },
      },
    },
  };
};

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
  const { isReady, getCurrentTime, facilityTimezone } = useTimezone();
  const { patient: currentPatient } = useCurrentPatient();
  const { unitSystem, loading: preferencesLoading } = useUserPreferences();

  // Generate dynamic configs based on user's unit system
  const FORM_FIELDS = useMemo(() => getFormFields(unitSystem), [unitSystem]);
  const FIELD_CONFIGS = useMemo(
    () => getFieldConfigs(unitSystem),
    [unitSystem]
  );

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
    pain_scale: '',
    location: '',
    device_used: '',
    notes: '', // Ensure notes is always a string, never null
  });

  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [touchedFields, setTouchedFields] = useState(new Set());

  // Get height from patient profile
  const patientHeight = useMemo(() => {
    return currentPatient?.height || null;
  }, [currentPatient?.height]);

  // Initialize form data when editing
  useEffect(() => {
    if (vitals && isEdit) {
      setFormData({
        patient_id: vitals.patient_id || patientId || '',
        practitioner_id: vitals.practitioner_id || practitionerId || null,
        recorded_date: vitals.recorded_date
          ? new Date(vitals.recorded_date)
          : new Date(),
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
        pain_scale: vitals.pain_scale || '',
        location: vitals.location || '',
        device_used: vitals.device_used || '',
        notes: vitals.notes || '', // Ensure notes is always a string, never null
      });
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
      if (isNaN(numValue)) return 'Must be a valid number';

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
          placeholder="Select date"
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
      return (
        <DateTimePicker
          key={fieldName}
          label={config.label}
          placeholder="Select date and time"
          value={value}
          onChange={val => handleInputChange(fieldName, val)}
          leftSection={<IconComponent size={16} />}
          required={config.required}
          error={error}
          maxDate={new Date()}
          withSeconds={false}
          clearable
        />
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
          title="Timezone Information"
        >
          Times shown in {facilityTimezone}
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert
          variant="light"
          color="orange"
          icon={<IconAlertTriangle size={16} />}
          title="Health Alerts"
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
                    {section.fields.map(fieldName => (
                      <Grid.Col
                        key={fieldName}
                        span={
                          fieldName === 'notes'
                            ? 12
                            : fieldName === 'recorded_date'
                              ? 12
                              : 6
                        }
                      >
                        {renderField(fieldName)}
                      </Grid.Col>
                    ))}
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
              title="Patient Information"
            >
              Patient Height: {patientHeight} inches (from profile)
            </Alert>
          ) : (
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={16} />}
              title="Missing Patient Information"
            >
              Height not set in patient profile - BMI calculation unavailable
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
                  <Title order={4}>Calculated Values</Title>
                </Group>

                <Card shadow="xs" p="sm" radius="md" withBorder>
                  <Group justify="space-between">
                    <Text fw={500}>BMI</Text>
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
              Cancel
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
              {isEdit ? 'Update Vitals' : 'Save Vitals'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};

export default VitalsForm;
