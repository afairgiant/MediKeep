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
import { IconStethoscope } from '@tabler/icons-react';
import { apiService } from '../../../services/api';
import { useTreatmentRelationships } from '../../../hooks/useTreatmentRelationships';
import { useTreatmentInlineCreate } from '../../../hooks/useTreatmentInlineCreate';
import { VISIT_LABEL_OPTIONS } from '../../../constants/treatmentVisitLabels';
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
  encounter_ids: [],
  visit_label: '',
  visit_sequence: '',
  relevance_note: '',
};

const EDIT_FIELDS = ['visit_label', 'visit_sequence', 'relevance_note'];

function buildSinglePayload(newRelationship) {
  return {
    encounter_id: parseInt(newRelationship.encounter_ids[0]),
    visit_label: newRelationship.visit_label || null,
    visit_sequence: newRelationship.visit_sequence
      ? parseInt(newRelationship.visit_sequence)
      : null,
    relevance_note: newRelationship.relevance_note || null,
  };
}

function buildBulkPayload(newRelationship) {
  return [
    newRelationship.encounter_ids.map(id => parseInt(id)),
    newRelationship.relevance_note || null,
  ];
}

function formatEncounterLabel(encounter, fallbackType) {
  const date = formatDateDisplay(encounter.date);
  const type = encounter.visit_type || fallbackType;
  let label = `${date} - ${type}`;
  if (encounter.reason) {
    label += ` (${encounter.reason})`;
  }
  return label;
}

