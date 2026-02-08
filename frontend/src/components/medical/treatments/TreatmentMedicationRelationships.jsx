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
import { DateInput } from '@mantine/dates';
import { IconPill } from '@tabler/icons-react';
import { parseDateInput, formatDateInputChange } from '../../../utils/dateUtils';
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
  'specific_dosage', 'specific_frequency', 'relevance_note',
  'specific_prescriber_id', 'specific_pharmacy_id',
  'specific_start_date', 'specific_end_date',
];

function buildSinglePayload(newRelationship) {
  return {
    medication_id: parseInt(newRelationship.medication_ids[0]),
    specific_dosage: newRelationship.specific_dosage || null,
    specific_frequency: newRelationship.specific_frequency || null,
    specific_duration: newRelationship.specific_duration || null,
    timing_instructions: newRelationship.timing_instructions || null,
    relevance_note: newRelationship.relevance_note || null,
    specific_prescriber_id: newRelationship.specific_prescriber_id ? parseInt(newRelationship.specific_prescriber_id) : null,
    specific_pharmacy_id: newRelationship.specific_pharmacy_id ? parseInt(newRelationship.specific_pharmacy_id) : null,
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
  onRelationshipsChange,
  onEntityClick,
}) {
  const { t } = useTranslation('common');
  // Ensure medications is always an array
  const safeMedications = Array.isArray(medications) ? medications : [];

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
    type: 'medication',
    treatmentId,
    initialState: INITIAL_RELATIONSHIP_STATE,
    onRelationshipsChange,
    buildSinglePayload,
    buildBulkPayload,
  });

  const getMedicationById = (medicationId) => {
    return safeMedications.find(m => m.id === medicationId);
  };

  const medicationOptions = createSelectOptions(safeMedications, formatMedicationLabel);
  const availableOptions = filterAvailableOptions(medicationOptions, relationships, 'medication_id');
  const selectedCount = newRelationship.medication_ids.length;

  return (
    <RelationshipContainer loading={loading}>
      <Stack gap="md">
        <RelationshipErrorAlert error={error} onDismiss={clearError} />

        {relationships.length > 0 ? (
          <Stack gap="sm">
            {relationships.map(relationship => {
              const medication = relationship.medication || getMedicationById(relationship.medication_id);
              const isEditing = editingRelationship?.id === relationship.id;

              return (
                <RelationshipRow key={relationship.id}>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm" wrap="wrap">
                      <Badge
                        variant="light"
                        color="teal"
                        leftSection={<IconPill size={12} />}
                        style={isViewMode && onEntityClick ? { cursor: 'pointer' } : undefined}
                        onClick={isViewMode && onEntityClick ? () => onEntityClick(relationship.medication_id) : undefined}
                      >
                        {medication?.medication_name || `Medication ID: ${relationship.medication_id}`}
                      </Badge>
                      {(relationship.specific_dosage || medication?.dosage) && (
                        <Badge variant="outline" size="sm">
                          {relationship.specific_dosage || medication?.dosage}
                        </Badge>
                      )}
                      {(relationship.specific_frequency || medication?.frequency) && (
                        <Badge variant="outline" size="sm" color="cyan">
                          {relationship.specific_frequency || medication?.frequency}
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
                        <strong>Timing:</strong> {relationship.timing_instructions}
                      </Text>
                    )}

                    {!isViewMode && isEditing ? (
                      <Stack gap="xs">
                        <TextInput
                          size="xs"
                          placeholder="Specific dosage for this treatment"
                          value={editingRelationship?.specific_dosage || ''}
                          onChange={(e) => updateEditingRelationship('specific_dosage', e.target.value)}
                        />
                        <TextInput
                          size="xs"
                          placeholder="Specific frequency"
                          value={editingRelationship?.specific_frequency || ''}
                          onChange={(e) => updateEditingRelationship('specific_frequency', e.target.value)}
                        />
                        <Group grow gap="xs">
                          <Select
                            size="xs"
                            placeholder="Treatment prescriber"
                            data={practitioners.map(p => ({
                              value: p.id.toString(),
                              label: `${p.name}${p.specialty ? ` - ${p.specialty}` : ''}`,
                            }))}
                            value={editingRelationship?.specific_prescriber_id?.toString() || ''}
                            onChange={(value) => updateEditingRelationship('specific_prescriber_id', value || '')}
                            clearable
                            searchable
                            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                          <Select
                            size="xs"
                            placeholder="Treatment pharmacy"
                            data={pharmacies.map(p => ({
                              value: p.id.toString(),
                              label: p.name || p.brand || `Pharmacy #${p.id}`,
                            }))}
                            value={editingRelationship?.specific_pharmacy_id?.toString() || ''}
                            onChange={(value) => updateEditingRelationship('specific_pharmacy_id', value || '')}
                            clearable
                            searchable
                            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                        </Group>
                        <Group grow gap="xs">
                          <DateInput
                            size="xs"
                            placeholder="Start date"
                            value={parseDateInput(editingRelationship?.specific_start_date)}
                            onChange={(date) => updateEditingRelationship('specific_start_date', formatDateInputChange(date))}
                            clearable
                            popoverProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                          <DateInput
                            size="xs"
                            placeholder="End date"
                            value={parseDateInput(editingRelationship?.specific_end_date)}
                            onChange={(date) => updateEditingRelationship('specific_end_date', formatDateInputChange(date))}
                            clearable
                            popoverProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                        </Group>
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
                        specific_dosage: editingRelationship?.specific_dosage || null,
                        specific_frequency: editingRelationship?.specific_frequency || null,
                        relevance_note: editingRelationship?.relevance_note || null,
                        specific_prescriber_id: editingRelationship?.specific_prescriber_id ? parseInt(editingRelationship.specific_prescriber_id) : null,
                        specific_pharmacy_id: editingRelationship?.specific_pharmacy_id ? parseInt(editingRelationship.specific_pharmacy_id) : null,
                        specific_start_date: editingRelationship?.specific_start_date || null,
                        specific_end_date: editingRelationship?.specific_end_date || null,
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
            message={t('labels.noMedicationsLinked', 'No medications linked to this treatment')}
            description="Link medications to track what is prescribed for this treatment plan."
            isViewMode={isViewMode}
          />
        )}

        {!isViewMode && (
          <RelationshipAddFooter
            availableCount={availableOptions.length}
            entityName="medication"
            buttonLabel={t('buttons.linkMedication', 'Link Medication')}
            onAdd={openAddModal}
            loading={loading}
          />
        )}

        <RelationshipAddModal
          opened={showAddModal}
          onClose={resetAndCloseModal}
          title="Link Medications to Treatment"
        >
          <MultiSelect
            label="Select Medications"
            placeholder="Choose medications to link"
            data={availableOptions}
            value={newRelationship.medication_ids}
            onChange={(values) => updateNewRelationship('medication_ids', values)}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          {selectedCount === 1 && (
            <>
              <TextInput
                label="Specific Dosage (Optional)"
                placeholder="e.g., 400mg 3x daily with meals"
                value={newRelationship.specific_dosage}
                onChange={(e) => updateNewRelationship('specific_dosage', e.target.value)}
                description="Override the medication's default dosage for this treatment"
              />

              <TextInput
                label="Duration (Optional)"
                placeholder="e.g., 2 weeks, Until symptoms resolve"
                value={newRelationship.specific_duration}
                onChange={(e) => updateNewRelationship('specific_duration', e.target.value)}
              />

              <TextInput
                label="Timing Instructions (Optional)"
                placeholder="e.g., Take 30 min before PT session"
                value={newRelationship.timing_instructions}
                onChange={(e) => updateNewRelationship('timing_instructions', e.target.value)}
              />

              <Group grow gap="sm">
                <Select
                  label="Treatment Prescriber"
                  placeholder="Override prescriber"
                  data={practitioners.map(p => ({
                    value: p.id.toString(),
                    label: `${p.name}${p.specialty ? ` - ${p.specialty}` : ''}`,
                  }))}
                  value={newRelationship.specific_prescriber_id || null}
                  onChange={(value) => updateNewRelationship('specific_prescriber_id', value || '')}
                  clearable
                  searchable
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />
                <Select
                  label="Treatment Pharmacy"
                  placeholder="Override pharmacy"
                  data={pharmacies.map(p => ({
                    value: p.id.toString(),
                    label: p.name || p.brand || `Pharmacy #${p.id}`,
                  }))}
                  value={newRelationship.specific_pharmacy_id || null}
                  onChange={(value) => updateNewRelationship('specific_pharmacy_id', value || '')}
                  clearable
                  searchable
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />
              </Group>

              <Group grow gap="sm">
                <DateInput
                  label="Treatment Start Date"
                  placeholder="Override start date"
                  value={parseDateInput(newRelationship.specific_start_date)}
                  onChange={(date) => updateNewRelationship('specific_start_date', formatDateInputChange(date))}
                  clearable
                  popoverProps={{ withinPortal: true, zIndex: 4000 }}
                />
                <DateInput
                  label="Treatment End Date"
                  placeholder="Override end date"
                  value={parseDateInput(newRelationship.specific_end_date)}
                  onChange={(date) => updateNewRelationship('specific_end_date', formatDateInputChange(date))}
                  clearable
                  popoverProps={{ withinPortal: true, zIndex: 4000 }}
                />
              </Group>
            </>
          )}

          <Textarea
            label="Relevance Note (Optional)"
            placeholder="Describe how this medication relates to the treatment"
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
            submitLabel={selectedCount > 1 ? `Link ${selectedCount} Medications` : 'Link Medication'}
          />
        </RelationshipAddModal>
      </Stack>
    </RelationshipContainer>
  );
}

TreatmentMedicationRelationships.propTypes = {
  treatmentId: PropTypes.number,
  medications: PropTypes.array,
  practitioners: PropTypes.array,
  pharmacies: PropTypes.array,
  isViewMode: PropTypes.bool,
  onRelationshipsChange: PropTypes.func,
  onEntityClick: PropTypes.func,
};

export default TreatmentMedicationRelationships;
