import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Grid,
  Text,
  Group,
  ActionIcon,
  Badge,
  Paper,
  useMantineColorScheme,
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
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import './DataModels.css';

const DataModels = () => {
  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();

  const models = [
    {
      name: 'user',
      display: 'Users',
      icon: IconUsers,
      description: 'System users and administrators',
      color: 'blue',
      category: 'System',
    },
    {
      name: 'patient',
      display: 'Patients',
      icon: IconStethoscope,
      description: 'Patient demographic and contact information',
      color: 'green',
      category: 'Core Medical',
    },
    {
      name: 'practitioner',
      display: 'Practitioners',
      icon: IconUsers,
      description: 'Healthcare providers and specialists',
      color: 'cyan',
      category: 'Healthcare Directory',
    },
    {
      name: 'pharmacy',
      display: 'Pharmacies',
      icon: IconBuilding,
      description: 'Pharmacy locations and contact information',
      color: 'violet',
      category: 'Healthcare Directory',
    },
    {
      name: 'medication',
      display: 'Medications',
      icon: IconPill,
      description: 'Prescribed medications and dosages',
      color: 'orange',
      category: 'Medical Records',
    },
    {
      name: 'lab_result',
      display: 'Lab Results',
      icon: IconFlask,
      description: 'Laboratory test results and values',
      color: 'purple',
      category: 'Medical Records',
    },
    {
      name: 'lab_result_file',
      display: 'Lab Files',
      icon: IconFileText,
      description: 'Lab result documents and attachments',
      color: 'indigo',
      category: 'Medical Records',
    },
    {
      name: 'vitals',
      display: 'Vital Signs',
      icon: IconHeart,
      description: 'Blood pressure, heart rate, temperature',
      color: 'red',
      category: 'Medical Records',
    },
    {
      name: 'condition',
      display: 'Conditions',
      icon: IconClipboard,
      description: 'Medical conditions and diagnoses',
      color: 'teal',
      category: 'Medical Records',
    },
    {
      name: 'allergy',
      display: 'Allergies',
      icon: IconAlertTriangle,
      description: 'Patient allergies and reactions',
      color: 'yellow',
      category: 'Medical Records',
    },
    {
      name: 'immunization',
      display: 'Immunizations',
      icon: IconVaccine,
      description: 'Vaccination records and schedules',
      color: 'lime',
      category: 'Medical Records',
    },
    {
      name: 'procedure',
      display: 'Procedures',
      icon: IconMicroscope,
      description: 'Medical procedures and operations',
      color: 'pink',
      category: 'Medical Records',
    },
    {
      name: 'treatment',
      display: 'Treatments',
      icon: IconBandage,
      description: 'Treatment plans and therapies',
      color: 'grape',
      category: 'Medical Records',
    },
    {
      name: 'encounter',
      display: 'Encounters',
      icon: IconNotes,
      description: 'Patient visits and appointments',
      color: 'dark',
      category: 'Medical Records',
    },
    {
      name: 'patient_share',
      display: 'Patient Shares',
      icon: IconUsers,
      description: 'Patient data sharing relationships between users',
      color: 'blue',
      category: 'Sharing & Access',
    },
    {
      name: 'invitation',
      display: 'Invitations',
      icon: IconUsers,
      description: 'System invitations for sharing and collaboration',
      color: 'green',
      category: 'Sharing & Access',
    },
    {
      name: 'family_history_share',
      display: 'Family History Shares',
      icon: IconUsers,
      description: 'Family medical history sharing relationships',
      color: 'purple',
      category: 'Sharing & Access',
    },
    {
      name: 'emergency_contact',
      display: 'Emergency Contacts',
      icon: IconPhone,
      description: 'Emergency contact information for patients',
      color: 'red',
      category: 'Patient Support',
    },
    {
      name: 'insurance',
      display: 'Insurance',
      icon: IconShield,
      description: 'Patient insurance coverage information',
      color: 'blue',
      category: 'Patient Support',
    },
    {
      name: 'family_member',
      display: 'Family Members',
      icon: IconUsers,
      description: 'Family member records for medical history',
      color: 'green',
      category: 'Family History',
    },
    {
      name: 'family_condition',
      display: 'Family Conditions',
      icon: IconClipboard,
      description: 'Medical conditions of family members',
      color: 'orange',
      category: 'Family History',
    },
    {
      name: 'entity_file',
      display: 'Entity Files',
      icon: IconFile,
      description: 'File attachments for all entity types',
      color: 'gray',
      category: 'File Management',
    },
  ];

  const categories = [
    'System',
    'Core Medical',
    'Healthcare Directory',
    'Medical Records',
    'Patient Support',
    'Family History',
    'File Management',
    'Sharing & Access',
  ];

  const handleModelClick = modelName => {
    navigate(`/admin/models/${modelName}`);
  };

  const renderModelsByCategory = category => {
    const categoryModels = models.filter(model => model.category === category);

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
        <div
          className="page-header"
          style={{
            backgroundColor: colorScheme === 'dark' ? '#1a1b1e' : 'white',
            borderColor: colorScheme === 'dark' ? '#373A40' : '#dee2e6',
            border: '1px solid',
          }}
        >
          <Group justify="space-between" align="flex-start" mb="xl">
            <div>
              <Text size="xl" fw={700} mb="xs">
                <IconDatabase
                  size={32}
                  style={{ verticalAlign: 'middle', marginRight: '8px' }}
                />
                Data Models
              </Text>
              <Text c="dimmed" size="md">
                Manage and view all database tables and records
              </Text>
            </div>
          </Group>
        </div>

        <div className="models-content">
          {categories.map(category => renderModelsByCategory(category))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default DataModels;