function TreatmentEncounterRelationships({
  treatmentId,
  encounters,
  isViewMode = false,
  patientId,
  onEntityCreated,
  onRelationshipsChange,
  onEntityClick,
}) {
  const { t } = useTranslation('common');
  const visitLabelOptions = translateOptions(VISIT_LABEL_OPTIONS, t);
  // Ensure encounters is always an array
  const safeEncounters = Array.isArray(encounters) ? encounters : [];

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
    type: 'encounter',
    treatmentId,
    initialState: INITIAL_RELATIONSHIP_STATE,
    onRelationshipsChange,
    buildSinglePayload,
    buildBulkPayload,
  });

  const { onCreateNew, createLabel } = useTreatmentInlineCreate({
    createType: 'visits',
    patientId,
    isViewMode,
    onCreated: async record => {
      // Known to the lists first: if linking fails, it is still offered in "Link"
      onEntityCreated?.(record);
      await apiService.linkTreatmentEncounter(
        treatmentId,
        buildSinglePayload({
          ...INITIAL_RELATIONSHIP_STATE,
          encounter_ids: [String(record.id)],
        })
      );
      await fetchRelationships();
      return 'linked';
    },
  });

  const getEncounterById = encounterId => {
    return safeEncounters.find(e => e.id === encounterId);
  };

  const encounterOptions = createDateSortedOptions(
    safeEncounters,
    encounter =>
      formatEncounterLabel(encounter, t('treatments.links.visitFallback')),
    'date'
  );
  const availableOptions = filterAvailableOptions(
    encounterOptions,
    relationships,
    'encounter_id'
  );
  const selectedCount = newRelationship.encounter_ids.length;

  return (
    <RelationshipContainer loading={loading}>
      <Stack gap="md">
        <RelationshipErrorAlert error={error} onDismiss={clearError} />

        {relationships.length > 0 ? (
          <Stack gap="sm">
            {relationships.map(relationship => {
              const encounter =
                relationship.encounter ||
                getEncounterById(relationship.encounter_id);
              const isEditing = editingRelationship?.id === relationship.id;

              return (
                <RelationshipRow key={relationship.id}>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm" wrap="wrap">
                      <Badge
                        variant="light"
                        color="blue"
                        leftSection={<IconStethoscope size={12} />}
                        style={
                          isViewMode && onEntityClick
                            ? { cursor: 'pointer' }
                            : undefined
                        }
                        onClick={
                          isViewMode && onEntityClick
                            ? () => onEntityClick(relationship.encounter_id)
                            : undefined
                        }
                      >
                        {formatDateDisplay(encounter?.date)} -{' '}
                        {encounter?.visit_type ||
                          t('treatments.links.visitFallback')}
                      </Badge>
                      {relationship.visit_label && (
                        <Badge variant="outline" size="sm" color="cyan">
                          {getOptionLabel(
                            relationship.visit_label,
                            visitLabelOptions
                          )}
                        </Badge>
                      )}
                      {relationship.visit_sequence && (
                        <Badge variant="outline" size="sm" color="grape">
                          {t('shared:labels.visitType')} #
                          {relationship.visit_sequence}
                        </Badge>
                      )}
                    </Group>

                    {encounter?.reason && (
                      <Text size="sm" c="dimmed">
                        <strong>{t('shared:labels.reason')}:</strong>{' '}
                        {encounter.reason}
                      </Text>
                    )}

                    {!isViewMode && isEditing ? (
                      <Stack gap="xs">
                        <Select
                          size="xs"
                          placeholder={t('treatments.links.visitLabel')}
                          data={visitLabelOptions}
                          value={editingRelationship?.visit_label || ''}
                          onChange={value =>
                            updateEditingRelationship('visit_label', value)
                          }
                          clearable
                          comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                        />
                        <TextInput
                          size="xs"
                          placeholder={t(
                            'treatments.links.visitSequencePlaceholder'
                          )}
                          type="number"
                          value={editingRelationship?.visit_sequence || ''}
                          onChange={e =>
                            updateEditingRelationship(
                              'visit_sequence',
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
                          visit_label: editingRelationship?.visit_label || null,
                          visit_sequence: editingRelationship?.visit_sequence
                            ? parseInt(editingRelationship.visit_sequence)
                            : null,
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
              'labels.noEncountersLinked',
              'No visits linked to this treatment'
            )}
            description={t('treatments.links.visitsEmpty')}
            isViewMode={isViewMode}
          />
        )}

        {!isViewMode && (
          <RelationshipAddFooter
            availableCount={availableOptions.length}
            entityName="visit"
            buttonLabel={t('buttons.linkVisit', 'Link Visit')}
            onAdd={openAddModal}
            onCreateNew={onCreateNew}
            createLabel={createLabel}
            loading={loading}
          />
        )}

        <RelationshipAddModal
          opened={showAddModal}
          onClose={resetAndCloseModal}
          title={t('treatments.links.visitsModalTitle')}
        >
          <MultiSelect
            label={t('treatments.links.selectVisits')}
            placeholder={t('treatments.links.chooseVisits')}
            data={availableOptions}
            value={newRelationship.encounter_ids}
            onChange={values => updateNewRelationship('encounter_ids', values)}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          {selectedCount === 1 && (
            <>
              <Select
                label={t('treatments.links.visitLabelOptional')}
                placeholder={t('treatments.links.selectVisitType')}
                data={visitLabelOptions}
                value={newRelationship.visit_label}
                onChange={value =>
                  updateNewRelationship('visit_label', value || '')
                }
                clearable
                comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                description={t('treatments.links.visitLabelDescription')}
              />

              <TextInput
                label={t('treatments.links.visitSequenceOptional')}
                placeholder={t('treatments.links.visitSequenceExample')}
                type="number"
                value={newRelationship.visit_sequence}
                onChange={e =>
                  updateNewRelationship('visit_sequence', e.target.value)
                }
                description={t('treatments.links.visitSequenceDescription')}
              />
            </>
          )}

          <Textarea
            label={t('modals.relevanceNoteOptional')}
            placeholder={t('treatments.links.visitNotePlaceholder')}
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
                : t('buttons.linkVisit', 'Link Visit')
            }
          />
        </RelationshipAddModal>
      </Stack>
    </RelationshipContainer>
  );
}

TreatmentEncounterRelationships.propTypes = {
  treatmentId: PropTypes.number,
  patientId: PropTypes.number,
  onEntityCreated: PropTypes.func,
  encounters: PropTypes.array,
  isViewMode: PropTypes.bool,
  onRelationshipsChange: PropTypes.func,
  onEntityClick: PropTypes.func,
};

export default TreatmentEncounterRelationships;
