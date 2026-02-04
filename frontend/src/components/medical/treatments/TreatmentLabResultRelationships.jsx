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
import { useTreatmentRelationships } from '../../../hooks/useTreatmentRelationships';
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

const PURPOSE_OPTIONS = [
  { value: 'baseline', label: 'Baseline' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'outcome', label: 'Outcome' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

const PURPOSE_COLORS = {
  baseline: 'blue',
  monitoring: 'cyan',
  outcome: 'green',
  safety: 'orange',
};

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

function getPurposeColor(purpose) {
  return PURPOSE_COLORS[purpose] || 'gray';
}

function TreatmentLabResultRelationships({
  treatmentId,
  labResults,
  isViewMode = false,
  onRelationshipsChange,
  onEntityClick,
}) {
  const { t } = useTranslation('common');
  // Ensure labResults is always an array
  const safeLabResults = Array.isArray(labResults) ? labResults : [];

  const {
    relationships,
    loading,
    showAddModal,
    editingRelationship,
    newRelationship,
    error,
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

  const getLabResultById = (labResultId) => {
    return safeLabResults.find(lab => lab.id === labResultId);
  };

  const labResultOptions = createDateSortedOptions(safeLabResults, formatLabResultLabel, 'completed_date');
  const availableOptions = filterAvailableOptions(labResultOptions, relationships, 'lab_result_id');
  const selectedCount = newRelationship.lab_result_ids.length;

  return (
    <RelationshipContainer loading={loading}>
      <Stack gap="md">
        <RelationshipErrorAlert error={error} onDismiss={clearError} />

        {relationships.length > 0 ? (
          <Stack gap="sm">
            {relationships.map(relationship => {
              const labResult = relationship.lab_result || getLabResultById(relationship.lab_result_id);
              const isEditing = editingRelationship?.id === relationship.id;

              return (
                <RelationshipRow key={relationship.id}>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm" wrap="wrap">
                      <Badge
                        variant="light"
                        color="violet"
                        leftSection={<IconTestPipe size={12} />}
                        style={isViewMode && onEntityClick ? { cursor: 'pointer' } : undefined}
                        onClick={isViewMode && onEntityClick ? () => onEntityClick(relationship.lab_result_id) : undefined}
                      >
                        {labResult?.test_name || `Lab Result ID: ${relationship.lab_result_id}`}
                      </Badge>
                      {relationship.purpose && (
                        <Badge variant="outline" size="sm" color={getPurposeColor(relationship.purpose)}>
                          {getOptionLabel(relationship.purpose, PURPOSE_OPTIONS)}
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
                        <strong>Date:</strong> {formatDateDisplay(labResult.completed_date || labResult.ordered_date)}
                        {labResult?.labs_result && ` | Result: ${labResult.labs_result}`}
                      </Text>
                    )}

                    {!isViewMode && isEditing ? (
                      <Stack gap="xs">
                        <Select
                          size="xs"
                          placeholder="Purpose"
                          data={PURPOSE_OPTIONS}
                          value={editingRelationship?.purpose || ''}
                          onChange={(value) => updateEditingRelationship('purpose', value)}
                          clearable
                          comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                        />
                        <TextInput
                          size="xs"
                          placeholder="Expected frequency (e.g., Monthly)"
                          value={editingRelationship?.expected_frequency || ''}
                          onChange={(e) => updateEditingRelationship('expected_frequency', e.target.value)}
                        />
                        <Textarea
                          size="xs"
                          placeholder="Relevance note"
                          value={editingRelationship?.relevance_note || ''}
                          onChange={(e) => updateEditingRelationship('relevance_note', e.target.value)}
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
                      onSave={() => handleEditRelationship(relationship.id, {
                        purpose: editingRelationship?.purpose || null,
                        expected_frequency: editingRelationship?.expected_frequency || null,
                        relevance_note: editingRelationship?.relevance_note || null,
                      })}
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
            message={t('labels.noLabResultsLinked', 'No lab results linked to this treatment')}
            description="Link lab results to track baseline, monitoring, and outcome tests."
            isViewMode={isViewMode}
          />
        )}

        {!isViewMode && (
          <RelationshipAddFooter
            availableCount={availableOptions.length}
            entityName="lab result"
            buttonLabel={t('buttons.linkLabResult', 'Link Lab Result')}
            onAdd={openAddModal}
            loading={loading}
          />
        )}

        <RelationshipAddModal
          opened={showAddModal}
          onClose={resetAndCloseModal}
          title="Link Lab Results to Treatment"
        >
          <MultiSelect
            label="Select Lab Results"
            placeholder="Choose lab results to link"
            data={availableOptions}
            value={newRelationship.lab_result_ids}
            onChange={(values) => updateNewRelationship('lab_result_ids', values)}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          {selectedCount === 1 && (
            <>
              <Select
                label="Purpose (Optional)"
                placeholder="Select purpose"
                data={PURPOSE_OPTIONS}
                value={newRelationship.purpose}
                onChange={(value) => updateNewRelationship('purpose', value || '')}
                clearable
                comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                description="Why this lab is part of the treatment plan"
              />

              <TextInput
                label="Expected Frequency (Optional)"
                placeholder="e.g., Monthly, Weekly, As needed"
                value={newRelationship.expected_frequency}
                onChange={(e) => updateNewRelationship('expected_frequency', e.target.value)}
                description="How often this test should be done"
              />
            </>
          )}

          <Textarea
            label="Relevance Note (Optional)"
            placeholder="Describe how this lab result relates to the treatment"
            value={newRelationship.relevance_note}
            onChange={(e) => updateNewRelationship('relevance_note', e.target.value)}
            autosize
            minRows={2}
          />

          <RelationshipModalFooter
            onCancel={resetAndCloseModal}
            onSubmit={handleAddRelationship}
            loading={loading}
            disabled={selectedCount === 0}
            submitLabel={selectedCount > 1 ? `Link ${selectedCount} Lab Results` : 'Link Lab Result'}
          />
        </RelationshipAddModal>
      </Stack>
    </RelationshipContainer>
  );
}

TreatmentLabResultRelationships.propTypes = {
  treatmentId: PropTypes.number,
  labResults: PropTypes.array,
  isViewMode: PropTypes.bool,
  onRelationshipsChange: PropTypes.func,
  onEntityClick: PropTypes.func,
};

export default TreatmentLabResultRelationships;
