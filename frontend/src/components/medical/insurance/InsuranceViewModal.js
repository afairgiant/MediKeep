import logger from '../../../services/logger';

import React, { useState } from 'react';
import {
  Modal,
  Title,
  Text,
  Grid,
  Group,
  Badge,
  Button,
  Stack,
  Divider,
  ActionIcon,
  Card,
  Tabs,
  Box,
  SimpleGrid,
  Paper,
} from '@mantine/core';
import { IconEdit, IconPrinter, IconStar, IconInfoCircle, IconShield, IconPhone, IconFileText } from '@tabler/icons-react';
import { formatDate } from '../../../utils/helpers';
import { formatPhoneNumber, cleanPhoneNumber, isPhoneField } from '../../../utils/phoneUtils';
import { formatFieldLabel, formatFieldValue } from '../../../utils/fieldFormatters';
import StatusBadge from '../StatusBadge';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';

const InsuranceViewModal = ({
  isOpen,
  onClose,
  insurance,
  onEdit,
  onPrint,
  onSetPrimary,
  onFileUploadComplete
}) => {
  // Tab state management
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens with new insurance
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, insurance?.id]);

  if (!insurance) return null;

  // Get type-specific styling
  const getTypeColor = (type) => {
    switch (type) {
      case 'medical': return 'blue';
      case 'dental': return 'green';
      case 'vision': return 'purple';
      case 'prescription': return 'orange';
      default: return 'gray';
    }
  };

  // Using imported formatters from utilities

  const typeColor = getTypeColor(insurance.insurance_type);

  // Get relevant coverage and contact fields to display
  const coverageDetails = insurance.coverage_details || {};
  const contactInfo = insurance.contact_info || {};

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={`${insurance.company_name} - Insurance Details`}
      size="xl"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <Stack gap="lg">
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Group mb="xs">
                <Title order={3} color={typeColor}>
                  {insurance.company_name}
                </Title>
                <Badge
                  size="lg"
                  variant="light"
                  color={typeColor}
                  style={{ textTransform: 'capitalize' }}
                >
                  {insurance.insurance_type} Insurance
                </Badge>
              </Group>
              <Group gap="xs">
                <StatusBadge status={insurance.status} />
                {insurance.insurance_type === 'medical' && insurance.is_primary && (
                  <Badge size="sm" variant="filled" color="yellow" leftSection={<IconStar size={12} />}>
                    Primary
                  </Badge>
                )}
              </Group>
              {insurance.plan_name && (
                <Text size="sm" c="dimmed" mt="xs">
                  Plan: {insurance.plan_name}
                </Text>
              )}
            </div>
          </Group>
        </Paper>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="coverage" leftSection={<IconShield size={16} />}>
              Coverage
            </Tabs.Tab>
            <Tabs.Tab value="contact" leftSection={<IconPhone size={16} />}>
              Contact
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
              Documents
            </Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview">
            <Box mt="md">
              <Stack gap="lg">
                {/* Member Information Section */}
                <div>
                  <Title order={4} mb="sm">Member Information</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Member Name</Text>
                      <Text>{insurance.member_name}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Policy Holder</Text>
                      <Text c={insurance.policy_holder_name && insurance.policy_holder_name !== insurance.member_name ? 'inherit' : 'dimmed'}>
                        {insurance.policy_holder_name && insurance.policy_holder_name !== insurance.member_name
                          ? insurance.policy_holder_name
                          : 'Same as member'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Member ID</Text>
                      <Text>{insurance.member_id}</Text>
                    </Stack>
                    {insurance.policy_holder_name && insurance.policy_holder_name !== insurance.member_name && (
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Relationship</Text>
                        <Text style={{ textTransform: 'capitalize' }}>
                          {insurance.relationship_to_holder || 'Self'}
                        </Text>
                      </Stack>
                    )}
                    {insurance.group_number && (
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Group Number</Text>
                        <Text>{insurance.group_number}</Text>
                      </Stack>
                    )}
                    {insurance.employer_group && (
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Employer/Group Sponsor</Text>
                        <Text>{insurance.employer_group}</Text>
                      </Stack>
                    )}
                  </SimpleGrid>
                </div>

                {/* Coverage Period Section */}
                <div>
                  <Title order={4} mb="sm">Coverage Period</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Effective Date</Text>
                      <Text>{formatDate(insurance.effective_date)}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Expiration Date</Text>
                      <Text c={insurance.expiration_date ? 'inherit' : 'dimmed'}>
                        {insurance.expiration_date ? formatDate(insurance.expiration_date) : 'Ongoing'}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Notes Section */}
                {insurance.notes && (
                  <div>
                    <Title order={4} mb="sm">Notes</Title>
                    <Paper withBorder p="sm" bg="gray.1">
                      <Text style={{ whiteSpace: 'pre-wrap' }}>
                        {insurance.notes}
                      </Text>
                    </Paper>
                  </div>
                )}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Coverage Tab */}
          <Tabs.Panel value="coverage">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">Coverage Details</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Deductible</Text>
                      <Text size="sm" c={coverageDetails.deductible ? 'inherit' : 'dimmed'}>
                        {coverageDetails.deductible || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Out of Pocket Max</Text>
                      <Text size="sm" c={coverageDetails.out_of_pocket_max ? 'inherit' : 'dimmed'}>
                        {coverageDetails.out_of_pocket_max || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Copay</Text>
                      <Text size="sm" c={coverageDetails.copay ? 'inherit' : 'dimmed'}>
                        {coverageDetails.copay || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Coinsurance</Text>
                      <Text size="sm" c={coverageDetails.coinsurance ? 'inherit' : 'dimmed'}>
                        {coverageDetails.coinsurance || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Prescription Coverage</Text>
                      <Text size="sm" c={coverageDetails.prescription_coverage ? 'inherit' : 'dimmed'}>
                        {coverageDetails.prescription_coverage || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Vision Coverage</Text>
                      <Text size="sm" c={coverageDetails.vision_coverage ? 'inherit' : 'dimmed'}>
                        {coverageDetails.vision_coverage || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Dental Coverage</Text>
                      <Text size="sm" c={coverageDetails.dental_coverage ? 'inherit' : 'dimmed'}>
                        {coverageDetails.dental_coverage || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Mental Health Coverage</Text>
                      <Text size="sm" c={coverageDetails.mental_health_coverage ? 'inherit' : 'dimmed'}>
                        {coverageDetails.mental_health_coverage || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                      <Text fw={500} size="sm" c="dimmed">Additional Coverage Details</Text>
                      <Text size="sm" c={coverageDetails.additional_details ? 'inherit' : 'dimmed'}>
                        {coverageDetails.additional_details || 'Not specified'}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Contact Tab */}
          <Tabs.Panel value="contact">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">Contact Information</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Customer Service Phone</Text>
                      <Text size="sm" c={contactInfo.customer_service_phone ? 'inherit' : 'dimmed'}>
                        {contactInfo.customer_service_phone ? formatPhoneNumber(cleanPhoneNumber(contactInfo.customer_service_phone)) : 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Claims Phone</Text>
                      <Text size="sm" c={contactInfo.claims_phone ? 'inherit' : 'dimmed'}>
                        {contactInfo.claims_phone ? formatPhoneNumber(cleanPhoneNumber(contactInfo.claims_phone)) : 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Website</Text>
                      <Text size="sm" c={contactInfo.website_url ? 'inherit' : 'dimmed'} style={{ wordBreak: 'break-all' }}>
                        {contactInfo.website_url || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Email</Text>
                      <Text size="sm" c={contactInfo.email ? 'inherit' : 'dimmed'}>
                        {contactInfo.email || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                      <Text fw={500} size="sm" c="dimmed">Claims Address</Text>
                      <Text size="sm" c={contactInfo.claims_address ? 'inherit' : 'dimmed'}>
                        {contactInfo.claims_address || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                      <Text fw={500} size="sm" c="dimmed">Pharmacy Network Info</Text>
                      <Text size="sm" c={contactInfo.pharmacy_network_info ? 'inherit' : 'dimmed'}>
                        {contactInfo.pharmacy_network_info || 'Not specified'}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Documents Tab */}
          <Tabs.Panel value="documents">
            <Box mt="md">
              <Stack gap="md">
                <Title order={4}>Attached Documents</Title>
                <DocumentManagerWithProgress
                  entityType="insurance"
                  entityId={insurance.id}
                  mode="view"
                  config={{
                    acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
                    maxSize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 10
                  }}
                  onUploadComplete={(success, completedCount, failedCount) => {
                    if (onFileUploadComplete) {
                      onFileUploadComplete(success);
                    }
                  }}
                  onError={(error) => {
                    logger.error('Document manager error in insurance view:', error);
                  }}
                  showProgressModal={true}
                />
              </Stack>
            </Box>
          </Tabs.Panel>
        </Tabs>

        {/* Action Buttons */}
        <Group justify="space-between" mt="md">
          <Button
            variant="outline"
            leftSection={<IconPrinter size={16} />}
            onClick={() => onPrint && onPrint(insurance)}
          >
            Print Card
          </Button>
          <Group>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              leftSection={<IconEdit size={16} />}
              onClick={() => {
                onClose();
                onEdit && onEdit(insurance);
              }}
            >
              Edit
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default InsuranceViewModal;