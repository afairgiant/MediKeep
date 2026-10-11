import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { useDateFormat } from '../../../hooks/useDateFormat';
import {
  Badge,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '../../adapters/DateInput';
import { IconPill } from '@tabler/icons-react';
import {
  parseDateInput,
  formatDateInputChange,
} from '../../../utils/dateUtils';
import { apiService } from '../../../services/api';
import { useTreatmentRelationships } from '../../../hooks/useTreatmentRelationships';
import { useTreatmentInlineCreate } from '../../../hooks/useTreatmentInlineCreate';
import {
  RelationshipContainer,
  RelationshipErrorAlert,
  RelationshipEmptyState,
  RelationshipAddFooter,
  RelationshipRowActions,
  RelationshipAddModal,
  RelationshipModalFooter,
  RelationshipRow,
  createSelectOptions,
  filterAvailableOptions,
} from './RelationshipComponents';

const INITIAL_RELATIONSHIP_STATE = {
  medication_ids: [],
  specific_dosage: '',
  specific_frequency: '',
  specific_duration: '',
  timing_instructions: '',
  relevance_note: '',
  specific_prescriber_id: '',
  specific_pharmacy_id: '',
  specific_start_date: '',
  specific_end_date: '',
};

const EDIT_FIELDS = [
  'specific_dosage',
  'specific_frequency',
  'relevance_note',
  'specific_prescriber_id',
  'specific_pharmacy_id',
  'specific_start_date',
  'specific_end_date',
];

function buildSinglePayload(newRelationship) {
  return {
    medication_id: parseInt(newRelationship.medication_ids[0]),
    specific_dosage: newRelationship.specific_dosage || null,
    specific_frequency: newRelationship.specific_frequency || null,
    specific_duration: newRelationship.specific_duration || null,
    timing_instructions: newRelationship.timing_instructions || null,
    relevance_note: newRelationship.relevance_note || null,
    specific_prescriber_id: newRelationship.specific_prescriber_id
      ? parseInt(newRelationship.specific_prescriber_id)
      : null,
    specific_pharmacy_id: newRelationship.specific_pharmacy_id
      ? parseInt(newRelationship.specific_pharmacy_id)
      : null,
    specific_start_date: newRelationship.specific_start_date || null,
    specific_end_date: newRelationship.specific_end_date || null,
  };
}

function buildBulkPayload(newRelationship) {
  return [
    newRelationship.medication_ids.map(id => parseInt(id)),
    newRelationship.relevance_note || null,
  ];
}

function formatMedicationLabel(medication) {
  let label = medication.medication_name;
  if (medication.dosage) {
    label += ` (${medication.dosage})`;
  }
  if (medication.status) {
    label += ` - ${medication.status}`;
  }
  return label;
}

function TreatmentMedicationRelationships({
  treatmentId,
  medications,
  practitioners = [],
  pharmacies = [],
  isViewMode = false,
  patientId,
  onEntityCreated,
  onRelationshipsChange,
  onEntityClick,
}) {
  const { t } = useTranslation('common');
  const { dateInputFormat, dateParser } = useDateFormat();
  // Ensure medications is always an array
  const safeMedications = Array.isArray(medications) ? medications : [];

  const {
    relationships,
    loading,
    showAddModal,
    editingRelationship,
    newRelationship,
    error,
    fetchRelationships,
    handleAddRelationship,
    handleEditRelationship,
    handleDeleteRelationship,
    resetAndCloseModal,
    openAddModal,
    startEditing,
    cancelEditing,
    updateNewRelationship,
    updateEditingRelationship,
    clearError,
  } = useTreatmentRelationships({
    type: 'medication',
    treatmentId,
    initialState: INITIAL_RELATIONSHIP_STATE,
    onRelationshipsChange,
    buildSinglePayload,
    buildBulkPayload,
  });

  const { onCreateNew, createLabel } = useTreatmentInlineCreate({
    createType: 'medications',
    patientId,
    isViewMode,
    onCreated: async record => {
      // Known to the lists first: if linking fails, it is still offered in "Link"
      onEntityCreated?.(record);
      await apiService.linkTreatmentMedication(
        treatmentId,
        buildSinglePayload({
          ...INITIAL_RELATIONSHIP_STATE,
          medication_ids: [String(record.id)],
        })
      );
      await fetchRelationships();
      return 'linked';
    },
  });

  const getMedicationById = medicationId => {
    return safeMedications.find(m => m.id === medicationId);
  };

  const medicationOptions = createSelectOptions(
    safeMedications,
    formatMedicationLabel
  );
  const availableOptions = filterAvailableOptions(
    medicationOptions,
    relationships,
    'medication_id'
  );
  const selectedCount = newRelationship.medication_ids.length;

  return (
    <RelationshipContainer loading={loading}>
      <Stack gap="md">
        <RelationshipErrorAlert error={error} onDismiss={clearError} />

        {relationships.length > 0 ? (
          <Stack gap="sm">
            {relationships.map(relationship => {
              const medication =
                relationship.medication ||
                getMedicationById(relationship.medication_id);
              const isEditing = editingRelationship?.id === relationship.id;

              return (
                <RelationshipRow key={relationship.id}>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm" wrap="wrap">
                      <Badge
                        variant="light"
                        color="teal"
                        leftSection={<IconPill size={12} />}
                        style={
                          isViewMode && onEntityClick
                            ? { cursor: 'pointer' }
                            : undefined
                        }
                        onClick={
                          isViewMode && onEntityClick
                            ? () => onEntityClick(relationship.medication_id)
                            : undefined
                        }
                      >
                        {medication?.medication_name ||
                          t('treatments.links.medicationFallback', {
                            id: relationship.medication_id,
                          })}
                      </Badge>
                      {(relationship.specific_dosage || medication?.dosage) && (
                        <Badge variant="outline" size="sm">
                          {relationship.specific_dosage || medication?.dosage}
                        </Badge>
                      )}
                      {(relationship.specific_frequency ||
                        medication?.frequency) && (
                        <Badge variant="outline" size="sm" color="cyan">
                          {relationship.specific_frequency ||
                            medication?.frequency}
                        </Badge>
                      )}
                      {relationship.specific_duration && (
                        <Badge variant="outline" size="sm" color="grape">
                          {relationship.specific_duration}
                        </Badge>
                      )}
                      {medication?.status && (
                        <Badge variant="outline" size="sm" color="green">
                          {medication.status}
                        </Badge>
                      )}
                    </Group>

                    {relationship.timing_instructions && (
                      <Text size="sm" c="dimmed">
                        <strong>{t('treatments.timingLabel')}</strong>{' '}
                        {relationship.timing_instructions}
                      </Text>
                    )}

                    {!isViewMode && isEditing ? (
                      <Stack gap="xs">
                        <TextInput
                          size="xs"
                          placeholder={t(
                            'treatments.links.specificDosagePlaceholder'
                          )}
                          value={editingRelationship?.specific_dosage || ''}
                          onChange={e =>
                            updateEditingRelationship(
                              'specific_dosage',
                              e.target.value
                            )
                          }
                        />
                        <TextInput
                          size="xs"
                          placeholder={t(
                            'treatments.links.specificFrequencyPlaceholder'
                          )}
                          value={editingRelationship?.specific_frequency || ''}
                          onChange={e =>
                            updateEditingRelationship(
                              'specific_frequency',
                              e.target.value
                            )
                          }
                        />
                        <Group grow gap="xs">
                          <Select
                            size="xs"
                            placeholder={t('treatments.links.prescriber')}
                            data={practitioners.map(p => ({
                              value: p.id.toString(),
                              label: `${p.name}${p.specialty ? ` - ${p.specialty}` : ''}`,
                            }))}
                            value={
                              editingRelationship?.specific_prescriber_id?.toString() ||
                              ''
                            }
                            onChange={value =>
                              updateEditingRelationship(
                                'specific_prescriber_id',
                                value || ''
                              )
                            }
                            clearable
                            searchable
                            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                          <Select
                            size="xs"
                            placeholder={t('treatments.links.pharmacy')}
                            data={pharmacies.map(p => ({
                              value: p.id.toString(),
                              label:
                                p.name ||
                                p.brand ||
                                t('treatments.links.pharmacyFallback', {
                                  id: p.id,
                                }),
                            }))}
                            value={
                              editingRelationship?.specific_pharmacy_id?.toString() ||
                              ''
                            }
                            onChange={value =>
                              updateEditingRelationship(
                                'specific_pharmacy_id',
                                value || ''
                              )
                            }
                            clearable
                            searchable
                            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                        </Group>
                        <Group grow gap="xs">
                          <DateInput
                            size="xs"
                            placeholder={dateInputFormat}
                            value={parseDateInput(
                              editingRelationship?.specific_start_date
                            )}
                            onChange={date =>
                              updateEditingRelationship(
                                'specific_start_date',
                                formatDateInputChange(date)
                              )
                            }
                            valueFormat={dateInputFormat}
                            dateParser={dateParser}
                            clearable
                            popoverProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                          <DateInput
                            size="xs"
                            placeholder={dateInputFormat}
                            value={parseDateInput(
                              editingRelationship?.specific_end_date
                            )}
                            onChange={date =>
                              updateEditingRelationship(
                                'specific_end_date',
                                formatDateInputChange(date)
                              )
                            }
                            valueFormat={dateInputFormat}
                            dateParser={dateParser}
                            clearable
                            popoverProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                        </Group>
                        <Textarea
                          size="xs"
                          placeholder={t('modals.relevanceNoteOptional')}
                          value={editingRelationship?.relevance_note || ''}
                          onChange={e =>
                            updateEditingRelationship(
                              'relevance_note',
                              e.target.value
                            )
                          }
                          autosize
                          minRows={2}
                        />
                      </Stack>
                    ) : (
                      relationship.relevance_note && (
                        <Text size="sm" c="dimmed" fs="italic">
                          {relationship.relevance_note}
                        </Text>
                      )
                    )}
                  </Stack>

                  {!isViewMode && (
                    <RelationshipRowActions
                      isEditing={isEditing}
                      onSave={() =>
                        handleEditRelationship(relationship.id, {
                          specific_dosage:
                            editingRelationship?.specific_dosage || null,
                          specific_frequency:
                            editingRelationship?.specific_frequency || null,
                          relevance_note:
                            editingRelationship?.relevance_note || null,
                          specific_prescriber_id:
                            editingRelationship?.specific_prescriber_id
                              ? parseInt(
                                  editingRelationship.specific_prescriber_id
                                )
                              : null,
                          specific_pharmacy_id:
                            editingRelationship?.specific_pharmacy_id
                              ? parseInt(
                                  editingRelationship.specific_pharmacy_id
                                )
                              : null,
                          specific_start_date:
                            editingRelationship?.specific_start_date || null,
                          specific_end_date:
                            editingRelationship?.specific_end_date || null,
                        })
                      }
                      onCancel={cancelEditing}
                      onEdit={() => startEditing(relationship, EDIT_FIELDS)}
                      onDelete={() => handleDeleteRelationship(relationship.id)}
                      loading={loading}
                    />
                  )}
                </RelationshipRow>
              );
            })}
          </Stack>
        ) : (
          <RelationshipEmptyState
            message={t(
              'labels.noMedicationsLinked',
              'No medications linked to this treatment'
            )}
            description={t('treatments.links.medicationsEmpty')}
            isViewMode={isViewMode}
          />
        )}

        {!isViewMode && (
          <RelationshipAddFooter
            availableCount={availableOptions.length}
            entityName="medication"
            buttonLabel={t('buttons.linkMedication', 'Link Medication')}
            onAdd={openAddModal}
            onCreateNew={onCreateNew}
            createLabel={createLabel}
            loading={loading}
          />
        )}

        <RelationshipAddModal
          opened={showAddModal}
          onClose={resetAndCloseModal}
          title={t('treatments.links.medicationsModalTitle')}
        >
          <MultiSelect
            label={t('treatments.links.selectMedications')}
            placeholder={t('treatments.links.chooseMedications')}
            data={availableOptions}
            value={newRelationship.medication_ids}
            onChange={values => updateNewRelationship('medication_ids', values)}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          {selectedCount === 1 && (
            <>
              <TextInput
                label={t('treatments.links.specificDosageOptional')}
                placeholder={t('treatments.links.specificDosageExample')}
                value={newRelationship.specific_dosage}
                onChange={e =>
                  updateNewRelationship('specific_dosage', e.target.value)
                }
                description={t('treatments.links.specificDosageDescription')}
              />

              <TextInput
                label={t('treatments.links.durationOptional')}
                placeholder={t('treatments.links.durationExample')}
                value={newRelationship.specific_duration}
                onChange={e =>
                  updateNewRelationship('specific_duration', e.target.value)
                }
              />

              <TextInput
                label={t('treatments.links.timingOptional')}
                placeholder={t('treatments.links.timingExample')}
                value={newRelationship.timing_instructions}
                onChange={e =>
                  updateNewRelationship('timing_instructions', e.target.value)
                }
              />

              <Group grow gap="sm">
                <Select
                  label={t('treatments.links.prescriber')}
                  placeholder={t('treatments.links.overridePrescriber')}
                  data={practitioners.map(p => ({
                    value: p.id.toString(),
                    label: `${p.name}${p.specialty ? ` - ${p.specialty}` : ''}`,
                  }))}
                  value={newRelationship.specific_prescriber_id || null}
                  onChange={value =>
                    updateNewRelationship('specific_prescriber_id', value || '')
                  }
                  clearable
                  searchable
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />
                <Select
                  label={t('treatments.links.pharmacy')}
                  placeholder={t('treatments.links.overridePharmacy')}
                  data={pharmacies.map(p => ({
                    value: p.id.toString(),
                    label:
                      p.name ||
                      p.brand ||
                      t('treatments.links.pharmacyFallback', { id: p.id }),
                  }))}
                  value={newRelationship.specific_pharmacy_id || null}
                  onChange={value =>
                    updateNewRelationship('specific_pharmacy_id', value || '')
                  }
                  clearable
                  searchable
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />
              </Group>

              <Group grow gap="sm">
                <DateInput
                  label={t('medical:treatments.medications.specificStartDate')}
                  placeholder={dateInputFormat}
                  value={parseDateInput(newRelationship.specific_start_date)}
                  onChange={date =>
                    updateNewRelationship(
                      'specific_start_date',
                      formatDateInputChange(date)
                    )
                  }
                  valueFormat={dateInputFormat}
                  dateParser={dateParser}
                  clearable
                  popoverProps={{ withinPortal: true, zIndex: 4000 }}
                />
                <DateInput
                  label={t('medical:treatments.medications.specificEndDate')}
                  placeholder={dateInputFormat}
                  value={parseDateInput(newRelationship.specific_end_date)}
                  onChange={date =>
                    updateNewRelationship(
                      'specific_end_date',
                      formatDateInputChange(date)
                    )
                  }
                  valueFormat={dateInputFormat}
                  dateParser={dateParser}
                  clearable
                  popoverProps={{ withinPortal: true, zIndex: 4000 }}
                />
              </Group>
            </>
          )}

          <Textarea
            label={t('modals.relevanceNoteOptional')}
            placeholder={t('treatments.links.medicationNotePlaceholder')}
            value={newRelationship.relevance_note}
            onChange={e =>
              updateNewRelationship('relevance_note', e.target.value)
            }
            autosize
            minRows={2}
          />

          <RelationshipModalFooter
            onCancel={resetAndCloseModal}
            onSubmit={handleAddRelationship}
            loading={loading}
            disabled={selectedCount === 0}
            submitLabel={
              selectedCount > 1
                ? t('treatments.links.linkSelectedCount', {
                    count: selectedCount,
                  })
                : t('buttons.linkMedication', 'Link Medication')
            }
          />
        </RelationshipAddModal>
      </Stack>
    </RelationshipContainer>
  );
}

TreatmentMedicationRelationships.propTypes = {
  treatmentId: PropTypes.number,
  patientId: PropTypes.number,
  onEntityCreated: PropTypes.func,
  medications: PropTypes.array,
  practitioners: PropTypes.array,
  pharmacies: PropTypes.array,
  isViewMode: PropTypes.bool,
  onRelationshipsChange: PropTypes.func,
  onEntityClick: PropTypes.func,
};

export default TreatmentMedicationRelationships;
