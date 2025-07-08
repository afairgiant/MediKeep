/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import MantineProcedureForm from '../MantineProcedureForm';

// Mock Date Input component since it has complex dependencies
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

// Wrapper component with Mantine provider
const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('MantineProcedureForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
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
    onInputChange: jest.fn(),
    onSubmit: jest.fn(),
    practitioners: [
      { id: 1, name: 'Dr. Smith', specialty: 'Surgery' },
      { id: 2, name: 'Dr. Johnson', specialty: 'Cardiology' },
    ],
    editingProcedure: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Add New Procedure')).toBeInTheDocument();
      expect(screen.getByLabelText('Procedure Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Procedure Date *')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} isOpen={false} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Add New Procedure')).not.toBeInTheDocument();
    });

    test('renders all required form fields', () => {
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      // Required fields
      expect(screen.getByLabelText('Procedure Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Procedure Date *')).toBeInTheDocument();

      // Optional fields
      expect(screen.getByLabelText('Procedure Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Procedure Code')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Duration (minutes)')).toBeInTheDocument();
      expect(screen.getByLabelText('Facility')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Clinical Notes')).toBeInTheDocument();
    });

    test('renders practitioner options correctly', () => {
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const practitionerSelect = screen.getByLabelText('Performing Practitioner');
      expect(practitionerSelect).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Procedure',
        editingProcedure: { id: 1, procedure_name: 'Test Procedure' },
      };

      render(
        <MantineWrapper>
          <MantineProcedureForm {...editProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Edit Procedure')).toBeInTheDocument();
      expect(screen.getByText('Update Procedure')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('handles text input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const procedureNameInput = screen.getByLabelText('Procedure Name *');
      await user.type(procedureNameInput, 'Appendectomy');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'procedure_name', value: 'Appendectomy' },
      });
    });

    test('handles select changes for procedure type', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const procedureTypeSelect = screen.getByLabelText('Procedure Type');
      await user.click(procedureTypeSelect);
      
      // Look for the surgical option
      const surgicalOption = screen.getByText('Surgical - Invasive procedure');
      await user.click(surgicalOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'procedure_type', value: 'surgical' },
      });
    });

    test('handles status select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);
      
      const completedOption = screen.getByText('Completed - Successfully finished');
      await user.click(completedOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'status', value: 'completed' },
      });
    });

    test('handles date input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const dateInput = screen.getByTestId('date-procedure-date');
      await user.type(dateInput, '2024-01-15');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'procedure_date', value: '2024-01-15' },
      });
    });

    test('handles duration input validation', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const durationInput = screen.getByLabelText('Duration (minutes)');
      await user.type(durationInput, '90');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'procedure_duration', value: '90' },
      });

      // Check that input has number type and min value
      expect(durationInput).toHaveAttribute('type', 'number');
      expect(durationInput).toHaveAttribute('min', '1');
    });

    test('handles textarea inputs for description and notes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const descriptionTextarea = screen.getByLabelText('Description');
      await user.type(descriptionTextarea, 'Surgical removal of appendix');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'description', value: 'Surgical removal of appendix' },
      });

      const notesTextarea = screen.getByLabelText('Clinical Notes');
      await user.type(notesTextarea, 'Patient recovery was smooth');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'notes', value: 'Patient recovery was smooth' },
      });
    });

    test('handles anesthesia type selection', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const anesthesiaSelect = screen.getByLabelText('Anesthesia Type');
      await user.click(anesthesiaSelect);
      
      const generalOption = screen.getByText('General - Complete unconsciousness');
      await user.click(generalOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'anesthesia_type', value: 'general' },
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Procedure');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('prevents default form submission', async () => {
      const user = userEvent.setup();
      const mockPreventDefault = jest.fn();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const form = screen.getByRole('form');
      
      // Simulate form submission with preventDefault
      fireEvent.submit(form, { preventDefault: mockPreventDefault });

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

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

      render(
        <MantineWrapper>
          <MantineProcedureForm {...propsWithData} />
        </MantineWrapper>
      );

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

      render(
        <MantineWrapper>
          <MantineProcedureForm {...propsWithDate} />
        </MantineWrapper>
      );

      const dateInput = screen.getByTestId('date-procedure-date');
      expect(dateInput).toHaveValue('2024-01-15');
    });
  });

  describe('Select Options', () => {
    test('displays correct procedure type options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const procedureTypeSelect = screen.getByLabelText('Procedure Type');
      await user.click(procedureTypeSelect);

      expect(screen.getByText('Surgical - Invasive procedure')).toBeInTheDocument();
      expect(screen.getByText('Diagnostic - Testing/Imaging')).toBeInTheDocument();
      expect(screen.getByText('Therapeutic - Treatment')).toBeInTheDocument();
      expect(screen.getByText('Preventive - Prevention care')).toBeInTheDocument();
      expect(screen.getByText('Emergency - Urgent care')).toBeInTheDocument();
    });

    test('displays correct status options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);

      expect(screen.getByText('Scheduled - Planned for future')).toBeInTheDocument();
      expect(screen.getByText('In Progress - Currently happening')).toBeInTheDocument();
      expect(screen.getByText('Completed - Successfully finished')).toBeInTheDocument();
      expect(screen.getByText('Cancelled - Not proceeding')).toBeInTheDocument();
    });

    test('displays correct procedure setting options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const settingSelect = screen.getByLabelText('Procedure Setting');
      await user.click(settingSelect);

      expect(screen.getByText('Outpatient - Same day discharge')).toBeInTheDocument();
      expect(screen.getByText('Inpatient - Hospital stay required')).toBeInTheDocument();
      expect(screen.getByText('Office - Doctor office/clinic')).toBeInTheDocument();
      expect(screen.getByText('Emergency - ER/urgent care')).toBeInTheDocument();
      expect(screen.getByText('Home - At patient home')).toBeInTheDocument();
    });

    test('displays correct anesthesia type options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const anesthesiaSelect = screen.getByLabelText('Anesthesia Type');
      await user.click(anesthesiaSelect);

      expect(screen.getByText('General - Complete unconsciousness')).toBeInTheDocument();
      expect(screen.getByText('Local - Numbing specific area')).toBeInTheDocument();
      expect(screen.getByText('Regional - Numbing larger area')).toBeInTheDocument();
      expect(screen.getByText('Sedation - Relaxed but conscious')).toBeInTheDocument();
      expect(screen.getByText('None - No anesthesia required')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles empty practitioner list gracefully', () => {
      const propsWithNoPractitioners = {
        ...defaultProps,
        practitioners: [],
      };

      render(
        <MantineWrapper>
          <MantineProcedureForm {...propsWithNoPractitioners} />
        </MantineWrapper>
      );

      const practitionerSelect = screen.getByLabelText('Performing Practitioner');
      expect(practitionerSelect).toBeInTheDocument();
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
        render(
          <MantineWrapper>
            <MantineProcedureForm {...propsWithNullData} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and descriptions', () => {
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      // Check that required fields have asterisks
      expect(screen.getByLabelText('Procedure Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Procedure Date *')).toBeInTheDocument();

      // Check descriptions are present
      expect(screen.getByText('Name of the medical procedure')).toBeInTheDocument();
      expect(screen.getByText('When the procedure is/was performed')).toBeInTheDocument();
    });

    test('has proper button styling and accessibility', () => {
      render(
        <MantineWrapper>
          <MantineProcedureForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Procedure');
      const cancelButton = screen.getByText('Cancel');

      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });
});