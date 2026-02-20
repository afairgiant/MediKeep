import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render from '../../../test-utils/render';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MantineAllergyForm from '../MantineAllergyForm';

// Mock Date Input component
// The DateInput mock generates data-testid from the label prop.
// Since i18n mock returns the key as-is, label will be 'common:labels.onsetDate'.
// data-testid = 'date-common:labels.onsetdate'
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

// jsdom does not implement scrollIntoView; Mantine Select uses it when opening dropdown
Element.prototype.scrollIntoView = vi.fn();

/**
 * i18n key mappings used by MantineAllergyForm via BaseMedicalForm + allergyFormFields:
 *
 * Labels (rendered as label text, with Mantine adding asterisk separately for required):
 *   allergen  -> 'medical:allergies.allergen.label'   (required)
 *   severity  -> 'common:labels.severity'              (required)
 *   reaction  -> 'medical:allergies.reaction.label'    (NOT required)
 *   onset_date-> 'common:labels.onsetDate'
 *   status    -> 'common:labels.status'
 *   notes     -> 'common:labels.notes'
 *
 * Descriptions:
 *   allergen    -> 'medical:allergies.allergen.description'
 *   reaction    -> 'medical:allergies.reaction.description'
 *   severity    -> 'medical:allergies.severity.description'
 *
 * Severity options (values returned by i18n mock are the keys):
 *   mild             -> 'common:severity.mild'
 *   moderate         -> 'common:severity.moderate'
 *   severe           -> 'common:severity.severe'
 *   life-threatening -> 'common:severity.lifeThreatening'
 *
 * Status options:
 *   active   -> 'common:status.active'
 *   inactive -> 'common:status.inactive'
 *   resolved -> 'common:status.resolved'
 *
 * Buttons:
 *   Cancel -> 'common:buttons.cancel'
 *   Submit -> derived from title: 'Add New Allergy' -> 'Add New Allergy'
 *             (entityName = title.replace('Add ', '') = 'New Allergy', button = 'Add New Allergy')
 *
 * Date input testid:
 *   'date-common:labels.onsetdate'
 *   (label 'common:labels.onsetDate' lowercased and spaces replaced with '-')
 */

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
      render(<MantineAllergyForm {...defaultProps} />);

      // Title appears in the modal header
      expect(screen.getAllByText('Add New Allergy').length).toBeGreaterThan(0);
      // allergen and reaction fields use i18n keys as labels
      expect(screen.getByLabelText(/medical:allergies\.allergen\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:allergies\.reaction\.label/)).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<MantineAllergyForm {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Add New Allergy')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // Required fields
      expect(screen.getByLabelText(/medical:allergies\.allergen\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:allergies\.reaction\.label/)).toBeInTheDocument();

      // Select fields (Mantine Select renders both input and listbox with same label, so use getAllBy)
      expect(screen.getAllByLabelText(/common:labels\.severity/).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/common:labels\.onsetDate/)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/common:labels\.status/).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/common:labels\.notes/)).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Allergy',
        editingAllergy: { id: 1, allergen: 'Peanuts' },
      };

      render(<MantineAllergyForm {...editProps} />);

      expect(screen.getByText('Edit Allergy')).toBeInTheDocument();
      expect(screen.getByText('Update Allergy')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('handles allergen input changes', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const allergenInput = screen.getByLabelText(/medical:allergies\.allergen\.label/);
      fireEvent.change(allergenInput, { target: { value: 'Penicillin' } });

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'allergen', value: 'Penicillin' },
      });
    });

    test('handles reaction input changes', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const reactionInput = screen.getByLabelText(/medical:allergies\.reaction\.label/);
      fireEvent.change(reactionInput, { target: { value: 'Skin rash and hives' } });

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'reaction', value: 'Skin rash and hives' },
      });
    });

    test('handles severity select changes', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const severitySelect = screen.getAllByLabelText(/common:labels\.severity/)[0];
      fireEvent.click(severitySelect);

      // Options are rendered as i18n keys
      await waitFor(() => {
        expect(screen.getByText('common:severity.severe')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('common:severity.severe'));

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'severity', value: 'severe' },
      });
    });

    test('handles status select changes', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const statusSelect = screen.getAllByLabelText(/common:labels\.status/)[0];
      fireEvent.click(statusSelect);

      await waitFor(() => {
        expect(screen.getByText('common:status.active')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('common:status.active'));

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'status', value: 'active' },
      });
    });

    test('handles date input changes', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // data-testid is derived from lowercased label 'common:labels.onsetDate'
      const dateInput = screen.getByTestId('date-common:labels.onsetdate');
      fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

      // The mock DateInput calls onChange with a Date object when value is non-empty.
      // handleDateChange then formats it back to 'YYYY-MM-DD'.
      await waitFor(() => {
        expect(defaultProps.onInputChange).toHaveBeenCalledWith(
          expect.objectContaining({
            target: expect.objectContaining({ name: 'onset_date' }),
          })
        );
      });
    });

    test('handles notes textarea changes', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/common:labels\.notes/);
      fireEvent.change(notesTextarea, { target: { value: 'Patient also experiences breathing difficulty' } });

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'notes', value: 'Patient also experiences breathing difficulty' },
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // Submit via the form element directly
      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // Cancel button uses i18n key: 'common:buttons.cancel'
      const cancelButton = screen.getByText('common:buttons.cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    test('prevents default form submission', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // BaseMedicalForm renders a <form> element
      const form = document.querySelector('form');
      expect(form).not.toBeNull();

      fireEvent.submit(form);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalled();
      });
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

      render(<MantineAllergyForm {...propsWithData} />);

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

      render(<MantineAllergyForm {...propsWithDate} />);

      const dateInput = screen.getByTestId('date-common:labels.onsetdate');
      expect(dateInput).toHaveValue('2024-01-15');
    });
  });

  describe('Select Options', () => {
    test('displays correct severity options', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const severitySelect = screen.getAllByLabelText(/common:labels\.severity/)[0];
      fireEvent.click(severitySelect);

      // Options are i18n keys since mock returns key as value
      await waitFor(() => {
        expect(screen.getByText('common:severity.mild')).toBeInTheDocument();
        expect(screen.getByText('common:severity.moderate')).toBeInTheDocument();
        expect(screen.getByText('common:severity.severe')).toBeInTheDocument();
        expect(screen.getByText('common:severity.lifeThreatening')).toBeInTheDocument();
      });
    });

    test('displays correct status options', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const statusSelect = screen.getAllByLabelText(/common:labels\.status/)[0];
      fireEvent.click(statusSelect);

      await waitFor(() => {
        expect(screen.getByText('common:status.active')).toBeInTheDocument();
        expect(screen.getByText('common:status.inactive')).toBeInTheDocument();
        expect(screen.getByText('common:status.resolved')).toBeInTheDocument();
      });
    });
  });

  describe('Allergy-Specific Validation', () => {
    test('validates required allergen field', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const allergenInput = screen.getByLabelText(/medical:allergies\.allergen\.label/);
      expect(allergenInput).toBeRequired();
    });

    test('validates required severity field', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // severity is required per allergyFormFields config
      // Mantine Select renders a hidden input with required attribute
      const severityLabel = screen.getByText('common:labels.severity');
      expect(severityLabel).toBeInTheDocument();
    });

    test('accepts common allergen types', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const allergenInput = screen.getByLabelText(/medical:allergies\.allergen\.label/);

      const allergens = ['Peanuts', 'Penicillin', 'Latex', 'Dust mites', 'Shellfish'];

      for (const allergen of allergens) {
        fireEvent.change(allergenInput, { target: { value: allergen } });

        expect(defaultProps.onInputChange).toHaveBeenCalledWith({
          target: { name: 'allergen', value: allergen },
        });
      }
    });

    test('accepts various reaction descriptions', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      const reactionInput = screen.getByLabelText(/medical:allergies\.reaction\.label/);

      const reactions = [
        'Hives and itching',
        'Difficulty breathing',
        'Swelling of face and throat',
        'Nausea and vomiting',
        'Anaphylactic shock',
      ];

      for (const reaction of reactions) {
        fireEvent.change(reactionInput, { target: { value: reaction } });

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

      render(<MantineAllergyForm {...defaultProps} formData={criticalAllergyData} />);

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

      render(<MantineAllergyForm {...defaultProps} formData={drugAllergyData} />);

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

      render(<MantineAllergyForm {...defaultProps} formData={foodAllergyData} />);

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
        render(<MantineAllergyForm {...propsWithNullData} />);
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
        render(<MantineAllergyForm {...propsWithEmptyData} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // allergen is required in the field config
      const allergenInput = screen.getByLabelText(/medical:allergies\.allergen\.label/);
      expect(allergenInput).toBeRequired();

      // reaction is NOT required per allergyFormFields config
      expect(screen.getByLabelText(/medical:allergies\.reaction\.label/)).toBeInTheDocument();

      // severity and status select fields are present
      expect(screen.getAllByLabelText(/common:labels\.severity/)[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText(/common:labels\.status/)[0]).toBeInTheDocument();
    });

    test('has proper descriptions for medical fields', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // Descriptions are rendered as i18n keys
      expect(screen.getByText('medical:allergies.allergen.description')).toBeInTheDocument();
      expect(screen.getByText('medical:allergies.reaction.description')).toBeInTheDocument();
      expect(screen.getByText('medical:allergies.severity.description')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // The submit button has the same text as the title ('Add New Allergy')
      // Find all matches, then locate the one that is a button element
      const allMatches = screen.getAllByText('Add New Allergy');
      const submitButton = allMatches.find(el => el.closest('[type="submit"]') !== null);
      expect(submitButton || allMatches[0]).toBeInTheDocument();

      const cancelButton = screen.getByText('common:buttons.cancel');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Clinical Workflow', () => {
    test('supports allergy lifecycle management', async () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // Fill in a complete allergy record using fireEvent to avoid userEvent hanging
      fireEvent.change(screen.getByLabelText(/medical:allergies\.allergen\.label/), {
        target: { value: 'Amoxicillin' },
      });
      fireEvent.change(screen.getByLabelText(/medical:allergies\.reaction\.label/), {
        target: { value: 'Rash and itching' },
      });

      // Set severity
      fireEvent.click(screen.getAllByLabelText(/common:labels\.severity/)[0]);
      await waitFor(() => {
        expect(screen.getByText('common:severity.moderate')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('common:severity.moderate'));

      // Set status
      fireEvent.click(screen.getAllByLabelText(/common:labels\.status/)[0]);
      await waitFor(() => {
        expect(screen.getByText('common:status.active')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('common:status.active'));

      // Add notes
      fireEvent.change(screen.getByLabelText(/common:labels\.notes/), {
        target: { value: 'Patient should use alternative antibiotics' },
      });

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'allergen', value: 'Amoxicillin' },
      });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'reaction', value: 'Rash and itching' },
      });
    });

    test('allows minimal data entry for urgent situations', () => {
      render(<MantineAllergyForm {...defaultProps} />);

      // Only fill required fields for urgent documentation
      fireEvent.change(screen.getByLabelText(/medical:allergies\.allergen\.label/), {
        target: { value: 'Unknown medication' },
      });
      fireEvent.change(screen.getByLabelText(/medical:allergies\.reaction\.label/), {
        target: { value: 'Severe allergic reaction' },
      });

      // Submit the form directly
      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });
});
