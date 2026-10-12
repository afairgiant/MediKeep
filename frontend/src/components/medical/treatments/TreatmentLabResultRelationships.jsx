import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
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
import { IconTestPipe } from '@tabler/icons-react';
import { apiService } from '../../../services/api';
import { useTreatmentRelationships } from '../../../hooks/useTreatmentRelationships';
import { useTreatmentInlineCreate } from '../../../hooks/useTreatmentInlineCreate';
import {
  PURPOSE_OPTIONS,
  getPurposeColor,
} from '../../../constants/treatmentLabResultConstants';
import { translateOptions } from '../../../utils/translateOptions';
import {
  RelationshipContainer,
  RelationshipErrorAlert,
  RelationshipEmptyState,
  RelationshipAddFooter,
  RelationshipRowActions,
  RelationshipAddModal,
  RelationshipModalFooter,
  RelationshipRow,
  createDateSortedOptions,
  filterAvailableOptions,
  formatDateDisplay,
  getOptionLabel,
} from './RelationshipComponents';

const INITIAL_RELATIONSHIP_STATE = {
  lab_result_ids: [],
  purpose: '',
  expected_frequency: '',
  relevance_note: '',
};

const EDIT_FIELDS = ['purpose', 'expected_frequency', 'relevance_note'];

function buildSinglePayload(newRelationship) {
  return {
    lab_result_id: parseInt(newRelationship.lab_result_ids[0]),
    purpose: newRelationship.purpose || null,
    expected_frequency: newRelationship.expected_frequency || null,
    relevance_note: newRelationship.relevance_note || null,
  };
}

function buildBulkPayload(newRelationship) {
  return [
    newRelationship.lab_result_ids.map(id => parseInt(id)),
    newRelationship.purpose || null,
    newRelationship.relevance_note || null,
  ];
}

function formatLabResultLabel(labResult) {
  // Put date first for easier scanning in dropdowns
  // Use completed_date if available, fall back to ordered_date
  const dateValue = labResult.completed_date || labResult.ordered_date;
  const date = dateValue ? formatDateDisplay(dateValue) : null;
  let label = date ? `${date} - ${labResult.test_name}` : labResult.test_name;
  if (labResult.labs_result) {
    label += ` (${labResult.labs_result})`;
  }
  return label;
}

