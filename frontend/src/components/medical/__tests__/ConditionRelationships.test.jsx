/**
 * Tests for ConditionRelationships component
 * Covers medication linking functionality and translations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/config';
import ConditionRelationships from '../ConditionRelationships';

// Mock API
const mockMedications = [
  { id: 1, medication_name: 'Lisinopril', dosage: '10mg' },
  { id: 2, medication_name: 'Metformin', dosage: '500mg' },
  { id: 3, medication_name: 'Atorvastatin', dosage: '20mg' },
];

const mockLinkedMedications = [
  {
    id: 1,
    medication_id: 1,
    medication: { id: 1, medication_name: 'Lisinopril', dosage: '10mg' },
    relevance_note: 'Controls blood pressure',
  },
];

const renderWithProviders = (component, locale = 'en') => {
  i18n.changeLanguage(locale);

  return render(
    <I18nextProvider i18n={i18n}>
      <MantineProvider>
        {component}
      </MantineProvider>
    </I18nextProvider>
  );
};

describe('ConditionRelationships Component', () => {
  const mockProps = {
    conditionId: 123,
    patientId: 456,
    linkedMedications: mockLinkedMedications,
    availableMedications: mockMedications,
    onAddMedication: vi.fn(),
    onRemoveMedication: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render linked medications section', () => {
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      expect(screen.getByText(/linked medications/i)).toBeInTheDocument();
    });

    it('should display linked medication with relevance note', () => {
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('10mg')).toBeInTheDocument();
      expect(screen.getByText('Controls blood pressure')).toBeInTheDocument();
    });

    it('should show message when no medications linked', () => {
      const propsNoMeds = { ...mockProps, linkedMedications: [] };
      renderWithProviders(<ConditionRelationships {...propsNoMeds} />);

      expect(screen.getByText(/no medications linked/i)).toBeInTheDocument();
    });

    it('should show link medication button', () => {
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      expect(linkButton).toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open modal when link medication button clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      await user.click(linkButton);

      await waitFor(() => {
        expect(screen.getByText(/link medication to condition/i)).toBeInTheDocument();
      });
    });

    it('should display available medications in modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      await user.click(linkButton);

      await waitFor(() => {
        expect(screen.getByText('Metformin')).toBeInTheDocument();
        expect(screen.getByText('Atorvastatin')).toBeInTheDocument();
      });
    });

    it('should not show already linked medications in modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      await user.click(linkButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        // Lisinopril is already linked, should not appear in available list
        const lisinoprilInModal = within(modal).queryByText('Lisinopril');
        expect(lisinoprilInModal).not.toBeInTheDocument();
      });
    });

    it('should call onAddMedication when medication selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      await user.click(linkButton);

      await waitFor(() => {
        const metforminCard = screen.getByText('Metformin').closest('button');
        return user.click(metforminCard);
      });

      expect(mockProps.onAddMedication).toHaveBeenCalledWith(
        expect.objectContaining({
          medication_id: 2,
        })
      );
    });

    it('should allow adding relevance note', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      await user.click(linkButton);

      await waitFor(async () => {
        const noteInput = screen.getByPlaceholderText(/relevance note/i);
        await user.type(noteInput, 'Used for diabetes management');

        const metforminCard = screen.getByText('Metformin').closest('button');
        await user.click(metforminCard);
      });

      expect(mockProps.onAddMedication).toHaveBeenCalledWith(
        expect.objectContaining({
          relevance_note: 'Used for diabetes management',
        })
      );
    });
  });

  describe('Remove Medication', () => {
    it('should show confirmation when removing medication', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const removeButton = screen.getByLabelText(/remove/i);
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText(/remove this medication relationship/i)).toBeInTheDocument();
      });
    });

    it('should call onRemoveMedication when confirmed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      const removeButton = screen.getByLabelText(/remove/i);
      await user.click(removeButton);

      await waitFor(async () => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        await user.click(confirmButton);
      });

      expect(mockProps.onRemoveMedication).toHaveBeenCalledWith(1);
    });
  });

  describe('Localization', () => {
    it('should display German translations', async () => {
      renderWithProviders(<ConditionRelationships {...mockProps} />, 'de');

      await waitFor(() => {
        expect(screen.getByText(/verknüpfte medikamente/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /medikament verknüpfen/i })).toBeInTheDocument();
      });
    });

    it('should display French translations', async () => {
      renderWithProviders(<ConditionRelationships {...mockProps} />, 'fr');

      await waitFor(() => {
        expect(screen.getByText(/médicaments liés/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /lier un médicament/i })).toBeInTheDocument();
      });
    });

    it('should show modal title in selected language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConditionRelationships {...mockProps} />, 'de');

      const linkButton = screen.getByRole('button', { name: /medikament verknüpfen/i });
      await user.click(linkButton);

      await waitFor(() => {
        expect(screen.getByText(/medikament mit erkrankung verknüpfen/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton when isLoading is true', () => {
      const loadingProps = { ...mockProps, isLoading: true };
      renderWithProviders(<ConditionRelationships {...loadingProps} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should disable buttons when loading', () => {
      const loadingProps = { ...mockProps, isLoading: true };
      renderWithProviders(<ConditionRelationships {...loadingProps} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      expect(linkButton).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty available medications', () => {
      const propsNoAvailable = { ...mockProps, availableMedications: [] };
      renderWithProviders(<ConditionRelationships {...propsNoAvailable} />);

      const linkButton = screen.getByRole('button', { name: /link medication/i });
      expect(linkButton).toBeDisabled();
    });

    it('should show count of available medications', () => {
      renderWithProviders(<ConditionRelationships {...mockProps} />);

      // 3 total medications - 1 already linked = 2 available
      expect(screen.getByText(/2.*medications available/i)).toBeInTheDocument();
    });

    it('should handle medication without relevance note', () => {
      const propsNoNote = {
        ...mockProps,
        linkedMedications: [
          {
            id: 1,
            medication_id: 1,
            medication: { id: 1, medication_name: 'Lisinopril', dosage: '10mg' },
            relevance_note: null,
          },
        ],
      };

      renderWithProviders(<ConditionRelationships {...propsNoNote} />);

      expect(screen.getByText(/no relevance note provided/i)).toBeInTheDocument();
    });
  });
});
