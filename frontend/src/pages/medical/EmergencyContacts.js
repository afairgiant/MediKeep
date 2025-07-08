import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container,
  Paper,
  Group,
  Text,
  Title,
  Stack,
  Alert,
  Loader,
  Center,
  Badge,
  Grid,
  Card,
  Box,
  Divider,
  Anchor,
  Modal,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
  IconStar,
} from '@tabler/icons-react';
import { useMedicalData, useDataManagement } from '../../hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import { Button } from '../../components/ui';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MantineEmergencyContactForm from '../../components/medical/MantineEmergencyContactForm';
import { EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS } from '../../utils/statusConfig';
import { formatPhoneNumber } from '../../utils/phoneUtils';

const EmergencyContacts = () => {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const navigate = useNavigate();
  const location = useLocation();

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
      delete: (id, signal) => apiService.deleteEmergencyContact(id, signal),
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
    return (
      <Container size="xl" py="lg">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading emergency contacts...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Emergency Contacts" icon="🚨" />

      <Container size="xl" py="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={clearError}
            mb="md"
          >
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title="Success"
            icon={<IconCheck size={16} />}
            mb="md"
          >
            {successMessage}
          </Alert>
        )}

        <Group justify="space-between" mb="lg">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAddContact}
            size="md"
          >
            Add Emergency Contact
          </Button>

          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showPrint={true}
          />
        </Group>

        {/* Mantine Filter Controls */}
        <MantineFilters
          filters={dataManagement.filters}
          updateFilter={dataManagement.updateFilter}
          clearFilters={dataManagement.clearFilters}
          hasActiveFilters={dataManagement.hasActiveFilters}
          statusOptions={dataManagement.statusOptions}
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
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
                    <Title order={3}>No emergency contacts found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : "It's important to have emergency contacts available in case of medical emergencies."}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {filteredContacts.map((contact, index) => (
                  <Grid.Col key={contact.id} span={{ base: 12, md: 6, lg: 4 }}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card
                        shadow="sm"
                        padding="lg"
                        radius="md"
                        withBorder
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
                                    PRIMARY
                                  </Group>
                                </Badge>
                              )}
                              <Badge
                                color={contact.is_active ? 'green' : 'gray'}
                                variant="light"
                                size="sm"
                              >
                                {contact.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </Group>
                          </Group>
                        </Card.Section>

                        <Stack gap="md" mt="md">
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Relationship:
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
                              Phone:
                            </Text>
                            <Anchor
                              href={`tel:${contact.phone_number}`}
                              size="sm"
                              c="blue"
                            >
                              {formatPhoneNumber(contact.phone_number)}
                            </Anchor>
                          </Group>

                          {contact.secondary_phone && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Secondary Phone:
                              </Text>
                              <Anchor
                                href={`tel:${contact.secondary_phone}`}
                                size="sm"
                                c="blue"
                              >
                                {formatPhoneNumber(contact.secondary_phone)}
                              </Anchor>
                            </Group>
                          )}

                          {contact.email && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Email:
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
                                Address:
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
                              📝 Notes
                            </Text>
                            <Text size="sm" c="gray.7">
                              {contact.notes}
                            </Text>
                          </Box>
                        )}

                        <Stack gap={0} mt="auto">
                          <Divider />
                          <Group justify="flex-end" gap="xs" pt="sm">
                            <Button
                              variant="light"
                              size="xs"
                              onClick={() => handleViewContact(contact)}
                            >
                              View
                            </Button>
                            <Button
                              variant="light"
                              size="xs"
                              onClick={() => handleEditContact(contact)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="light"
                              color="red"
                              size="xs"
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              Delete
                            </Button>
                          </Group>
                        </Stack>
                      </Card>
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <MedicalTable
                data={filteredContacts}
                columns={[
                  { header: 'Name', accessor: 'name' },
                  { header: 'Relationship', accessor: 'relationship' },
                  { header: 'Phone', accessor: 'phone_number' },
                  { header: 'Email', accessor: 'email' },
                  { header: 'Primary', accessor: 'is_primary' },
                  { header: 'Status', accessor: 'is_active' },
                ]}
                patientData={currentPatient}
                tableName="Emergency Contacts"
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
                        {formatPhoneNumber(value)}
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
                          Primary
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
                      {value ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                }}
              />
            </Paper>
          )}
        </motion.div>
      </Container>

      <MantineEmergencyContactForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'
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
            <Text size="lg">🚨</Text>
            <Text size="lg" fw={600}>
              Emergency Contact Details
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
                          PRIMARY
                        </Group>
                      </Badge>
                    )}
                    <Badge
                      color={viewingContact.is_active ? 'green' : 'gray'}
                      variant="light"
                      size="sm"
                    >
                      {viewingContact.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Group>
                </Stack>
              </Group>
            </Card>

            {/* Contact Information */}
            <Card withBorder p="md" radius="md">
              <Title order={4} mb="md">
                📞 Contact Information
              </Title>
              <Grid>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      Primary Phone
                    </Text>
                    <Anchor
                      href={`tel:${viewingContact.phone_number}`}
                      size="md"
                      c="blue"
                      fw={500}
                    >
                      {formatPhoneNumber(viewingContact.phone_number)}
                    </Anchor>
                  </Stack>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      Secondary Phone
                    </Text>
                    {viewingContact.secondary_phone ? (
                      <Anchor
                        href={`tel:${viewingContact.secondary_phone}`}
                        size="md"
                        c="blue"
                        fw={500}
                      >
                        {formatPhoneNumber(viewingContact.secondary_phone)}
                      </Anchor>
                    ) : (
                      <Text size="md" c="dimmed">
                        Not specified
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      Email Address
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
                        Not specified
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={12}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      Address
                    </Text>
                    {viewingContact.address ? (
                      <Text size="md" fw={500}>
                        {viewingContact.address}
                      </Text>
                    ) : (
                      <Text size="md" c="dimmed">
                        Not specified
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>
              </Grid>
            </Card>

            {/* Notes */}
            <Card withBorder p="md" radius="md">
              <Title order={4} mb="md">
                📝 Notes
              </Title>
              {viewingContact.notes ? (
                <Text size="md" c="gray.7">
                  {viewingContact.notes}
                </Text>
              ) : (
                <Text size="md" c="dimmed">
                  No notes available
                </Text>
              )}
            </Card>

            {/* Action Buttons */}
            <Group justify="flex-end" gap="md">
              <Button variant="light" onClick={handleCloseViewModal}>
                Close
              </Button>
              <Button
                onClick={() => {
                  handleCloseViewModal();
                  handleEditContact(viewingContact);
                }}
              >
                Edit Contact
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </motion.div>
  );
};

export default EmergencyContacts;
