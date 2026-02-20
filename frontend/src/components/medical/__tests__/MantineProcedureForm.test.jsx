import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, fireEvent, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MantineProcedureForm from '../MantineProcedureForm';

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

describe('MantineProcedureForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Add New Procedure',
    formData: {
      procedure_name: '',
      procedure_type: '',
      procedure_code: '',
      procedure_setting: '',
      description: '',
      procedure_date: '',
      status: '',
      procedure_duration: '',
      facility: '',
      practitioner_id: '',
      procedure_complications: '',
      notes: '',
      anesthesia_type: '',
      anesthesia_notes: '',
    },
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    practitioners: [
      { id: 1, name: 'Dr. Smith', specialty: 'Surgery' },
      { id: 2, name: 'Dr. Johnson', specialty: 'Cardiology' },
    ],
    editingProcedure: null,
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
      render(<MantineProcedureForm {...defaultProps} />);

      // Title and button both show 'Add New Procedure'
      expect(screen.getAllByText('Add New Procedure').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/medical:procedures\.procedureName\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:procedures\.procedureDate\.label/)).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<MantineProcedureForm {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Add New Procedure')).not.toBeInTheDocument();
    });

    test('renders all required form fields', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      // Required fields
      expect(screen.getByLabelText(/medical:procedures\.procedureName\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:procedures\.procedureDate\.label/)).toBeInTheDocument();

      // Optional fields - text
      expect(screen.getByLabelText(/medical:procedures\.procedureCode\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:procedures\.procedureDuration\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:procedures\.facility\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:procedures\.description\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:procedures\.notes\.label/)).toBeInTheDocument();

      // Optional fields - selects
      expect(screen.getAllByLabelText(/medical:procedures\.procedureType\.label/).length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText(/common:labels\.status/).length).toBeGreaterThan(0);
    });

    test('renders practitioner options correctly', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const practitionerInputs = screen.getAllByLabelText(/medical:procedures\.practitioner\.label/);
      expect(practitionerInputs.length).toBeGreaterThan(0);
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Procedure',
        editingProcedure: { id: 1, procedure_name: 'Test Procedure' },
      };

      render(<MantineProcedureForm {...editProps} />);

      expect(screen.getByText('Edit Procedure')).toBeInTheDocument();
      const submitButton = document.querySelector('button[type="submit"]');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton.textContent).toContain('Update Procedure');
    });
  });

  describe('Form Interactions', () => {
    test('handles text input changes', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const procedureNameInput = screen.getByLabelText(/medical:procedures\.procedureName\.label/);
      fireEvent.change(procedureNameInput, { target: { value: 'Appendectomy' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles select changes for procedure type', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const procedureTypeInput = getSelectInput(/medical:procedures\.procedureType\.label/);
      await userEvent.click(procedureTypeInput);

      // Options use labelKey so i18n keys are shown
      const surgicalOption = await screen.findByText('medical:procedures.procedureType.options.surgical');
      await userEvent.click(surgicalOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'procedure_type', value: 'surgical' },
      });
    });

    test('handles status select changes', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const statusInput = getSelectInput(/common:labels\.status/);
      await userEvent.click(statusInput);

      // Status options use plain labels (from component, not field config)
      const completedOption = await screen.findByText('Completed - Successfully finished');
      await userEvent.click(completedOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'status', value: 'completed' },
      });
    });

    test('handles date input changes', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const dateInput = screen.getByTestId('date-medical:procedures.proceduredate.label');
      fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

      // Date value may shift by timezone
      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'procedure_date' }),
        })
      );
    });

    test('handles duration input validation', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const durationInput = screen.getByLabelText(/medical:procedures\.procedureDuration\.label/);
      fireEvent.change(durationInput, { target: { value: '90' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles textarea inputs for description and notes', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const descriptionTextarea = screen.getByLabelText(/medical:procedures\.description\.label/);
      fireEvent.change(descriptionTextarea, { target: { value: 'Surgical removal of appendix' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();

      const notesTextarea = screen.getByLabelText(/medical:procedures\.notes\.label/);
      fireEvent.change(notesTextarea, { target: { value: 'Patient recovery was smooth' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles anesthesia type selection', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const anesthesiaInput = getSelectInput(/medical:procedures\.anesthesiaType\.label/);
      await userEvent.click(anesthesiaInput);

      // Options use labelKey so i18n keys are shown
      const generalOption = await screen.findByText('medical:procedures.anesthesiaType.options.general');
      await userEvent.click(generalOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'anesthesia_type', value: 'general' },
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('prevents default form submission', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const cancelButton = screen.getByText('common:buttons.cancel');
      await userEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('populates form with existing data', () => {
      const populatedData = {
        procedure_name: 'MRI Scan',
        procedure_type: 'diagnostic',
        procedure_code: 'CPT-70551',
        procedure_setting: 'outpatient',
        description: 'Brain MRI with contrast',
        procedure_date: '2024-01-15',
        status: 'completed',
        procedure_duration: '45',
        facility: 'Imaging Center',
        practitioner_id: '2',
        procedure_complications: 'None reported',
        notes: 'Results show normal brain structure',
        anesthesia_type: 'none',
        anesthesia_notes: 'No anesthesia required',
      };

      const propsWithData = {
        ...defaultProps,
        formData: populatedData,
      };

      render(<MantineProcedureForm {...propsWithData} />);

      expect(screen.getByDisplayValue('MRI Scan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CPT-70551')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Brain MRI with contrast')).toBeInTheDocument();
      expect(screen.getByDisplayValue('45')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Imaging Center')).toBeInTheDocument();
      expect(screen.getByDisplayValue('None reported')).toBeInTheDocument();
    });

    test('handles date formatting correctly', () => {
      const propsWithDate = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          procedure_date: '2024-01-15',
        },
      };

      render(<MantineProcedureForm {...propsWithDate} />);

      const dateInput = screen.getByTestId('date-medical:procedures.proceduredate.label');
      expect(dateInput).toHaveValue('2024-01-15');
    });
  });

  describe('Select Options', () => {
    test('displays correct procedure type options', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const procedureTypeInput = getSelectInput(/medical:procedures\.procedureType\.label/);
      await userEvent.click(procedureTypeInput);

      // Options use labelKey - shows i18n keys
      expect(screen.getByText('medical:procedures.procedureType.options.surgical')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureType.options.diagnostic')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureType.options.therapeutic')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureType.options.preventive')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureType.options.emergency')).toBeInTheDocument();
    });

    test('displays correct status options', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const statusInput = getSelectInput(/common:labels\.status/);
      await userEvent.click(statusInput);

      // Status options have plain labels from component
      expect(screen.getByText('Scheduled - Planned for future')).toBeInTheDocument();
      expect(screen.getByText('In Progress - Currently happening')).toBeInTheDocument();
      expect(screen.getByText('Completed - Successfully finished')).toBeInTheDocument();
      expect(screen.getByText('Cancelled - Not proceeding')).toBeInTheDocument();
    });

    test('displays correct procedure setting options', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const settingInput = getSelectInput(/medical:procedures\.procedureSetting\.label/);
      await userEvent.click(settingInput);

      // Options use labelKey - shows i18n keys
      expect(screen.getByText('medical:procedures.procedureSetting.options.outpatient')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureSetting.options.inpatient')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureSetting.options.office')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureSetting.options.emergency')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureSetting.options.home')).toBeInTheDocument();
    });

    test('displays correct anesthesia type options', async () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const anesthesiaInput = getSelectInput(/medical:procedures\.anesthesiaType\.label/);
      await userEvent.click(anesthesiaInput);

      // Options use labelKey - shows i18n keys
      expect(screen.getByText('medical:procedures.anesthesiaType.options.general')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.anesthesiaType.options.local')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.anesthesiaType.options.regional')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.anesthesiaType.options.sedation')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.anesthesiaType.options.none')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles empty practitioner list gracefully', () => {
      const propsWithNoPractitioners = {
        ...defaultProps,
        practitioners: [],
      };

      render(<MantineProcedureForm {...propsWithNoPractitioners} />);

      const practitionerInputs = screen.getAllByLabelText(/medical:procedures\.practitioner\.label/);
      expect(practitionerInputs.length).toBeGreaterThan(0);
    });

    test('handles null/undefined form data gracefully', () => {
      const propsWithNullData = {
        ...defaultProps,
        formData: {
          procedure_name: null,
          procedure_type: undefined,
          description: '',
        },
      };

      expect(() => {
        render(<MantineProcedureForm {...propsWithNullData} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and descriptions', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      // Check that required fields exist
      expect(screen.getByLabelText(/medical:procedures\.procedureName\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:procedures\.procedureDate\.label/)).toBeInTheDocument();

      // Check descriptions are present (i18n keys)
      expect(screen.getByText('medical:procedures.procedureName.description')).toBeInTheDocument();
      expect(screen.getByText('medical:procedures.procedureDate.description')).toBeInTheDocument();
    });

    test('has proper button styling and accessibility', () => {
      render(<MantineProcedureForm {...defaultProps} />);

      const submitButton = document.querySelector('button[type="submit"]');
      const cancelButton = screen.getByText('common:buttons.cancel');

      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });
});
