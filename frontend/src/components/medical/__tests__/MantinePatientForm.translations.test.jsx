import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, fireEvent, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MantinePatientForm from '../MantinePatientForm';

// Mock DateInput component since it has complex dependencies
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label, value, onChange, required, description, ...props }) => {
    // Filter out non-DOM props
    const { firstDayOfWeek, maxDate, minDate, popoverProps, withAsterisk, ...domProps } = props;
    return (
      <div>
        <label htmlFor={`date-${label}`}>{label}{required && ' *'}</label>
        <input
          id={`date-${label}`}
          type="date"
          value={value ? (value instanceof Date ? value.toISOString().split('T')[0] : value) : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
          data-testid={`date-${label.toLowerCase().replace(/\s+/g, '-')}`}
          {...domProps}
        />
        {description && <p>{description}</p>}
      </div>
    );
  },
}));

// Mock PatientPhotoUpload to avoid API calls
vi.mock('../PatientPhotoUpload', () => ({
  default: () => <div data-testid="patient-photo-upload">Photo Upload</div>,
}));

// Mock patientApi to avoid API calls
vi.mock('../../../services/api/patientApi', () => ({
  default: {
    hasPhoto: vi.fn(() => Promise.resolve(false)),
    getPhotoUrl: vi.fn(() => Promise.resolve('')),
    uploadPhoto: vi.fn(() => Promise.resolve()),
    deletePhoto: vi.fn(() => Promise.resolve()),
  },
}));

// Mock scrollIntoView for Mantine Select/Combobox
Element.prototype.scrollIntoView = vi.fn();

