import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import render from '../../../../test-utils/render';
import FamilyHistoryViewModal from '../FamilyHistoryViewModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

const mockMember = {
  id: 1,
  name: 'John Doe',
  relationship: 'father',
  family_conditions: [
    {
      id: 10,
      condition_name: 'Hypertension',
      status: 'active',
      icd10_code: 'I10',
      severity: 'moderate',
      condition_type: 'cardiovascular',
      diagnosis_age: 45,
      notes: 'Controlled with medication'
    }
  ]
};

const renderModal = (props = {}) => {
  return render(
    <FamilyHistoryViewModal
      isOpen={true}
      onClose={vi.fn()}
      member={mockMember}
      onEdit={vi.fn()}
      onAddCondition={vi.fn()}
      onEditCondition={vi.fn()}
      onDeleteCondition={vi.fn()}
      {...props}
    />
  );
};

describe('FamilyHistoryViewModal Display', () => {
  it('renders status badge and ICD-10 code for conditions', () => {
    renderModal();
    
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
    expect(screen.getByText(/ICD-10:/i)).toBeInTheDocument();
    expect(screen.getByText('I10')).toBeInTheDocument();
  });

  it('renders "No medical conditions recorded" when member has no conditions', () => {
    renderModal({ member: { ...mockMember, family_conditions: [] } });
    expect(screen.getByText('familyHistory.card.noConditionsRecorded')).toBeInTheDocument();
  });
});