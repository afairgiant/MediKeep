import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Group,
  Text,
  Title,
  Stack,
  Center,
  Badge,
  Grid,
  Card,
  Box,
  Divider,
  Anchor,
  Modal,
  Button,
} from '@mantine/core';
import {
  IconPlus,
  IconShieldCheck,
  IconStar,
} from '@tabler/icons-react';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import { useMedicalData, useDataManagement } from '../../hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { createCardClickHandler } from '../../utils/helpers';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import MantineEmergencyContactForm from '../../components/medical/MantineEmergencyContactForm';
import { useTranslation } from 'react-i18next';
import '../../styles/shared/MedicalPageShared.css';

const EmergencyContacts = () => {
  const { t } = useTranslation('common');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();

  // Standardized data management
  const {
    items: emergencyContacts,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setSuccessMessage,
    setError,
  } = useMedicalData({
    entityName: 'emergency_contact',
    apiMethodsConfig: {
      getAll: signal => apiService.getEmergencyContacts(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientEmergencyContacts(patientId, signal),
      create: (data, signal) => apiService.createEmergencyContact(data, signal),
      update: (id, data, signal) =>
        apiService.updateEmergencyContact(id, data, signal),
      delete: (id, signal, patientId) => apiService.deleteEmergencyContact(id, signal, patientId),
    },
    requiresPatient: true,
  });

  // Standardized filtering and sorting using configuration
  const config = getMedicalPageConfig('emergency_contacts');
  const dataManagement = useDataManagement(emergencyContacts, config);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingContact, setViewingContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    phone_number: '',
    secondary_phone: '',
    email: '',
    is_primary: false,
    is_active: true,
    address: '',
    notes: '',
  });

  const handleAddContact = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      relationship: '',
      phone_number: '',
      secondary_phone: '',
      email: '',
      is_primary: false,
      is_active: true,
      address: '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleViewContact = contact => {
    setViewingContact(contact);
    setShowViewModal(true);
    // Update URL with view parameter
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', contact.id);
    navigate(`${location.pathname}?${searchParams.toString()}`);
  };

  const handleEditContact = contact => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      relationship: contact.relationship || '',
      phone_number: contact.phone_number || '',
      secondary_phone: contact.secondary_phone || '',
      email: contact.email || '',
      is_primary: contact.is_primary || false,
      is_active: contact.is_active !== undefined ? contact.is_active : true,
      address: contact.address || '',
      notes: contact.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingContact(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    navigate(`${location.pathname}?${searchParams.toString()}`);
  };

  const handleDeleteContact = async contactId => {
    const success = await deleteItem(contactId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const contactData = {
      name: formData.name,
      relationship: formData.relationship,
      phone_number: formData.phone_number,
      secondary_phone: formData.secondary_phone || null,
      email: formData.email || null,
      is_primary: formData.is_primary,
      is_active: formData.is_active,
      address: formData.address || null,
      notes: formData.notes || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingContact) {
      success = await updateItem(editingContact.id, contactData);
    } else {
      success = await createItem(contactData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  // URL parameter handling
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && emergencyContacts.length > 0) {
      const contact = emergencyContacts.find(c => c.id.toString() === viewId);
      if (contact) {
        setViewingContact(contact);
        setShowViewModal(true);
      }
    }
  }, [location.search, emergencyContacts]);

  const handleInputChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const filteredContacts = dataManagement.data;

  // Helper function to get relationship icon
  const getRelationshipIcon = relationship => {
    const icons = {
      spouse: '💑',
      partner: '💑',
      parent: '👨‍👩‍👧‍👦',
      child: '👶',
      sibling: '👫',
      grandparent: '👴',
      grandchild: '👶',
      friend: '👥',
      neighbor: '🏠',
      caregiver: '👩‍⚕️',
      guardian: '🛡️',
      other: '👤',
    };
    return icons[relationship] || '👤';
  };

  const getRelationshipColor = relationship => {
    const colors = {
      spouse: 'pink',
      partner: 'pink',
      parent: 'blue',
      child: 'green',
      sibling: 'cyan',
      grandparent: 'orange',
      grandchild: 'lime',
      friend: 'grape',
      neighbor: 'teal',
      caregiver: 'violet',
      guardian: 'indigo',
      other: 'gray',
    };
    return colors[relationship] || 'gray';
  };

  if (loading) {
    return <MedicalPageLoading message={t('emergencyContacts.page.loading')} />;
  }

  return (
    <>
      <Container size="xl" py="md">
      <PageHeader title={t('emergencyContacts.title')} icon="📞" />

      <Stack gap="lg">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={clearError}
        />

        <MedicalPageActions
          primaryAction={{
            label: t('emergencyContacts.actions.addNew'),
            onClick: handleAddContact,
            leftSection: <IconPlus size={16} />,
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Mantine Filter Controls */}
        <MedicalPageFilters dataManagement={dataManagement} config={config} />

        {/* Content */}
          {filteredContacts.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconShieldCheck
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>{t('emergencyContacts.page.noContacts')}</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? t('emergencyContacts.page.filterDescription')
                        : t('emergencyContacts.page.noContactsDescription')}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={filteredContacts}
              columns={{ base: 12, md: 6, lg: 4 }}
              renderCard={(contact) => (
                <Card
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  withBorder
                  className="clickable-card"
                  onClick={createCardClickHandler(handleViewContact, contact)}
                  style={{
                    borderColor: contact.is_primary
                      ? 'var(--mantine-color-yellow-4)'
                      : undefined,
                    borderWidth: contact.is_primary ? '2px' : undefined,
                  }}
                >
                  <Card.Section withBorder inheritPadding py="xs">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text size="lg">
                          {getRelationshipIcon(contact.relationship)}
                        </Text>
                        <Text fw={600} size="lg">
                          {contact.name}
                        </Text>
                      </Group>
                      <Group gap="xs">
                        {contact.is_primary && (
                          <Badge
                            color="yellow"
                            variant="filled"
                            size="sm"
                          >
                            <Group gap="xs">
                              <IconStar size={12} />
                              {t('emergencyContacts.card.primary')}
                            </Group>
                          </Badge>
                        )}
                        <Badge
                          color={contact.is_active ? 'green' : 'gray'}
                          variant="light"
                          size="sm"
                        >
                          {contact.is_active ? t('emergencyContacts.card.active') : t('emergencyContacts.card.inactive')}
                        </Badge>
                      </Group>
                    </Group>
                  </Card.Section>

                  <Stack gap="md" mt="md">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {t('emergencyContacts.card.relationship')}
                      </Text>
                      <Badge
                        color={getRelationshipColor(contact.relationship)}
                        variant="light"
                        size="sm"
                      >
                        {contact.relationship.charAt(0).toUpperCase() +
                          contact.relationship.slice(1)}
                      </Badge>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {t('emergencyContacts.card.phone')}
                      </Text>
                      <Anchor
                        href={`tel:${contact.phone_number}`}
                        size="sm"
                        c="blue"
                      >
                        {contact.phone_number}
                      </Anchor>
                    </Group>

                    {contact.secondary_phone && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          {t('emergencyContacts.card.secondaryPhone')}
                        </Text>
                        <Anchor
                          href={`tel:${contact.secondary_phone}`}
                          size="sm"
                          c="blue"
                        >
                          {contact.secondary_phone}
                        </Anchor>
                      </Group>
                    )}

                    {contact.email && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          {t('emergencyContacts.card.email')}
                        </Text>
                        <Anchor
                          href={`mailto:${contact.email}`}
                          size="sm"
                          c="blue"
                        >
                          {contact.email}
                        </Anchor>
                      </Group>
                    )}

                    {contact.address && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          {t('emergencyContacts.card.address')}
                        </Text>
                        <Text size="sm" fw={500}>
                          {contact.address}
                        </Text>
                      </Group>
                    )}
                  </Stack>

                  {contact.notes && (
                    <Box
                      mt="md"
                      pt="md"
                      style={{
                        borderTop:
                          '1px solid var(--mantine-color-gray-3)',
                      }}
                    >
                      <Text size="sm" c="dimmed" mb="xs">
                        {t('emergencyContacts.card.notes')}
                      </Text>
                      <Text size="sm">
                        {contact.notes}
                      </Text>
                    </Box>
                  )}

                  <Stack gap={0} mt="auto">
                    <Divider />
                    <Group justify="flex-end" gap="xs" pt="sm">
                      <Button
                        variant="filled"
                        size="xs"
                        onClick={() => handleViewContact(contact)}
                      >
                        {t('buttons.view')}
                      </Button>
                      <Button
                        variant="filled"
                        size="xs"
                        onClick={() => handleEditContact(contact)}
                      >
                        {t('buttons.edit')}
                      </Button>
                      <Button
                        variant="filled"
                        color="red"
                        size="xs"
                        onClick={() => handleDeleteContact(contact.id)}
                      >
                        {t('buttons.delete')}
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredContacts}
                columns={[
                  { header: t('emergencyContacts.table.name'), accessor: 'name', priority: 'high', width: 200 },
                  { header: t('emergencyContacts.table.relationship'), accessor: 'relationship', priority: 'high', width: 150 },
                  { header: t('emergencyContacts.table.phone'), accessor: 'phone_number', priority: 'low', width: 150 },
                  { header: t('emergencyContacts.table.email'), accessor: 'email', priority: 'medium', width: 150 },
                  { header: t('emergencyContacts.table.primary'), accessor: 'is_primary', priority: 'high', width: 150 },
                  { header: t('emergencyContacts.table.status'), accessor: 'is_active', priority: 'low', width: 150 }
                ]}
                patientData={currentPatient}
                tableName={t('emergencyContacts.page.tableName')}
                onView={handleViewContact}
                onEdit={handleEditContact}
                onDelete={handleDeleteContact}
                formatters={{
                  name: value => (
                    <Text fw={600} c="blue">
                      {value}
                    </Text>
                  ),
                  relationship: value => (
                    <Badge
                      color={getRelationshipColor(value)}
                      variant="light"
                      size="sm"
                    >
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </Badge>
                  ),
                  phone_number: value =>
                    value ? (
                      <Anchor href={`tel:${value}`} size="sm" c="blue">
                        {value}
                      </Anchor>
                    ) : (
                      '-'
                    ),
                  email: value =>
                    value ? (
                      <Anchor href={`mailto:${value}`} size="sm" c="blue">
                        {value}
                      </Anchor>
                    ) : (
                      '-'
                    ),
                  is_primary: value =>
                    value ? (
                      <Badge color="yellow" variant="filled" size="sm">
                        <Group gap="xs">
                          <IconStar size={12} />
                          {t('emergencyContacts.table.primary')}
                        </Group>
                      </Badge>
                    ) : (
                      '-'
                    ),
                  is_active: value => (
                    <Badge
                      color={value ? 'green' : 'gray'}
                      variant="light"
                      size="sm"
                    >
                      {value ? t('emergencyContacts.card.active') : t('emergencyContacts.card.inactive')}
                    </Badge>
                  ),
                }}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
      </Stack>
      </Container>

      <MantineEmergencyContactForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingContact ? t('emergencyContacts.form.editTitle') : t('emergencyContacts.form.addTitle')
        }
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingContact={editingContact}
      />

      {/* View Modal */}
      <Modal
        opened={showViewModal}
        onClose={handleCloseViewModal}
        title={
          <Group gap="xs">
            <Text size="lg">{t('emergencyContacts.viewModal.icon')}</Text>
            <Text size="lg" fw={600}>
              {t('emergencyContacts.viewModal.title')}
            </Text>
          </Group>
        }
        size="lg"
        centered
        closeOnClickOutside={true}
        closeOnEscape={true}
      >
        {viewingContact && (
          <Stack gap="lg">
            {/* Header with relationship icon and name */}
            <Card withBorder p="md" radius="md">
              <Group gap="md" align="center">
                <Text size="xl">
                  {getRelationshipIcon(viewingContact.relationship)}
                </Text>
                <Stack gap="xs">
                  <Title order={3} c="blue">
                    {viewingContact.name}
                  </Title>
                  <Group gap="xs">
                    <Badge
                      color={getRelationshipColor(viewingContact.relationship)}
                      variant="light"
                      size="sm"
                    >
                      {viewingContact.relationship.charAt(0).toUpperCase() +
                        viewingContact.relationship.slice(1)}
                    </Badge>
                    {viewingContact.is_primary && (
                      <Badge color="yellow" variant="filled" size="sm">
                        <Group gap="xs">
                          <IconStar size={12} />
                          {t('emergencyContacts.card.primary')}
                        </Group>
                      </Badge>
                    )}
                    <Badge
                      color={viewingContact.is_active ? 'green' : 'gray'}
                      variant="light"
                      size="sm"
                    >
                      {viewingContact.is_active ? t('emergencyContacts.card.active') : t('emergencyContacts.card.inactive')}
                    </Badge>
                  </Group>
                </Stack>
              </Group>
            </Card>

            {/* Contact Information */}
            <Card withBorder p="md" radius="md">
              <Title order={4} mb="md">
                {t('emergencyContacts.viewModal.contactInfo')}
              </Title>
              <Grid>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      {t('emergencyContacts.viewModal.primaryPhone')}
                    </Text>
                    <Anchor
                      href={`tel:${viewingContact.phone_number}`}
                      size="md"
                      c="blue"
                      fw={500}
                    >
                      {viewingContact.phone_number}
                    </Anchor>
                  </Stack>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      {t('emergencyContacts.viewModal.secondaryPhone')}
                    </Text>
                    {viewingContact.secondary_phone ? (
                      <Anchor
                        href={`tel:${viewingContact.secondary_phone}`}
                        size="md"
                        c="blue"
                        fw={500}
                      >
                        {viewingContact.secondary_phone}
                      </Anchor>
                    ) : (
                      <Text size="md" c="dimmed">
                        {t('labels.notSpecified')}
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      {t('emergencyContacts.viewModal.emailAddress')}
                    </Text>
                    {viewingContact.email ? (
                      <Anchor
                        href={`mailto:${viewingContact.email}`}
                        size="md"
                        c="blue"
                        fw={500}
                      >
                        {viewingContact.email}
                      </Anchor>
                    ) : (
                      <Text size="md" c="dimmed">
                        {t('labels.notSpecified')}
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={12}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      {t('emergencyContacts.viewModal.address')}
                    </Text>
                    {viewingContact.address ? (
                      <Text size="md" fw={500}>
                        {viewingContact.address}
                      </Text>
                    ) : (
                      <Text size="md" c="dimmed">
                        {t('labels.notSpecified')}
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>
              </Grid>
            </Card>

            {/* Notes */}
            <Card withBorder p="md" radius="md">
              <Title order={4} mb="md">
                {t('emergencyContacts.viewModal.notes')}
              </Title>
              {viewingContact.notes ? (
                <Text size="md">
                  {viewingContact.notes}
                </Text>
              ) : (
                <Text size="md" c="dimmed">
                  {t('emergencyContacts.viewModal.noNotes')}
                </Text>
              )}
            </Card>

            {/* Action Buttons */}
            <Group justify="flex-end" gap="md">
              <Button variant="filled" size="xs" onClick={handleCloseViewModal}>
                {t('buttons.close')}
              </Button>
              <Button
                variant="filled"
                size="xs"
                onClick={() => {
                  handleCloseViewModal();
                  handleEditContact(viewingContact);
                }}
              >
                {t('emergencyContacts.viewModal.editContact')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(EmergencyContacts, {
  injectResponsive: true,
  displayName: 'ResponsiveEmergencyContacts'
});
