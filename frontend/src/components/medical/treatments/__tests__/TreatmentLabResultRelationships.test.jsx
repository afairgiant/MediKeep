import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import render from '../../../../test-utils/render';
import TreatmentLabResultRelationships from '../TreatmentLabResultRelationships';

const state = vi.hoisted(() => ({ editingRelationship: null }));

vi.mock('../../../../hooks/useTreatmentRelationships', () => ({
  useTreatmentRelationships: () => ({
    relationships: [
      {
        id: 1,
        lab_result_id: 3,
        purpose: 'monitoring',
        lab_result: { id: 3, test_name: 'Liver Panel' },
      },
    ],
    loading: false,
    showAddModal: false,
    editingRelationship: state.editingRelationship,
    newRelationship: { lab_result_ids: [] },
    error: null,
    fetchRelationships: vi.fn(),
    handleAddRelationship: vi.fn(),
    handleEditRelationship: vi.fn(),
    handleDeleteRelationship: vi.fn(),
    resetAndCloseModal: vi.fn(),
    openAddModal: vi.fn(),
    startEditing: vi.fn(),
    cancelEditing: vi.fn(),
    updateNewRelationship: vi.fn(),
    updateEditingRelationship: vi.fn(),
    clearError: vi.fn(),
  }),
}));
vi.mock('../../../../hooks/useTreatmentInlineCreate', () => ({
  useTreatmentInlineCreate: () => ({ onCreateNew: null, createLabel: null }),
}));
vi.mock('../../../../hooks/useLinkPanelDescription', () => ({
  useLinkPanelDescription: () => () => '',
}));
vi.mock('../../../../services/api', () => ({ apiService: {} }));

describe('TreatmentLabResultRelationships', () => {
  beforeEach(() => {
    state.editingRelationship = null;
  });

  it('shows the purpose of a linked lab result translated', () => {
    render(
      <TreatmentLabResultRelationships
        treatmentId={9}
        labResults={[]}
        isViewMode
      />
    );
    expect(screen.getByText('Liver Panel')).toBeInTheDocument();
    expect(
      screen.getByText('shared:linkPurposes.monitoring')
    ).toBeInTheDocument();
  });

  it('translates the fields for editing a link (no hardcoded English)', () => {
    state.editingRelationship = { id: 1, purpose: 'monitoring' };
    render(
      <TreatmentLabResultRelationships
        treatmentId={9}
        labResults={[]}
        isViewMode={false}
      />
    );
    expect(
      screen.getByPlaceholderText('visits.relationships.purpose')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        'treatments.links.expectedFrequencyPlaceholder'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('modals.relevanceNoteOptional')
    ).toBeInTheDocument();
  });
});
