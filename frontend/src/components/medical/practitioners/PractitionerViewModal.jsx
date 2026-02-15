import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Divider,
  Grid,
  Card,
  Title,
  Anchor,
  Paper,
  Skeleton,
} from '@mantine/core';
import { IconEdit, IconStar, IconBuilding } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import apiService from '../../../services/api';
import logger from '../../../services/logger';
import PracticeEditModal from './PracticeEditModal';

const PractitionerViewModal = ({
  isOpen,
  onClose,
  practitioner,
  onEdit,
  navigate
}) => {
  const { t } = useTranslation('common');
  const [practiceDetails, setPracticeDetails] = useState(null);
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [showPracticeEditModal, setShowPracticeEditModal] = useState(false);

  const fetchPracticeDetails = useCallback(async (practiceId) => {
    setIsLoadingPractice(true);
    try {
      const data = await apiService.getPractice(practiceId);
      setPracticeDetails(data);
    } catch (error) {
      logger.error('practice_details_load_failed', 'Failed to load practice details', {
        component: 'PractitionerViewModal',
        practiceId,
        error: error.message,
      });
      setPracticeDetails(null);
    } finally {
      setIsLoadingPractice(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && practitioner?.practice_id) {
      fetchPracticeDetails(practitioner.practice_id);
    } else {
      setPracticeDetails(null);
    }
  }, [isOpen, practitioner?.practice_id, fetchPracticeDetails]);

  if (!isOpen || !practitioner) return null;

  const handleEdit = () => {
    onEdit(practitioner);
    onClose();
  };

  const handlePracticeSaved = () => {
    if (practitioner.practice_id) {
      fetchPracticeDetails(practitioner.practice_id);
    }
  };

  const getSpecialtyColor = (specialty) => {
    const specialtyColors = {
      Cardiology: 'red',
      'Emergency Medicine': 'red',
      'Family Medicine': 'green',
      'Internal Medicine': 'green',
      Pediatrics: 'blue',
      Surgery: 'orange',
      'General Surgery': 'orange',
      Psychiatry: 'purple',
      Neurology: 'yellow',
    };

    return specialtyColors[specialty] || 'gray';
  };

  const notSpecified = t('common.labels.notSpecified', 'Not specified');

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={t('practitioners.viewModal.title', 'Practitioner Details')}
      size="lg"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <Stack gap="md">
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">{practitioner.name}</Title>
              <Group gap="xs">
                {practitioner.specialty && (
                  <Badge
                    color={getSpecialtyColor(practitioner.specialty)}
                    variant="light"
                    size="sm"
                  >
                    {practitioner.specialty}
                  </Badge>
                )}
                {(practitioner.practice_name || practitioner.practice) && (
                  <Badge variant="light" color="gray" size="sm">
                    {practitioner.practice_name || practitioner.practice}
                  </Badge>
                )}
              </Group>
            </div>
            {practitioner.rating !== null && practitioner.rating !== undefined && (
              <Badge variant="filled" color="yellow" size="lg" leftSection={<IconStar size={14} />}>
                {practitioner.rating}/5
              </Badge>
            )}
          </Group>
        </Paper>

        <Card withBorder p="md">
          <Stack gap="sm">
            <Text fw={600} size="sm" c="dimmed">
              {t('practitioners.viewModal.practitionerContact', 'PRACTITIONER CONTACT')}
            </Text>
            <Divider />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.practice', 'Practice')}:
                  </Text>
                  <Text
                    size="sm"
                    c={(practitioner.practice_name || practitioner.practice) ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.practice_name || practitioner.practice || notSpecified}
                  </Text>
                </Group>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.specialty', 'Specialty')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.specialty ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.specialty || notSpecified}
                  </Text>
                </Group>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.phone', 'Phone')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.phone_number ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.phone_number || notSpecified}
                  </Text>
                </Group>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.email', 'Email')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.email ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.email ? (
                      <Anchor
                        href={`mailto:${practitioner.email}`}
                        size="sm"
                        c="blue"
                      >
                        {practitioner.email}
                      </Anchor>
                    ) : (
                      notSpecified
                    )}
                  </Text>
                </Group>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.website', 'Website')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.website ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.website ? (
                      <Anchor
                        href={practitioner.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        c="blue"
                      >
                        {practitioner.website.replace(/^https?:\/\//, '')}
                      </Anchor>
                    ) : (
                      notSpecified
                    )}
                  </Text>
                </Group>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.rating', 'Rating')}:
                  </Text>
                  <Text
                    size="sm"
                    c={
                      practitioner.rating !== null &&
                      practitioner.rating !== undefined
                        ? 'inherit'
                        : 'dimmed'
                    }
                  >
                    {practitioner.rating !== null &&
                    practitioner.rating !== undefined ? (
                      <Group gap="xs">
                        <IconStar
                          size={16}
                          color="var(--mantine-color-yellow-6)"
                          fill="var(--mantine-color-yellow-6)"
                        />
                        <Text size="sm" fw={500}>
                          {practitioner.rating}/5
                        </Text>
                      </Group>
                    ) : (
                      notSpecified
                    )}
                  </Text>
                </Group>
              </Grid.Col>
            </Grid>
          </Stack>
        </Card>

        {/* Practice Details Section */}
        {practitioner.practice_id && (
          <Card withBorder p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <IconBuilding size={16} color="var(--mantine-color-dimmed)" />
                  <Text fw={600} size="sm" c="dimmed">
                    {t('practitioners.viewModal.practiceDetails', 'PRACTICE DETAILS')}
                  </Text>
                </Group>
                {practiceDetails && (
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => setShowPracticeEditModal(true)}
                  >
                    {t('practitioners.viewModal.editPractice', 'Edit Practice')}
                  </Button>
                )}
              </Group>
              <Divider />

              {isLoadingPractice ? (
                <Stack gap="xs">
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={16} width="45%" />
                  <Skeleton height={16} width="70%" />
                </Stack>
              ) : practiceDetails ? (
                <Stack gap="sm">
                  {/* Phone & Fax row */}
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          {t('practitioners.viewModal.practicePhone', 'Phone')}:
                        </Text>
                        <Text size="sm" c={practiceDetails.phone_number ? 'inherit' : 'dimmed'}>
                          {practiceDetails.phone_number || notSpecified}
                        </Text>
                      </Group>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          {t('practitioners.viewModal.practiceFax', 'Fax')}:
                        </Text>
                        <Text size="sm" c={practiceDetails.fax_number ? 'inherit' : 'dimmed'}>
                          {practiceDetails.fax_number || notSpecified}
                        </Text>
                      </Group>
                    </Grid.Col>
                  </Grid>

                  {/* Website & Portal row */}
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          {t('practitioners.viewModal.practiceWebsite', 'Website')}:
                        </Text>
                        <Text size="sm" c={practiceDetails.website ? 'inherit' : 'dimmed'}>
                          {practiceDetails.website ? (
                            <Anchor
                              href={practiceDetails.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="sm"
                              c="blue"
                            >
                              {practiceDetails.website.replace(/^https?:\/\//, '')}
                            </Anchor>
                          ) : notSpecified}
                        </Text>
                      </Group>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          {t('practitioners.viewModal.practicePortal', 'Patient Portal')}:
                        </Text>
                        <Text size="sm" c={practiceDetails.patient_portal_url ? 'inherit' : 'dimmed'}>
                          {practiceDetails.patient_portal_url ? (
                            <Anchor
                              href={practiceDetails.patient_portal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="sm"
                              c="blue"
                            >
                              {practiceDetails.patient_portal_url.replace(/^https?:\/\//, '')}
                            </Anchor>
                          ) : notSpecified}
                        </Text>
                      </Group>
                    </Grid.Col>
                  </Grid>

                  {/* Notes */}
                  <Group>
                    <Text size="sm" fw={500} w={100}>
                      {t('practitioners.viewModal.practiceNotes', 'Notes')}:
                    </Text>
                    <Text size="sm" c={practiceDetails.notes ? 'inherit' : 'dimmed'} style={{ whiteSpace: 'pre-wrap' }}>
                      {practiceDetails.notes || notSpecified}
                    </Text>
                  </Group>

                  {/* Locations */}
                  {practiceDetails.locations && practiceDetails.locations.length > 0 && (
                    <div>
                      <Text size="sm" fw={500} mb={4}>
                        {t('practitioners.viewModal.practiceLocations', 'Locations')}:
                      </Text>
                      <Stack gap={4}>
                        {practiceDetails.locations.map((loc, idx) => (
                          <Text key={idx} size="xs" c="dimmed">
                            {[loc.label, loc.address, loc.city, loc.state, loc.zip, loc.phone]
                              .filter(Boolean)
                              .join(' - ')}
                          </Text>
                        ))}
                      </Stack>
                    </div>
                  )}

                </Stack>
              ) : (
                <Text size="sm" c="dimmed" fs="italic">
                  {t('practitioners.viewModal.practiceLoadError', 'Failed to load practice details')}
                </Text>
              )}
            </Stack>
          </Card>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('common.buttons.close', 'Close')}
          </Button>
          <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
            {t('practitioners.viewModal.editButton', 'Edit Practitioner')}
          </Button>
        </Group>
      </Stack>

      {/* Practice Edit Modal */}
      <PracticeEditModal
        isOpen={showPracticeEditModal}
        onClose={() => setShowPracticeEditModal(false)}
        practiceData={practiceDetails}
        onSaved={handlePracticeSaved}
      />
    </Modal>
  );
};

export default PractitionerViewModal;
