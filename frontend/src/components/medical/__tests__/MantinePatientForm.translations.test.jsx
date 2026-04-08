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
    it('should display save first message for new patient form', () => {
      render(<MantinePatientForm {...defaultProps} isCreating={true} />);

      // Component renders saveFirstMessage when isCreating is true
      expect(screen.getByText('patients.form.saveFirstMessage')).toBeInTheDocument();
    });

    it('should display medical info heading', () => {
      render(<MantinePatientForm {...defaultProps} />);

      // t() returns the fallback value 'Medical Information' when a default is provided
      expect(screen.getByText('Medical Information')).toBeInTheDocument();
    });

    it('should display all field labels', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByLabelText(/shared:labels\.firstName/)).toBeInTheDocument();
      expect(screen.getByLabelText(/shared:labels\.lastName/)).toBeInTheDocument();
      expect(screen.getByLabelText(/patients\.form\.birthDate\.label/)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/shared:fields\.gender/).length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText(/patients\.form\.relationship\.label/).length).toBeGreaterThan(0);
    });

    it('should display gender options', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const genderInput = getSelectInput(/shared:fields\.gender/);
      await userEvent.click(genderInput);

      await waitFor(() => {
        expect(screen.getByText('shared:fields.male')).toBeInTheDocument();
        expect(screen.getByText('shared:fields.female')).toBeInTheDocument();
        expect(screen.getByText('shared:fields.other')).toBeInTheDocument();
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
      expect(screen.getByText('shared:fields.cancel')).toBeInTheDocument();
    });

    it('should display save first message for new patients', () => {
      render(<MantinePatientForm {...defaultProps} isCreating={true} />);

      expect(screen.getByText('patients.form.saveFirstMessage')).toBeInTheDocument();
    });
  });

  describe('Form Field Interactions', () => {
    it('should handle first name input changes', () => {
      render(<MantinePatientForm {...defaultProps} />);

      const firstNameInput = screen.getByLabelText(/shared:labels\.firstName/);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    it('should handle last name input changes', () => {
      render(<MantinePatientForm {...defaultProps} />);

      const lastNameInput = screen.getByLabelText(/shared:labels\.lastName/);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    it('should handle gender select changes', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const genderInput = getSelectInput(/shared:fields\.gender/);
      await userEvent.click(genderInput);

      const maleOption = await screen.findByText('shared:fields.male');
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

      // Address textarea uses placeholder (no label prop), section header shows 'Address' as fallback
      const addressTextarea = screen.getByPlaceholderText('patients.form.address.placeholder');
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

    it('should display save changes button when not creating', () => {
      render(
        <MantinePatientForm
          {...defaultProps}
          formData={editFormData}
          isCreating={false}
        />
      );

      // In edit mode, the save button shows 'saveChanges' text
      expect(screen.getByText('patients.form.buttons.saveChanges')).toBeInTheDocument();
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
    it.skip('should show saving text when saving', () => {
      // Obsolete: PatientForm uses internal `loading` state, not a `saving` prop,
      // and no "saving" translation key exists in the current implementation.
      render(<MantinePatientForm {...defaultProps} saving={true} />);

      expect(screen.getByText('patients.form.buttons.saving')).toBeInTheDocument();
    });

    it('should disable inputs when saving', () => {
      render(<MantinePatientForm {...defaultProps} saving={true} />);

      const firstNameInput = screen.getByLabelText(/shared:labels\.firstName/);
      expect(firstNameInput).toBeDisabled();

      const lastNameInput = screen.getByLabelText(/shared:labels\.lastName/);
      expect(lastNameInput).toBeDisabled();
    });

    it('should disable cancel button when saving', () => {
      render(<MantinePatientForm {...defaultProps} saving={true} />);

      const cancelButton = screen.getByText('shared:fields.cancel').closest('button');
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
      expect(screen.getAllByLabelText(/shared:fields\.gender/).length).toBeGreaterThan(0);
    });
  });

  describe('Description Texts', () => {
    it('should display section headers with fallback text', () => {
      render(<MantinePatientForm {...defaultProps} />);

      // SectionHeaders use t() with fallback values which are returned by the mock
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Medical Information')).toBeInTheDocument();
    });

    it('should display address section header', () => {
      render(<MantinePatientForm {...defaultProps} />);

      // Address SectionHeader uses t('patients.form.address.label', 'Address')
      expect(screen.getByText('Address')).toBeInTheDocument();
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

      const cancelButton = screen.getByText('shared:fields.cancel');
      await userEvent.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Medical Information Fields', () => {
    it('should display blood type select', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getAllByLabelText(/shared:labels\.bloodType/).length).toBeGreaterThan(0);
    });

    it('should display height and weight inputs', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getByLabelText(/shared:labels\.height/)).toBeInTheDocument();
      expect(screen.getByLabelText(/shared:labels\.weight/)).toBeInTheDocument();
    });

    it('should display physician select', () => {
      render(<MantinePatientForm {...defaultProps} />);

      expect(screen.getAllByLabelText(/patients\.form\.physician\.label/).length).toBeGreaterThan(0);
    });

    it('should display blood type options', async () => {
      render(<MantinePatientForm {...defaultProps} />);

      const bloodTypeInput = getSelectInput(/shared:labels\.bloodType/);
      await userEvent.click(bloodTypeInput);

      await waitFor(() => {
        expect(screen.getByText('A+')).toBeInTheDocument();
        expect(screen.getByText('O-')).toBeInTheDocument();
      });
    });
  });
});
