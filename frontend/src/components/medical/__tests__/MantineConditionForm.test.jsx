import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, fireEvent, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MantineConditionForm from '../MantineConditionForm';

// Mock Date Input component since it has complex dependencies
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label, value, onChange, required, description, ...props }) => (
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
      {description && <p>{description}</p>}
    </div>
  ),
}));

// Mock scrollIntoView for Mantine Select/Combobox
Element.prototype.scrollIntoView = vi.fn();

describe('MantineConditionForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Add New Condition',
    formData: {
      diagnosis: '',
      status: '',
      severity: '',
      onset_date: '',
      end_date: '',
      icd10_code: '',
      snomed_code: '',
      code_description: '',
      notes: '',
    },
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    editingCondition: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper for Select inputs (Mantine renders both input + listbox)
  function getSelectInput(labelRegex) {
    return screen.getAllByLabelText(labelRegex)[0];
  }

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(<MantineConditionForm {...defaultProps} />);

      // Title and button both show 'Add New Condition'
      expect(screen.getAllByText('Add New Condition').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/medical:conditions\.diagnosis\.label/)).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<MantineConditionForm {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Add New Condition')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(<MantineConditionForm {...defaultProps} />);

      // Required field - diagnosis
      expect(screen.getByLabelText(/medical:conditions\.diagnosis\.label/)).toBeInTheDocument();

      // Select fields
      expect(screen.getAllByLabelText(/common:labels\.status/).length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText(/common:labels\.severity/).length).toBeGreaterThan(0);

      // Date fields
      expect(screen.getByLabelText(/common:labels\.onsetDate/)).toBeInTheDocument();
      expect(screen.getByLabelText(/common:labels\.endDate/)).toBeInTheDocument();

      // Medical coding fields
      expect(screen.getByLabelText(/medical:conditions\.icd10Code\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:conditions\.snomedCode\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:conditions\.codeDescription\.label/)).toBeInTheDocument();

      // Notes
      expect(screen.getByLabelText(/common:labels\.notes/)).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Condition',
        editingCondition: { id: 1, diagnosis: 'Hypertension' },
      };

      render(<MantineConditionForm {...editProps} />);

      expect(screen.getByText('Edit Condition')).toBeInTheDocument();
      const submitButton = document.querySelector('button[type="submit"]');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton.textContent).toContain('Update Condition');
    });
  });

  describe('Form Interactions', () => {
    test('handles diagnosis input changes', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const diagnosisInput = screen.getByLabelText(/medical:conditions\.diagnosis\.label/);
      fireEvent.change(diagnosisInput, { target: { value: 'Essential Hypertension' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles status select changes', async () => {
      render(<MantineConditionForm {...defaultProps} />);

      const statusInput = getSelectInput(/common:labels\.status/);
      await userEvent.click(statusInput);

      const activeOption = await screen.findByText('Active - Currently being treated');
      await userEvent.click(activeOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'status', value: 'active' },
      });
    });

    test('handles severity select changes', async () => {
      render(<MantineConditionForm {...defaultProps} />);

      const severityInput = getSelectInput(/common:labels\.severity/);
      await userEvent.click(severityInput);

      const moderateOption = await screen.findByText('Moderate - Noticeable impact');
      await userEvent.click(moderateOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'severity', value: 'moderate' },
      });
    });

    test('handles medical code inputs', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const icd10Input = screen.getByLabelText(/medical:conditions\.icd10Code\.label/);
      fireEvent.change(icd10Input, { target: { value: 'I10' } });
      expect(defaultProps.onInputChange).toHaveBeenCalled();

      const snomedInput = screen.getByLabelText(/medical:conditions\.snomedCode\.label/);
      fireEvent.change(snomedInput, { target: { value: '38341003' } });
      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles date input changes', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const onsetDateInput = screen.getByTestId('date-common:labels.onsetdate');
      fireEvent.change(onsetDateInput, { target: { value: '2024-01-15' } });

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'onset_date' }),
        })
      );
    });

    test('handles notes textarea changes', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/common:labels\.notes/);
      fireEvent.change(notesTextarea, { target: { value: 'Patient shows mild symptoms' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      render(<MantineConditionForm {...defaultProps} />);

      const cancelButton = screen.getByText('common:buttons.cancel');
      await userEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('prevents default form submission', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('populates form with existing condition data', () => {
      const populatedData = {
        diagnosis: 'Type 2 Diabetes',
        status: 'chronic',
        severity: 'moderate',
        onset_date: '2023-06-15',
        end_date: '',
        icd10_code: 'E11',
        snomed_code: '44054006',
        code_description: 'Type 2 diabetes mellitus',
        notes: 'Well controlled with medication',
      };

      const propsWithData = {
        ...defaultProps,
        formData: populatedData,
      };

      render(<MantineConditionForm {...propsWithData} />);

      expect(screen.getByDisplayValue('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.getByDisplayValue('E11')).toBeInTheDocument();
      expect(screen.getByDisplayValue('44054006')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Type 2 diabetes mellitus')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Well controlled with medication')).toBeInTheDocument();
    });

    test('handles date formatting correctly', () => {
      const propsWithDate = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          onset_date: '2024-01-15',
          end_date: '2024-02-15',
        },
      };

      render(<MantineConditionForm {...propsWithDate} />);

      const onsetDateInput = screen.getByTestId('date-common:labels.onsetdate');
      const endDateInput = screen.getByTestId('date-common:labels.enddate');

      expect(onsetDateInput).toHaveValue('2024-01-15');
      expect(endDateInput).toHaveValue('2024-02-15');
    });
  });

  describe('Select Options Validation', () => {
    test('displays correct status options', async () => {
      render(<MantineConditionForm {...defaultProps} />);

      const statusInput = getSelectInput(/common:labels\.status/);
      await userEvent.click(statusInput);

      expect(screen.getByText('Active - Currently being treated')).toBeInTheDocument();
      expect(screen.getByText('Inactive - Not currently treated')).toBeInTheDocument();
      expect(screen.getByText('Resolved - No longer an issue')).toBeInTheDocument();
      expect(screen.getByText('Chronic - Long-term condition')).toBeInTheDocument();
      expect(screen.getByText('Recurrence - Condition has returned')).toBeInTheDocument();
    });

    test('displays correct severity options', async () => {
      render(<MantineConditionForm {...defaultProps} />);

      const severityInput = getSelectInput(/common:labels\.severity/);
      await userEvent.click(severityInput);

      expect(screen.getByText('Mild - Minor impact')).toBeInTheDocument();
      expect(screen.getByText('Moderate - Noticeable impact')).toBeInTheDocument();
      expect(screen.getByText('Severe - Significant impact')).toBeInTheDocument();
      expect(screen.getByText('Critical - Life-threatening')).toBeInTheDocument();
    });
  });

  describe('Medical Coding Validation', () => {
    test('accepts valid ICD-10 codes', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const icd10Input = screen.getByLabelText(/medical:conditions\.icd10Code\.label/);
      fireEvent.change(icd10Input, { target: { value: 'I10' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('accepts valid SNOMED codes', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const snomedInput = screen.getByLabelText(/medical:conditions\.snomedCode\.label/);
      fireEvent.change(snomedInput, { target: { value: '38341003' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('links code description with codes', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const codeDescriptionInput = screen.getByLabelText(/medical:conditions\.codeDescription\.label/);
      fireEvent.change(codeDescriptionInput, { target: { value: 'Essential hypertension' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('handles null/undefined form data gracefully', () => {
      const propsWithNullData = {
        ...defaultProps,
        formData: {
          diagnosis: null,
          status: undefined,
          severity: '',
        },
      };

      expect(() => {
        render(<MantineConditionForm {...propsWithNullData} />);
      }).not.toThrow();
    });

    test('handles missing status config gracefully', () => {
      expect(() => {
        render(<MantineConditionForm {...defaultProps} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(<MantineConditionForm {...defaultProps} />);

      // Check required field exists
      expect(screen.getByLabelText(/medical:conditions\.diagnosis\.label/)).toBeInTheDocument();

      // Check optional select fields exist
      expect(screen.getAllByLabelText(/common:labels\.status/).length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText(/common:labels\.severity/).length).toBeGreaterThan(0);
    });

    test('has proper descriptions for medical fields', () => {
      render(<MantineConditionForm {...defaultProps} />);

      expect(screen.getByText('medical:conditions.diagnosis.description')).toBeInTheDocument();
      expect(screen.getByText('medical:conditions.status.description')).toBeInTheDocument();
      expect(screen.getByText('medical:conditions.severity.description')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const submitButton = document.querySelector('button[type="submit"]');
      const cancelButton = screen.getByText('common:buttons.cancel');

      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('shows required field indicator for diagnosis', () => {
      render(<MantineConditionForm {...defaultProps} />);

      const diagnosisInput = screen.getByLabelText(/medical:conditions\.diagnosis\.label/);
      expect(diagnosisInput).toBeInTheDocument();
    });

    test('allows form submission with minimal required data', () => {
      const minimalData = {
        ...defaultProps.formData,
        diagnosis: 'Minimal Condition',
      };

      render(<MantineConditionForm {...defaultProps} formData={minimalData} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Clinical Workflow', () => {
    test('supports condition lifecycle management', () => {
      const chronicConditionData = {
        diagnosis: 'Chronic Kidney Disease',
        status: 'chronic',
        severity: 'moderate',
        onset_date: '2023-01-15',
        icd10_code: 'N18.3',
        notes: 'Stage 3 CKD, requires regular monitoring',
      };

      render(<MantineConditionForm {...defaultProps} formData={chronicConditionData} />);

      expect(screen.getByDisplayValue('Chronic Kidney Disease')).toBeInTheDocument();
      expect(screen.getByDisplayValue('N18.3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Stage 3 CKD, requires regular monitoring')).toBeInTheDocument();
    });

    test('handles resolved conditions with end dates', () => {
      const resolvedConditionData = {
        diagnosis: 'Acute Bronchitis',
        status: 'resolved',
        severity: 'mild',
        onset_date: '2024-01-15',
        end_date: '2024-01-25',
        notes: 'Resolved with antibiotic treatment',
      };

      render(<MantineConditionForm {...defaultProps} formData={resolvedConditionData} />);

      const endDateInput = screen.getByTestId('date-common:labels.enddate');
      expect(endDateInput).toHaveValue('2024-01-25');
    });
  });
});