function TreatmentLabResultRelationships({
  treatmentId,
  labResults,
  isViewMode = false,
  patientId,
  onEntityCreated,
  onRelationshipsChange,
  onEntityClick,
}) {
  const { t } = useTranslation('common');
  const purposeOptions = translateOptions(PURPOSE_OPTIONS, t);
  // Ensure labResults is always an array
  const safeLabResults = Array.isArray(labResults) ? labResults : [];

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
    type: 'labResult',
    treatmentId,
    initialState: INITIAL_RELATIONSHIP_STATE,
    onRelationshipsChange,
    buildSinglePayload,
    buildBulkPayload,
  });

  const { onCreateNew, createLabel } = useTreatmentInlineCreate({
    createType: 'labResults',
    patientId,
    isViewMode,
    onCreated: async record => {
      // Known to the lists first: if linking fails, it is still offered in "Link"
      onEntityCreated?.(record);
      await apiService.linkTreatmentLabResult(
        treatmentId,
        buildSinglePayload({
          ...INITIAL_RELATIONSHIP_STATE,
          lab_result_ids: [String(record.id)],
        })
      );
      await fetchRelationships();
      return 'linked';
    },
  });

  const getLabResultById = labResultId => {
    return safeLabResults.find(lab => lab.id === labResultId);
  };

  const labResultOptions = createDateSortedOptions(
    safeLabResults,
    formatLabResultLabel,
    'completed_date'
  );
  const availableOptions = filterAvailableOptions(
    labResultOptions,
    relationships,
    'lab_result_id'
  );
  const selectedCount = newRelationship.lab_result_ids.length;

  return (
    <RelationshipContainer loading={loading}>
      <Stack gap="md">
        <RelationshipErrorAlert error={error} onDismiss={clearError} />

        {relationships.length > 0 ? (
          <Stack gap="sm">
            {relationships.map(relationship => {
              const labResult =
                relationship.lab_result ||
                getLabResultById(relationship.lab_result_id);
              const isEditing = editingRelationship?.id === relationship.id;

              return (
                <RelationshipRow key={relationship.id}>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm" wrap="wrap">
                      <Badge
                        variant="light"
                        color="violet"
                        leftSection={<IconTestPipe size={12} />}
                        style={
                          isViewMode && onEntityClick
                            ? { cursor: 'pointer' }
                            : undefined
                        }
                        onClick={
                          isViewMode && onEntityClick
                            ? () => onEntityClick(relationship.lab_result_id)
                            : undefined
                        }
                      >
                        {labResult?.test_name ||
                          t('treatments.links.labResultFallback', {
                            id: relationship.lab_result_id,
                          })}
                      </Badge>
                      {relationship.purpose && (
                        <Badge
                          variant="outline"
                          size="sm"
                          color={getPurposeColor(relationship.purpose)}
                        >
                          {getOptionLabel(relationship.purpose, purposeOptions)}
                        </Badge>
                      )}
                      {relationship.expected_frequency && (
                        <Badge variant="outline" size="sm" color="grape">
                          {relationship.expected_frequency}
                        </Badge>
                      )}
                    </Group>

                    {(labResult?.completed_date || labResult?.ordered_date) && (
                      <Text size="sm" c="dimmed">
                        <strong>{t('shared:labels.date')}:</strong>{' '}
                        {formatDateDisplay(
                          labResult.completed_date || labResult.ordered_date
                        )}
                        {labResult?.labs_result &&
                          ` | ${t('treatments.links.result')}: ${labResult.labs_result}`}
                      </Text>
                    )}

                    {!isViewMode && isEditing ? (
                      <Stack gap="xs">
                        <Select
                          size="xs"
                          placeholder={t('visits.relationships.purpose')}
                          data={purposeOptions}
                          value={editingRelationship?.purpose || ''}
                          onChange={value =>
                            updateEditingRelationship('purpose', value)
                          }
                          clearable
                          comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                        />
                        <TextInput
                          size="xs"
                          placeholder={t(
                            'treatments.links.expectedFrequencyPlaceholder'
                          )}
                          value={editingRelationship?.expected_frequency || ''}
                          onChange={e =>
                            updateEditingRelationship(
                              'expected_frequency',
                              e.target.value
                            )
                          }
                        />
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
                          purpose: editingRelationship?.purpose || null,
                          expected_frequency:
                            editingRelationship?.expected_frequency || null,
                          relevance_note:
                            editingRelationship?.relevance_note || null,
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
              'labels.noLabResultsLinked',
              'No lab results linked to this treatment'
            )}
            description={t('treatments.links.labResultsEmpty')}
            isViewMode={isViewMode}
          />
        )}

        {!isViewMode && (
          <RelationshipAddFooter
            availableCount={availableOptions.length}
            entityName="lab result"
            buttonLabel={t('buttons.linkLabResult', 'Link Lab Result')}
            onAdd={openAddModal}
            onCreateNew={onCreateNew}
            createLabel={createLabel}
            loading={loading}
          />
        )}

        <RelationshipAddModal
          opened={showAddModal}
          onClose={resetAndCloseModal}
          title={t('treatments.links.labResultsModalTitle')}
        >
          <MultiSelect
            label={t('treatments.links.selectLabResults')}
            placeholder={t('treatments.links.chooseLabResults')}
            data={availableOptions}
            value={newRelationship.lab_result_ids}
            onChange={values => updateNewRelationship('lab_result_ids', values)}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          {selectedCount === 1 && (
            <>
              <Select
                label={t('treatments.links.purposeOptional')}
                placeholder={t('treatments.links.selectPurpose')}
                data={purposeOptions}
                value={newRelationship.purpose}
                onChange={value =>
                  updateNewRelationship('purpose', value || '')
                }
                clearable
                comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                description={t('treatments.links.purposeDescription')}
              />

              <TextInput
                label={t('treatments.links.expectedFrequencyOptional')}
                placeholder={t('treatments.links.expectedFrequencyExample')}
                value={newRelationship.expected_frequency}
                onChange={e =>
                  updateNewRelationship('expected_frequency', e.target.value)
                }
                description={t('treatments.links.expectedFrequencyDescription')}
              />
            </>
          )}

          <Textarea
            label={t('modals.relevanceNoteOptional')}
            placeholder={t('treatments.links.labResultNotePlaceholder')}
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
                : t('buttons.linkLabResult', 'Link Lab Result')
            }
          />
        </RelationshipAddModal>
      </Stack>
    </RelationshipContainer>
  );
}

TreatmentLabResultRelationships.propTypes = {
  treatmentId: PropTypes.number,
  patientId: PropTypes.number,
  onEntityCreated: PropTypes.func,
  labResults: PropTypes.array,
  isViewMode: PropTypes.bool,
  onRelationshipsChange: PropTypes.func,
  onEntityClick: PropTypes.func,
};

export default TreatmentLabResultRelationships;
