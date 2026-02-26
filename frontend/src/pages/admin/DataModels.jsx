import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
const MODEL_ENRICHMENT = {
  user: { icon: IconUsers, color: 'blue', category: 'System', description: 'System users and administrators' },
  patient: { icon: IconStethoscope, color: 'green', category: 'Core Medical', description: 'Patient demographic and contact information' },
  practitioner: { icon: IconUsers, color: 'cyan', category: 'Healthcare Directory', description: 'Healthcare providers and specialists' },
  pharmacy: { icon: IconBuilding, color: 'violet', category: 'Healthcare Directory', description: 'Pharmacy locations and contact information' },
  medication: { icon: IconPill, color: 'orange', category: 'Medical Records', description: 'Prescribed medications and dosages' },
  lab_result: { icon: IconFlask, color: 'purple', category: 'Medical Records', description: 'Laboratory test results and values' },
  lab_result_file: { icon: IconFileText, color: 'indigo', category: 'Medical Records', description: 'Lab result documents and attachments' },
  vitals: { icon: IconHeart, color: 'red', category: 'Medical Records', description: 'Blood pressure, heart rate, temperature' },
  condition: { icon: IconClipboard, color: 'teal', category: 'Medical Records', description: 'Medical conditions and diagnoses' },
  allergy: { icon: IconAlertTriangle, color: 'yellow', category: 'Medical Records', description: 'Patient allergies and reactions' },
  immunization: { icon: IconVaccine, color: 'lime', category: 'Medical Records', description: 'Vaccination records and schedules' },
  procedure: { icon: IconMicroscope, color: 'pink', category: 'Medical Records', description: 'Medical procedures and operations' },
  treatment: { icon: IconBandage, color: 'grape', category: 'Medical Records', description: 'Treatment plans and therapies' },
  encounter: { icon: IconNotes, color: 'dark', category: 'Medical Records', description: 'Patient visits and appointments' },
  patient_share: { icon: IconUsers, color: 'blue', category: 'Sharing & Access', description: 'Patient data sharing relationships between users' },
  invitation: { icon: IconUsers, color: 'green', category: 'Sharing & Access', description: 'System invitations for sharing and collaboration' },
  family_history_share: { icon: IconUsers, color: 'purple', category: 'Sharing & Access', description: 'Family medical history sharing relationships' },
  emergency_contact: { icon: IconPhone, color: 'red', category: 'Patient Support', description: 'Emergency contact information for patients' },
  insurance: { icon: IconShield, color: 'blue', category: 'Patient Support', description: 'Patient insurance coverage information' },
  family_member: { icon: IconUsers, color: 'green', category: 'Family History', description: 'Family member records for medical history' },
  family_condition: { icon: IconClipboard, color: 'orange', category: 'Family History', description: 'Medical conditions of family members' },
  entity_file: { icon: IconFile, color: 'gray', category: 'File Management', description: 'File attachments for all entity types' },
  injury: { icon: IconFirstAidKit, color: 'red', category: 'Medical Records', description: 'Physical injuries, sprains, fractures, and burns' },
  injury_type: { icon: IconCategory, color: 'orange', category: 'Medical Records', description: 'Reusable injury type definitions for dropdowns' },
  symptom: { icon: IconMoodSick, color: 'yellow', category: 'Medical Records', description: 'Symptom definitions and tracking' },
  symptom_occurrence: { icon: IconMoodSick, color: 'orange', category: 'Medical Records', description: 'Individual symptom episode records' },
  medical_equipment: { icon: IconDeviceDesktop, color: 'cyan', category: 'Medical Records', description: 'Medical devices and equipment prescribed to patients' },
};

const DEFAULT_ENRICHMENT = {
  icon: IconDatabase,
  color: 'gray',
  category: 'Other',
  description: '',
};

const CATEGORIES = [
  'System',
  'Core Medical',
  'Healthcare Directory',
  'Medical Records',
  'Patient Support',
  'Family History',
  'File Management',
  'Sharing & Access',
  'Other',
];

const DataModels = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [filterQuery, setFilterQuery] = useState(urlQuery);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        const DISPLAY_NAMES = {
          user: 'Users', patient: 'Patients', practitioner: 'Practitioners',
          pharmacy: 'Pharmacies', medication: 'Medications', lab_result: 'Lab Results',
          lab_result_file: 'Lab Files', vitals: 'Vital Signs', condition: 'Conditions',
          allergy: 'Allergies', immunization: 'Immunizations', procedure: 'Procedures',
          treatment: 'Treatments', encounter: 'Encounters', patient_share: 'Patient Shares',
          invitation: 'Invitations', family_history_share: 'Family History Shares',
          emergency_contact: 'Emergency Contacts', insurance: 'Insurance',
          family_member: 'Family Members', family_condition: 'Family Conditions',
          entity_file: 'Entity Files',
          injury: 'Injuries', injury_type: 'Injury Types',
          symptom: 'Symptoms', symptom_occurrence: 'Symptom Occurrences',
          medical_equipment: 'Medical Equipment',
        };
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
  }, []);

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
                  Data Models
                </Text>
              </Group>
              <Text c="dimmed" size="md">
                Manage and view all database tables and records
              </Text>
            </div>
          </Group>
        </Card>

        <TextInput
          placeholder="Filter models..."
          leftSection={<IconSearch size={16} />}
          rightSection={
            filterQuery ? (
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setFilterQuery('')}
                aria-label="Clear filter"
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.currentTarget.value)}
          mb="lg"
          aria-label="Filter data models"
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
                Could not load models from server. Showing built-in model list.
              </Alert>
            )}
            <div className="models-content">
              {filteredModels.length === 0 ? (
                <Text c="dimmed" ta="center" mt="xl">
                  No models match &quot;{filterQuery}&quot;
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
