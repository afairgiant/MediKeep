/**
 * Regression test for #1165: the View, Edit and Delete buttons on a symptom
 * card were pale `light` buttons while every other record type renders them as
 * the solid `filled` buttons from BaseMedicalCard (Delete in red).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { act } from '@testing-library/react';
import render, { screen } from '../../../test-utils/render';

const { mockGetAll, stablePatientData } = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
  stablePatientData: {
    patient: { patient: { id: 1, first_name: 'John', last_name: 'Doe' } },
    practitioners: { practitioners: [] },
    pharmacies: { pharmacies: [] },
  },
}));

vi.mock('../../../services/api/symptomApi', () => ({
  symptomApi: {
    getAll: mockGetAll,
    delete: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  usePatientWithStaticData: () => stablePatientData,
  useCurrentPatient: () => ({
    patient: { id: 1, owner_user_id: 1, permission_level: 'full' },
    loading: false,
  }),
}));

vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({
    isOwner: true,
    permissionLevel: 'full',
    canCreate: true,
    canEdit: true,
    canDelete: true,
    isViewOnly: false,
    viewOnlyTooltip: undefined,
  }),
}));

vi.mock('../../../hooks/useViewModalNavigation', () => ({
  useViewModalNavigation: () => ({
    isOpen: false,
    viewingItem: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: d => d || '' }),
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../components/medical/MantineSymptomForm', () => ({
  default: () => null,
}));

vi.mock('../../../components/medical/MantineSymptomOccurrenceForm', () => ({
  default: () => null,
}));

vi.mock('../../../components/medical/SymptomTimeline', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/medical/SymptomCalendar', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/medical/symptoms', () => ({
  SymptomViewModal: () => null,
}));

vi.mock('../../../components', () => ({
  PageHeader: () => <div />,
}));

import Symptoms from '../Symptoms';

const symptom = {
  id: 7,
  symptom_name: 'Migraine',
  status: 'active',
  is_chronic: false,
  category: null,
  occurrence_count: 2,
  typical_triggers: [],
  tags: [],
  general_notes: null,
};

describe('Symptoms page - card button styling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue([symptom]);
  });

  it('renders View, Edit and Delete on the card as text-only filled buttons, Delete in red', async () => {
    render(<Symptoms />);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const viewButton = await screen.findByRole('button', { name: /view/i });
    const editButton = screen.getByRole('button', { name: /edit/i });
    const deleteButton = screen.getByRole('button', { name: /delete/i });

    expect(viewButton).toHaveAttribute('data-variant', 'filled');
    expect(editButton).toHaveAttribute('data-variant', 'filled');
    expect(deleteButton).toHaveAttribute('data-variant', 'filled');
    expect(deleteButton.getAttribute('style')).toContain('red');

    [viewButton, editButton, deleteButton].forEach(button => {
      expect(button.querySelector('svg')).toBeNull();
    });
  });
});
