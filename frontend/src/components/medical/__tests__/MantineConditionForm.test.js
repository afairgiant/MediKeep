/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import MantineConditionForm from '../MantineConditionForm';

// Mock Date Input component
jest.mock('@mantine/dates', () => ({
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

// Mock status config
jest.mock('../../../utils/statusConfig', () => ({
  CONDITION_STATUS_OPTIONS: [
    { value: 'active', label: 'Active - Currently ongoing' },
    { value: 'inactive', label: 'Inactive - Not currently active' },
    { value: 'resolved', label: 'Resolved - Completely resolved' },
    { value: 'chronic', label: 'Chronic - Long-term condition' },
    { value: 'recurrence', label: 'Recurrence - Has returned' },
  ],
  SEVERITY_OPTIONS: [
    { value: 'mild', label: 'Mild - Minor symptoms' },
    { value: 'moderate', label: 'Moderate - Noticeable symptoms' },
    { value: 'severe', label: 'Severe - Significant symptoms' },
    { value: 'critical', label: 'Critical - Life threatening' },
  ],
}));

// Wrapper component with Mantine provider
const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('MantineConditionForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
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
    onInputChange: jest.fn(),
    onSubmit: jest.fn(),
    editingCondition: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Add New Condition')).toBeInTheDocument();
      expect(screen.getByLabelText('Diagnosis *')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} isOpen={false} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Add New Condition')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      // Required field
      expect(screen.getByLabelText('Diagnosis *')).toBeInTheDocument();

      // Optional fields
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
      expect(screen.getByLabelText('Onset Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      expect(screen.getByLabelText('ICD-10 Code')).toBeInTheDocument();
      expect(screen.getByLabelText('SNOMED Code')).toBeInTheDocument();
      expect(screen.getByLabelText('Code Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Clinical Notes')).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Condition',
        editingCondition: { id: 1, diagnosis: 'Hypertension' },
      };

      render(
        <MantineWrapper>
          <MantineConditionForm {...editProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Edit Condition')).toBeInTheDocument();
      expect(screen.getByText('Update Condition')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('handles diagnosis input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const diagnosisInput = screen.getByLabelText('Diagnosis *');
      await user.type(diagnosisInput, 'Essential Hypertension');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'diagnosis', value: 'Essential Hypertension' },
      });
    });

    test('handles status select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);
      
      const activeOption = screen.getByText('Active - Currently ongoing');
      await user.click(activeOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'status', value: 'active' },
      });
    });

    test('handles severity select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const severitySelect = screen.getByLabelText('Severity');
      await user.click(severitySelect);
      
      const moderateOption = screen.getByText('Moderate - Noticeable symptoms');
      await user.click(moderateOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'severity', value: 'moderate' },
      });
    });

    test('handles medical code inputs', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const icd10Input = screen.getByLabelText('ICD-10 Code');
      await user.type(icd10Input, 'I10');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'icd10_code', value: 'I10' },
      });

      const snomedInput = screen.getByLabelText('SNOMED Code');
      await user.type(snomedInput, '38341003');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'snomed_code', value: '38341003' },
      });
    });

    test('handles date input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const onsetDateInput = screen.getByTestId('date-onset-date');
      await user.type(onsetDateInput, '2024-01-15');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'onset_date', value: '2024-01-15' },
      });
    });

    test('handles notes textarea changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const notesTextarea = screen.getByLabelText('Clinical Notes');
      await user.type(notesTextarea, 'Patient shows mild symptoms');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'notes', value: 'Patient shows mild symptoms' },
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Condition');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
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
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const form = screen.getByRole('form');
      
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

      render(
        <MantineWrapper>
          <MantineConditionForm {...propsWithData} />
        </MantineWrapper>
      );

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

      render(
        <MantineWrapper>
          <MantineConditionForm {...propsWithDate} />
        </MantineWrapper>
      );

      const onsetDateInput = screen.getByTestId('date-onset-date');
      const endDateInput = screen.getByTestId('date-end-date');
      
      expect(onsetDateInput).toHaveValue('2024-01-15');
      expect(endDateInput).toHaveValue('2024-02-15');
    });
  });

  describe('Select Options Validation', () => {
    test('displays correct status options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);

      expect(screen.getByText('Active - Currently ongoing')).toBeInTheDocument();
      expect(screen.getByText('Inactive - Not currently active')).toBeInTheDocument();
      expect(screen.getByText('Resolved - Completely resolved')).toBeInTheDocument();
      expect(screen.getByText('Chronic - Long-term condition')).toBeInTheDocument();
      expect(screen.getByText('Recurrence - Has returned')).toBeInTheDocument();
    });

    test('displays correct severity options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const severitySelect = screen.getByLabelText('Severity');
      await user.click(severitySelect);

      expect(screen.getByText('Mild - Minor symptoms')).toBeInTheDocument();
      expect(screen.getByText('Moderate - Noticeable symptoms')).toBeInTheDocument();
      expect(screen.getByText('Severe - Significant symptoms')).toBeInTheDocument();
      expect(screen.getByText('Critical - Life threatening')).toBeInTheDocument();
    });
  });

  describe('Medical Coding Validation', () => {
    test('accepts valid ICD-10 codes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const icd10Input = screen.getByLabelText('ICD-10 Code');
      
      // Test various valid ICD-10 code formats
      await user.type(icd10Input, 'I10');
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'icd10_code', value: 'I10' },
      });
    });

    test('accepts valid SNOMED codes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const snomedInput = screen.getByLabelText('SNOMED Code');
      
      await user.type(snomedInput, '38341003');
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'snomed_code', value: '38341003' },
      });
    });

    test('links code description with codes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const codeDescriptionInput = screen.getByLabelText('Code Description');
      
      await user.type(codeDescriptionInput, 'Essential hypertension');
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'code_description', value: 'Essential hypertension' },
      });
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
        render(
          <MantineWrapper>
            <MantineConditionForm {...propsWithNullData} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });

    test('handles missing status config gracefully', () => {
      // Mock empty status config
      jest.doMock('../../../utils/statusConfig', () => ({
        CONDITION_STATUS_OPTIONS: [],
        SEVERITY_OPTIONS: [],
      }));

      expect(() => {
        render(
          <MantineWrapper>
            <MantineConditionForm {...defaultProps} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      // Check required field has asterisk
      expect(screen.getByLabelText('Diagnosis *')).toBeInTheDocument();

      // Check optional fields don't have asterisks
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
    });

    test('has proper descriptions for medical fields', () => {
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Primary medical diagnosis or condition name')).toBeInTheDocument();
      expect(screen.getByText('Current status of the condition')).toBeInTheDocument();
      expect(screen.getByText('Severity level of the condition')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Condition');
      const cancelButton = screen.getByText('Cancel');

      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('shows required field indicator for diagnosis', () => {
      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} />
        </MantineWrapper>
      );

      const diagnosisInput = screen.getByLabelText('Diagnosis *');
      expect(diagnosisInput).toBeRequired();
    });

    test('allows form submission with minimal required data', async () => {
      const user = userEvent.setup();
      const minimalData = {
        ...defaultProps.formData,
        diagnosis: 'Minimal Condition',
      };

      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} formData={minimalData} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Condition');
      await user.click(submitButton);

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

      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} formData={chronicConditionData} />
        </MantineWrapper>
      );

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

      render(
        <MantineWrapper>
          <MantineConditionForm {...defaultProps} formData={resolvedConditionData} />
        </MantineWrapper>
      );

      const endDateInput = screen.getByTestId('date-end-date');
      expect(endDateInput).toHaveValue('2024-01-25');
    });
  });
});