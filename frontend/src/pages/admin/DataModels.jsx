import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Grid,
  Text,
  TextInput,
  Group,
  ActionIcon,
  Badge,
  Alert,
  Center,
  Loader,
} from '@mantine/core';
import {
  IconDatabase,
  IconUsers,
  IconStethoscope,
  IconPill,
  IconFlask,
  IconFileText,
  IconHeart,
  IconClipboard,
  IconAlertTriangle,
  IconVaccine,
  IconMicroscope,
  IconBandage,
  IconNotes,
  IconBuilding,
  IconPhone,
  IconShield,
  IconFile,
  IconFirstAidKit,
  IconCategory,
  IconMoodSick,
  IconDeviceDesktop,
  IconSearch,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import logger from '../../services/logger';
import './DataModels.css';

// Enrichment data keyed by model name — provides icons, colors, categories for known models
const getModelEnrichment = (t) => ({
  user: { icon: IconUsers, color: 'blue', category: t('dataModels.categories.system', 'System'), description: t('dataModels.descriptions.user', 'System users and administrators') },
  patient: { icon: IconStethoscope, color: 'green', category: t('dataModels.categories.coreMedical', 'Core Medical'), description: t('dataModels.descriptions.patient', 'Patient demographic and contact information') },
  practitioner: { icon: IconUsers, color: 'cyan', category: t('dataModels.categories.healthcareDirectory', 'Healthcare Directory'), description: t('dataModels.descriptions.practitioner', 'Healthcare providers and specialists') },
  pharmacy: { icon: IconBuilding, color: 'violet', category: t('dataModels.categories.healthcareDirectory', 'Healthcare Directory'), description: t('dataModels.descriptions.pharmacy', 'Pharmacy locations and contact information') },
  medication: { icon: IconPill, color: 'orange', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.medication', 'Prescribed medications and dosages') },
  lab_result: { icon: IconFlask, color: 'purple', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.lab_result', 'Laboratory test results and values') },
  lab_result_file: { icon: IconFileText, color: 'indigo', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.lab_result_file', 'Lab result documents and attachments') },
  vitals: { icon: IconHeart, color: 'red', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.vitals', 'Blood pressure, heart rate, temperature') },
  condition: { icon: IconClipboard, color: 'teal', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.condition', 'Medical conditions and diagnoses') },
  allergy: { icon: IconAlertTriangle, color: 'yellow', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.allergy', 'Patient allergies and reactions') },
  immunization: { icon: IconVaccine, color: 'lime', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.immunization', 'Vaccination records and schedules') },
  procedure: { icon: IconMicroscope, color: 'pink', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.procedure', 'Medical procedures and operations') },
  treatment: { icon: IconBandage, color: 'grape', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.treatment', 'Treatment plans and therapies') },
  encounter: { icon: IconNotes, color: 'dark', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.encounter', 'Patient visits and appointments') },
  patient_share: { icon: IconUsers, color: 'blue', category: t('dataModels.categories.sharingAccess', 'Sharing & Access'), description: t('dataModels.descriptions.patient_share', 'Patient data sharing relationships between users') },
  invitation: { icon: IconUsers, color: 'green', category: t('dataModels.categories.sharingAccess', 'Sharing & Access'), description: t('dataModels.descriptions.invitation', 'System invitations for sharing and collaboration') },
  family_history_share: { icon: IconUsers, color: 'purple', category: t('dataModels.categories.sharingAccess', 'Sharing & Access'), description: t('dataModels.descriptions.family_history_share', 'Family medical history sharing relationships') },
  emergency_contact: { icon: IconPhone, color: 'red', category: t('dataModels.categories.patientSupport', 'Patient Support'), description: t('dataModels.descriptions.emergency_contact', 'Emergency contact information for patients') },
  insurance: { icon: IconShield, color: 'blue', category: t('dataModels.categories.patientSupport', 'Patient Support'), description: t('dataModels.descriptions.insurance', 'Patient insurance coverage information') },
  family_member: { icon: IconUsers, color: 'green', category: t('dataModels.categories.familyHistory', 'Family History'), description: t('dataModels.descriptions.family_member', 'Family member records for medical history') },
  family_condition: { icon: IconClipboard, color: 'orange', category: t('dataModels.categories.familyHistory', 'Family History'), description: t('dataModels.descriptions.family_condition', 'Medical conditions of family members') },
  entity_file: { icon: IconFile, color: 'gray', category: t('dataModels.categories.fileManagement', 'File Management'), description: t('dataModels.descriptions.entity_file', 'File attachments for all entity types') },
  injury: { icon: IconFirstAidKit, color: 'red', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.injury', 'Physical injuries, sprains, fractures, and burns') },
  injury_type: { icon: IconCategory, color: 'orange', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.injury_type', 'Reusable injury type definitions for dropdowns') },
  symptom: { icon: IconMoodSick, color: 'yellow', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.symptom', 'Symptom definitions and tracking') },
  symptom_occurrence: { icon: IconMoodSick, color: 'orange', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.symptom_occurrence', 'Individual symptom episode records') },
  medical_equipment: { icon: IconDeviceDesktop, color: 'cyan', category: t('dataModels.categories.medicalRecords', 'Medical Records'), description: t('dataModels.descriptions.medical_equipment', 'Medical devices and equipment prescribed to patients') },
});

const DEFAULT_ENRICHMENT = {
  icon: IconDatabase,
  color: 'gray',
  category: 'Other',
  description: '',
};

const getCategories = (t) => [
  t('dataModels.categories.system', 'System'),
  t('dataModels.categories.coreMedical', 'Core Medical'),
  t('dataModels.categories.healthcareDirectory', 'Healthcare Directory'),
  t('dataModels.categories.medicalRecords', 'Medical Records'),
  t('dataModels.categories.patientSupport', 'Patient Support'),
  t('dataModels.categories.familyHistory', 'Family History'),
  t('dataModels.categories.fileManagement', 'File Management'),
  t('dataModels.categories.sharingAccess', 'Sharing & Access'),
  t('dataModels.categories.other', 'Other'),
];

const getDisplayNames = (t) => ({
  user: t('dataModels.descriptions.user', 'Users'),
  patient: t('dataModels.descriptions.patient', 'Patients'),
  practitioner: t('dataModels.descriptions.practitioner', 'Practitioners'),
  pharmacy: t('dataModels.descriptions.pharmacy', 'Pharmacies'),
  medication: t('dataModels.descriptions.medication', 'Medications'),
  lab_result: t('dataModels.descriptions.lab_result', 'Lab Results'),
  lab_result_file: t('dataModels.descriptions.lab_result_file', 'Lab Files'),
  vitals: t('dataModels.descriptions.vitals', 'Vital Signs'),
  condition: t('dataModels.descriptions.condition', 'Conditions'),
  allergy: t('dataModels.descriptions.allergy', 'Allergies'),
  immunization: t('dataModels.descriptions.immunization', 'Immunizations'),
  procedure: t('dataModels.descriptions.procedure', 'Procedures'),
  treatment: t('dataModels.descriptions.treatment', 'Treatments'),
  encounter: t('dataModels.descriptions.encounter', 'Encounters'),
  patient_share: t('dataModels.descriptions.patient_share', 'Patient Shares'),
  invitation: t('dataModels.descriptions.invitation', 'Invitations'),
  family_history_share: t('dataModels.descriptions.family_history_share', 'Family History Shares'),
  emergency_contact: t('dataModels.descriptions.emergency_contact', 'Emergency Contacts'),
  insurance: t('dataModels.descriptions.insurance', 'Insurance'),
  family_member: t('dataModels.descriptions.family_member', 'Family Members'),
  family_condition: t('dataModels.descriptions.family_condition', 'Family Conditions'),
  entity_file: t('dataModels.descriptions.entity_file', 'Entity Files'),
  injury: t('dataModels.descriptions.injury', 'Injuries'),
  injury_type: t('dataModels.descriptions.injury_type', 'Injury Types'),
  symptom: t('dataModels.descriptions.symptom', 'Symptoms'),
  symptom_occurrence: t('dataModels.descriptions.symptom_occurrence', 'Symptom Occurrences'),
  medical_equipment: t('dataModels.descriptions.medical_equipment', 'Medical Equipment'),
});

const DataModels = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('admin');
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [filterQuery, setFilterQuery] = useState(urlQuery);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const MODEL_ENRICHMENT = useMemo(() => getModelEnrichment(t), [t]);
  const CATEGORIES = useMemo(() => getCategories(t), [t]);
  const DISPLAY_NAMES = useMemo(() => getDisplayNames(t), [t]);

  useEffect(() => {
    setFilterQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiModels = await adminApiService.getAvailableModels();

        // Merge API response with enrichment data
        const merged = apiModels.map((apiModel) => {
          const name = apiModel.name || apiModel;
          const displayName = apiModel.display_name || apiModel.verbose_name_plural || name;
          const enrichment = MODEL_ENRICHMENT[name] || DEFAULT_ENRICHMENT;

          return {
            name,
            display: displayName,
            icon: enrichment.icon,
            color: enrichment.color,
            category: enrichment.category,
            description: apiModel.description || enrichment.description,
          };
        });

        setModels(merged);
      } catch (err) {
        logger.error('data_models_load_error', 'Error loading models from API', {
          component: 'DataModels',
          error: err.message,
        });
        setError(err.message);

        // Fallback to hardcoded enrichment list with known display names
        const fallbackModels = Object.entries(MODEL_ENRICHMENT).map(([name, enrichment]) => ({
          name,
          display: DISPLAY_NAMES[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          icon: enrichment.icon,
          color: enrichment.color,
          category: enrichment.category,
          description: enrichment.description,
        }));
        setModels(fallbackModels);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [MODEL_ENRICHMENT, DISPLAY_NAMES]);

  const filterLower = filterQuery.trim().toLowerCase();
  const filteredModels = filterLower
    ? models.filter(
        (model) =>
          model.display.toLowerCase().includes(filterLower) ||
          model.name.toLowerCase().includes(filterLower) ||
          model.description.toLowerCase().includes(filterLower) ||
          model.category.toLowerCase().includes(filterLower)
      )
    : models;

  const handleModelClick = modelName => {
    navigate(`/admin/models/${modelName}`);
  };

  const handleModelKeyDown = (event, modelName) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(`/admin/models/${modelName}`);
    }
  };

  const renderModelsByCategory = category => {
    const categoryModels = filteredModels.filter(model => model.category === category);
    if (categoryModels.length === 0) return null;

    return (
      <div key={category} className="category-section">
        <Text size="lg" fw={600} mb="md" c="dimmed">
          {category}
        </Text>
        <Grid>
          {categoryModels.map(model => {
            const IconComponent = model.icon;
            return (
              <Grid.Col
                key={model.name}
                span={{ base: 12, sm: 6, md: 4, lg: 3 }}
              >
                <Card
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  withBorder
                  className="model-card"
                  onClick={() => handleModelClick(model.name)}
                  onKeyDown={(e) => handleModelKeyDown(e, model.name)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${model.display} - ${model.description}`}
                  style={{ cursor: 'pointer', height: '100%' }}
                >
                  <Group justify="space-between" mb="xs">
                    <ActionIcon
                      size="xl"
                      variant="light"
                      color={model.color}
                      radius="md"
                    >
                      <IconComponent size={24} />
                    </ActionIcon>
                    <Badge color={model.color} variant="light" size="sm">
                      {model.category}
                    </Badge>
                  </Group>

                  <Text fw={500} size="lg" mb="xs">
                    {model.display}
                  </Text>

                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {model.description}
                  </Text>
                </Card>
              </Grid.Col>
            );
          })}
        </Grid>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="data-models-page">
        <Card shadow="sm" p="xl" mb="xl" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Group align="center" mb="xs">
                <IconDatabase
                  size={32}
                  aria-hidden="true"
                />
                <Text size="xl" fw={700}>
                  {t('dataModels.title', 'Data Models')}
                </Text>
              </Group>
              <Text c="dimmed" size="md">
                {t('dataModels.subtitle', 'Manage and view all database tables and records')}
              </Text>
            </div>
          </Group>
        </Card>

        <TextInput
          placeholder={t('dataModels.filterPlaceholder', 'Filter models...')}
          leftSection={<IconSearch size={16} />}
          rightSection={
            filterQuery ? (
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setFilterQuery('')}
                aria-label={t('dataModels.clearFilter', 'Clear filter')}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.currentTarget.value)}
          mb="lg"
          aria-label={t('dataModels.filterAriaLabel', 'Filter data models')}
        />

        {loading ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : (
          <>
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="yellow"
                variant="light"
                mb="lg"
              >
                {t('dataModels.fallbackWarning', 'Could not load models from server. Showing built-in model list.')}
              </Alert>
            )}
            <div className="models-content">
              {filteredModels.length === 0 ? (
                <Text c="dimmed" ta="center" mt="xl">
                  {t('dataModels.noMatchFilter', { query: filterQuery, defaultValue: `No models match "${filterQuery}"` })}
                </Text>
              ) : (
                CATEGORIES.map(category => renderModelsByCategory(category))
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default DataModels;