describe('MantinePatientForm - Translations', () => {
  const defaultFormData = {
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    relationship_to_self: '',
    address: '',
    blood_type: '',
    height: '',
    weight: '',
    physician_id: null,
  };

  const defaultProps = {
    formData: defaultFormData,
    onInputChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    practitioners: [],
    saving: false,
    isCreating: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper for Select inputs (Mantine renders both input + listbox)
  function getSelectInput(labelRegex) {
    return screen.getAllByLabelText(labelRegex)[0];
  }

  describe('English Translations', () => {
    it('should display form title for new patient', () => {
      render(<MantinePatientForm {...defaultProps} />);

      // i18n mock returns keys - title uses patients.form.createTitle
      expect(screen.getByText('patients.form.createTitle')).toBeInTheDocument();
    });

    it('should display medical info heading', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByText('patients.form.medicalInfoHeading')).toBeInTheDocument();
    });

    it('should display all field labels', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByLabelText(/patients\.form\.firstName\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/patients\.form\.lastName\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/patients\.form\.birthDate\.label/)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/patients\.form\.gender\.label/).length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText(/patients\.form\.relationship\.label/).length).toBeGreaterThan(0);
    });

    it('should display gender options', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const genderInput = getSelectInput(/patients\.form\.gender\.label/);
      await userEvent.click(genderInput);

      await waitFor(() => {
        expect(screen.getByText('patients.form.gender.options.male')).toBeInTheDocument();
        expect(screen.getByText('patients.form.gender.options.female')).toBeInTheDocument();
        expect(screen.getByText('patients.form.gender.options.other')).toBeInTheDocument();
      });
    });

    it('should display relationship options', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const relationshipInput = getSelectInput(/patients\.form\.relationship\.label/);
      await userEvent.click(relationshipInput);

      await waitFor(() => {
        // RELATIONSHIP_OPTIONS have plain labels (not i18n keys)
        expect(screen.getByText('Self')).toBeInTheDocument();
        expect(screen.getByText('Spouse')).toBeInTheDocument();
        expect(screen.getByText('Child')).toBeInTheDocument();
        expect(screen.getByText('Parent')).toBeInTheDocument();
        expect(screen.getByText('Sibling')).toBeInTheDocument();
      });
    });

    it('should display button labels', () => {
      render(<MantinePatientForm {...defaultProps} />);

      // Create button uses i18n key
      expect(screen.getByText('patients.form.buttons.createPatient')).toBeInTheDocument();
      // Cancel button
      expect(screen.getByText('buttons.cancel')).toBeInTheDocument();
    });

    it('should display save first message for new patients', () => {
      render(<MantinePatientForm {...defaultProps} isCreating={true} />);

      expect(screen.getByText('patients.form.saveFirstMessage')).toBeInTheDocument();
    });
  });

  describe('Form Field Interactions', () => {
    it('should handle first name input changes', () => {
      render(<MantinePatientForm {...defaultProps} />);

      const firstNameInput = screen.getByLabelText(/patients\.form\.firstName\.label/);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    it('should handle last name input changes', () => {
      render(<MantinePatientForm {...defaultProps} />);

      const lastNameInput = screen.getByLabelText(/patients\.form\.lastName\.label/);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    it('should handle gender select changes', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const genderInput = getSelectInput(/patients\.form\.gender\.label/);
      await userEvent.click(genderInput);

      const maleOption = await screen.findByText('patients.form.gender.options.male');
      await userEvent.click(maleOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'gender', value: 'M' },
      });
    });

    it('should handle relationship select changes', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const relationshipInput = getSelectInput(/patients\.form\.relationship\.label/);
      await userEvent.click(relationshipInput);

      const selfOption = await screen.findByText('Self');
      await userEvent.click(selfOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'relationship_to_self', value: 'self' },
      });
    });

    it('should handle date input changes', () => {
      render(<MantinePatientForm {...defaultProps} />);

      const dateInput = screen.getByTestId('date-patients.form.birthdate.label');
      fireEvent.change(dateInput, { target: { value: '1990-01-15' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    it('should handle address textarea changes', () => {
      render(<MantinePatientForm {...defaultProps} />);

      const addressTextarea = screen.getByLabelText(/patients\.form\.address\.label/);
      fireEvent.change(addressTextarea, { target: { value: '123 Main St' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });
  });

  describe('Edit Mode Translations', () => {
    const editFormData = {
      ...defaultFormData,
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      birth_date: '1990-01-01',
      gender: 'M',
    };

    it('should display edit title when not creating', () => {
      render(
        <MantinePatientForm
          {...defaultProps}
          formData={editFormData}
          isCreating={false}
        />
      );

      expect(screen.getByText('patients.form.editTitle')).toBeInTheDocument();
    });

    it('should display save changes button in edit mode', () => {
      render(
        <MantinePatientForm
          {...defaultProps}
          formData={editFormData}
          isCreating={false}
        />
      );

      expect(screen.getByText('patients.form.buttons.saveChanges')).toBeInTheDocument();
    });

    it('should populate form with existing data', () => {
      render(
        <MantinePatientForm
          {...defaultProps}
          formData={editFormData}
          isCreating={false}
        />
      );

      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    });
  });

  describe('Data Population', () => {
    it('should display populated form data', () => {
      const populatedData = {
        ...defaultFormData,
        first_name: 'Jane',
        last_name: 'Smith',
        address: '456 Oak Ave',
      };

      render(<MantinePatientForm {...defaultProps} formData={populatedData} />);

      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();
      expect(screen.getByDisplayValue('456 Oak Ave')).toBeInTheDocument();
    });

    it('should handle date formatting correctly', () => {
      const dataWithDate = {
        ...defaultFormData,
        birth_date: '1990-06-15',
      };

      render(<MantinePatientForm {...defaultProps} formData={dataWithDate} />);

      const dateInput = screen.getByTestId('date-patients.form.birthdate.label');
      expect(dateInput).toHaveValue('1990-06-15');
    });
  });

  describe('Loading States', () => {
    it('should show saving text when saving', () => {
      render(<MantinePatientForm {...defaultProps} saving={true} />);

      expect(screen.getByText('patients.form.buttons.saving')).toBeInTheDocument();
    });

    it('should disable inputs when saving', () => {
      render(<MantinePatientForm {...defaultProps} saving={true} />);

      const firstNameInput = screen.getByLabelText(/patients\.form\.firstName\.label/);
      expect(firstNameInput).toBeDisabled();

      const lastNameInput = screen.getByLabelText(/patients\.form\.lastName\.label/);
      expect(lastNameInput).toBeDisabled();
    });

    it('should disable cancel button when saving', () => {
      render(<MantinePatientForm {...defaultProps} saving={true} />);

      const cancelButton = screen.getByText('buttons.cancel').closest('button');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Placeholder Texts', () => {
    it('should display placeholders as i18n keys', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByPlaceholderText('patients.form.firstName.placeholder')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('patients.form.lastName.placeholder')).toBeInTheDocument();
    });

    it('should display gender select field', () => {
      render(<MantinePatientForm {...defaultProps} />);

      // Mantine Select renders the label
      expect(screen.getAllByLabelText(/patients\.form\.gender\.label/).length).toBeGreaterThan(0);
    });
  });

  describe('Description Texts', () => {
    it('should display field descriptions', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByText('patients.form.firstName.description')).toBeInTheDocument();
      expect(screen.getByText('patients.form.lastName.description')).toBeInTheDocument();
    });

    it('should display birth date description', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByText('patients.form.birthDate.description')).toBeInTheDocument();
    });
  });

  describe('Button Actions', () => {
    it('should call onSave when create button is clicked', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const createButton = screen.getByText('patients.form.buttons.createPatient');
      await userEvent.click(createButton);

      expect(defaultProps.onSave).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const cancelButton = screen.getByText('buttons.cancel');
      await userEvent.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Medical Information Fields', () => {
    it('should display blood type select', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getAllByLabelText(/patients\.form\.bloodType\.label/).length).toBeGreaterThan(0);
    });

    it('should display height and weight inputs', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByLabelText(/patients\.form\.height\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/patients\.form\.weight\.label/)).toBeInTheDocument();
    });

    it('should display physician select', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getAllByLabelText(/patients\.form\.physician\.label/).length).toBeGreaterThan(0);
    });

    it('should display blood type options', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const bloodTypeInput = getSelectInput(/patients\.form\.bloodType\.label/);
      await userEvent.click(bloodTypeInput);

      await waitFor(() => {
        expect(screen.getByText('A+')).toBeInTheDocument();
        expect(screen.getByText('O-')).toBeInTheDocument();
      });
    });
  });
});
