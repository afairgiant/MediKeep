import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import MantineAllergyForm from '../MantineAllergyForm';

// Mock Date Input component
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label, value, onChange, required, ...props }) => (
    <div>
      <label htmlFor={`date-${label}`}>{label}{required && ' *'}</label>
      <input
        id={`date-${label}`}
        type="date"
        value={value ? (value instanceof Date ? value.toISOString().split('T')[0] : value) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
        data-testid={`date-${label.toLowerCase().replace(/\s+/g, '-')}`}
        {...props}
      />
    </div>
  ),
}));

// Wrapper component with Mantine provider
const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('MantineAllergyForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Add New Allergy',
    formData: {
      allergen: '',
      reaction: '',
      severity: '',
      onset_date: '',
      status: '',
      notes: '',
    },
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    editingAllergy: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
      expect(screen.getByLabelText('Allergen *')).toBeInTheDocument();
      expect(screen.getByLabelText('Reaction *')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} isOpen={false} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Add New Allergy')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      // Required fields
      expect(screen.getByLabelText('Allergen *')).toBeInTheDocument();
      expect(screen.getByLabelText('Reaction *')).toBeInTheDocument();

      // Optional fields
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
      expect(screen.getByLabelText('Onset Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Additional Notes')).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Allergy',
        editingAllergy: { id: 1, allergen: 'Peanuts' },
      };

      render(
        <MantineWrapper>
          <MantineAllergyForm {...editProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Edit Allergy')).toBeInTheDocument();
      expect(screen.getByText('Update Allergy')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('handles allergen input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const allergenInput = screen.getByLabelText('Allergen *');
      await user.type(allergenInput, 'Penicillin');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'allergen', value: 'Penicillin' },
      });
    });

    test('handles reaction input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const reactionInput = screen.getByLabelText('Reaction *');
      await user.type(reactionInput, 'Skin rash and hives');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'reaction', value: 'Skin rash and hives' },
      });
    });

    test('handles severity select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const severitySelect = screen.getByLabelText('Severity');
      await user.click(severitySelect);
      
      // Look for severity options
      const severeOption = screen.getByText('Severe - Significant symptoms requiring immediate attention');
      await user.click(severeOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'severity', value: 'severe' },
      });
    });

    test('handles status select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);
      
      const activeOption = screen.getByText('Active - Currently allergic');
      await user.click(activeOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'status', value: 'active' },
      });
    });

    test('handles date input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const dateInput = screen.getByTestId('date-onset-date');
      await user.type(dateInput, '2024-01-15');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'onset_date', value: '2024-01-15' },
      });
    });

    test('handles notes textarea changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const notesTextarea = screen.getByLabelText('Additional Notes');
      await user.type(notesTextarea, 'Patient also experiences breathing difficulty');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'notes', value: 'Patient also experiences breathing difficulty' },
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Allergy');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('prevents default form submission', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const form = screen.getByRole('form');
      
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('populates form with existing allergy data', () => {
      const populatedData = {
        allergen: 'Shellfish',
        reaction: 'Anaphylaxis',
        severity: 'severe',
        onset_date: '2023-05-20',
        status: 'active',
        notes: 'Carries EpiPen at all times',
      };

      const propsWithData = {
        ...defaultProps,
        formData: populatedData,
      };

      render(
        <MantineWrapper>
          <MantineAllergyForm {...propsWithData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('Shellfish')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Anaphylaxis')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Carries EpiPen at all times')).toBeInTheDocument();
    });

    test('handles date formatting correctly', () => {
      const propsWithDate = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          onset_date: '2024-01-15',
        },
      };

      render(
        <MantineWrapper>
          <MantineAllergyForm {...propsWithDate} />
        </MantineWrapper>
      );

      const dateInput = screen.getByTestId('date-onset-date');
      expect(dateInput).toHaveValue('2024-01-15');
    });
  });

  describe('Select Options', () => {
    test('displays correct severity options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const severitySelect = screen.getByLabelText('Severity');
      await user.click(severitySelect);

      expect(screen.getByText('Mild - Minor symptoms, easily manageable')).toBeInTheDocument();
      expect(screen.getByText('Moderate - Noticeable symptoms requiring treatment')).toBeInTheDocument();
      expect(screen.getByText('Severe - Significant symptoms requiring immediate attention')).toBeInTheDocument();
      expect(screen.getByText('Critical - Life-threatening, requires emergency care')).toBeInTheDocument();
    });

    test('displays correct status options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);

      expect(screen.getByText('Active - Currently allergic')).toBeInTheDocument();
      expect(screen.getByText('Inactive - No longer allergic')).toBeInTheDocument();
      expect(screen.getByText('Resolved - Allergy has resolved')).toBeInTheDocument();
    });
  });

  describe('Allergy-Specific Validation', () => {
    test('validates required allergen field', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const allergenInput = screen.getByLabelText('Allergen *');
      expect(allergenInput).toBeRequired();
    });

    test('validates required reaction field', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const reactionInput = screen.getByLabelText('Reaction *');
      expect(reactionInput).toBeRequired();
    });

    test('accepts common allergen types', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const allergenInput = screen.getByLabelText('Allergen *');
      
      // Test various common allergen types
      const allergens = ['Peanuts', 'Penicillin', 'Latex', 'Dust mites', 'Shellfish'];
      
      for (const allergen of allergens) {
        await user.clear(allergenInput);
        await user.type(allergenInput, allergen);
        
        expect(defaultProps.onInputChange).toHaveBeenCalledWith({
          target: { name: 'allergen', value: allergen },
        });
      }
    });

    test('accepts various reaction descriptions', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const reactionInput = screen.getByLabelText('Reaction *');
      
      const reactions = [
        'Hives and itching',
        'Difficulty breathing',
        'Swelling of face and throat',
        'Nausea and vomiting',
        'Anaphylactic shock'
      ];
      
      for (const reaction of reactions) {
        await user.clear(reactionInput);
        await user.type(reactionInput, reaction);
        
        expect(defaultProps.onInputChange).toHaveBeenCalledWith({
          target: { name: 'reaction', value: reaction },
        });
      }
    });
  });

  describe('Medical Safety Features', () => {
    test('handles critical allergies appropriately', () => {
      const criticalAllergyData = {
        allergen: 'Penicillin',
        reaction: 'Anaphylaxis',
        severity: 'critical',
        status: 'active',
        notes: 'ALERT: Patient has history of anaphylactic shock. Requires immediate medical attention if exposed.',
      };

      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} formData={criticalAllergyData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('Penicillin')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Anaphylaxis')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ALERT: Patient has history of anaphylactic shock. Requires immediate medical attention if exposed.')).toBeInTheDocument();
    });

    test('supports drug allergy documentation', () => {
      const drugAllergyData = {
        allergen: 'Sulfonamides',
        reaction: 'Stevens-Johnson syndrome',
        severity: 'severe',
        status: 'active',
        onset_date: '2022-08-15',
        notes: 'Avoid all sulfa-containing medications',
      };

      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} formData={drugAllergyData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('Sulfonamides')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Stevens-Johnson syndrome')).toBeInTheDocument();
    });

    test('supports food allergy documentation', () => {
      const foodAllergyData = {
        allergen: 'Tree nuts (almonds, walnuts)',
        reaction: 'Oral allergy syndrome, throat swelling',
        severity: 'moderate',
        status: 'active',
        notes: 'Patient avoids all tree nuts and products containing tree nuts',
      };

      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} formData={foodAllergyData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('Tree nuts (almonds, walnuts)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Oral allergy syndrome, throat swelling')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles null/undefined form data gracefully', () => {
      const propsWithNullData = {
        ...defaultProps,
        formData: {
          allergen: null,
          reaction: undefined,
          severity: '',
        },
      };

      expect(() => {
        render(
          <MantineWrapper>
            <MantineAllergyForm {...propsWithNullData} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });

    test('handles empty string values gracefully', () => {
      const propsWithEmptyData = {
        ...defaultProps,
        formData: {
          allergen: '',
          reaction: '',
          severity: '',
          onset_date: '',
          status: '',
          notes: '',
        },
      };

      expect(() => {
        render(
          <MantineWrapper>
            <MantineAllergyForm {...propsWithEmptyData} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      // Check required fields have asterisks
      expect(screen.getByLabelText('Allergen *')).toBeInTheDocument();
      expect(screen.getByLabelText('Reaction *')).toBeInTheDocument();

      // Check optional fields don't have asterisks
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    test('has proper descriptions for medical fields', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('What causes the allergic reaction')).toBeInTheDocument();
      expect(screen.getByText('How the body reacts to the allergen')).toBeInTheDocument();
      expect(screen.getByText('How severe the allergic reaction is')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Allergy');
      const cancelButton = screen.getByText('Cancel');

      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Clinical Workflow', () => {
    test('supports allergy lifecycle management', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      // Fill in a complete allergy record
      await user.type(screen.getByLabelText('Allergen *'), 'Amoxicillin');
      await user.type(screen.getByLabelText('Reaction *'), 'Rash and itching');
      
      // Set severity
      await user.click(screen.getByLabelText('Severity'));
      await user.click(screen.getByText('Moderate - Noticeable symptoms requiring treatment'));
      
      // Set status
      await user.click(screen.getByLabelText('Status'));
      await user.click(screen.getByText('Active - Currently allergic'));

      // Add notes
      await user.type(screen.getByLabelText('Additional Notes'), 'Patient should use alternative antibiotics');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'allergen', value: 'Amoxicillin' },
      });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'reaction', value: 'Rash and itching' },
      });
    });

    test('allows minimal data entry for urgent situations', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineAllergyForm {...defaultProps} />
        </MantineWrapper>
      );

      // Only fill required fields for urgent documentation
      await user.type(screen.getByLabelText('Allergen *'), 'Unknown medication');
      await user.type(screen.getByLabelText('Reaction *'), 'Severe allergic reaction');

      const submitButton = screen.getByText('Add Allergy');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });
});
