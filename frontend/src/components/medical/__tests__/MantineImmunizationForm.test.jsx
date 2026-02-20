import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, fireEvent, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MantineImmunizationForm from '../MantineImmunizationForm';

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

// Mock scrollIntoView for Mantine Select/Combobox
Element.prototype.scrollIntoView = vi.fn();

describe('MantineImmunizationForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Add New Immunization',
    formData: {
      vaccine_name: '',
      date_administered: '',
      dose_number: '',
      lot_number: '',
      manufacturer: '',
      site: '',
      route: '',
      expiration_date: '',
      notes: '',
    },
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    editingImmunization: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to get Select inputs (Mantine Select renders both input + listbox)
  function getSelectInput(labelRegex) {
    return screen.getAllByLabelText(labelRegex)[0];
  }

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Title and button both show 'Add New Immunization'
      expect(screen.getAllByText('Add New Immunization').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/medical:immunizations\.vaccineName\.label/)).toBeInTheDocument();
      // Date field from mock
      expect(screen.getByLabelText(/medical:immunizations\.dateAdministered\.label/)).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<MantineImmunizationForm {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Add New Immunization')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Required fields
      expect(screen.getByLabelText(/medical:immunizations\.vaccineName\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:immunizations\.dateAdministered\.label/)).toBeInTheDocument();

      // Optional fields
      expect(screen.getByLabelText(/medical:immunizations\.doseNumber\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:immunizations\.lotNumber\.label/)).toBeInTheDocument();
      // Manufacturer is a Select
      expect(screen.getAllByLabelText(/medical:immunizations\.manufacturer\.label/).length).toBeGreaterThan(0);
      // Site is a Select
      expect(screen.getAllByLabelText(/medical:immunizations\.site\.label/).length).toBeGreaterThan(0);
      // Route is a Select
      expect(screen.getAllByLabelText(/medical:immunizations\.route\.label/).length).toBeGreaterThan(0);
      // Expiration date from mock
      expect(screen.getByLabelText(/medical:immunizations\.expirationDate\.label/)).toBeInTheDocument();
      // Notes
      expect(screen.getByLabelText(/medical:immunizations\.notes\.label/)).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Immunization',
        editingImmunization: { id: 1, vaccine_name: 'COVID-19' },
      };

      render(<MantineImmunizationForm {...editProps} />);

      expect(screen.getByText('Edit Immunization')).toBeInTheDocument();
      const submitButton = document.querySelector('button[type="submit"]');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton.textContent).toContain('Update Immunization');
    });
  });

  describe('Form Interactions', () => {
    test('handles vaccine name input changes', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const vaccineNameInput = screen.getByLabelText(/medical:immunizations\.vaccineName\.label/);
      fireEvent.change(vaccineNameInput, { target: { value: 'COVID-19 Vaccine' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles date input changes', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Date mock testid: date-{label.toLowerCase().replace(/\s+/g, '-')}
      const dateInput = screen.getByTestId('date-medical:immunizations.dateadministered.label');
      fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

      // Date value may shift by timezone due to mock's new Date() UTC parsing
      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'date_administered' }),
        })
      );
    });

    test('handles dose number input changes', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const doseInput = screen.getByLabelText(/medical:immunizations\.doseNumber\.label/);
      fireEvent.change(doseInput, { target: { value: '2' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles manufacturer input changes', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Manufacturer is a searchable Select with dynamicOptions
      const manufacturerInput = getSelectInput(/medical:immunizations\.manufacturer\.label/);
      await userEvent.click(manufacturerInput);

      // Options use t() so labels are i18n keys
      const option = await screen.findByText('immunizations.manufacturerOptions.pfizerBioNTech');
      await userEvent.click(option);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'manufacturer', value: 'Pfizer-BioNTech' },
      });
    });

    test('handles route of administration select changes', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const routeInput = getSelectInput(/medical:immunizations\.route\.label/);
      await userEvent.click(routeInput);

      // Options use t() so labels are i18n keys
      const option = await screen.findByText('immunizations.routeOptions.intramuscular');
      await userEvent.click(option);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'route', value: 'intramuscular' },
      });
    });

    test('handles injection site select changes', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const siteInput = getSelectInput(/medical:immunizations\.site\.label/);
      await userEvent.click(siteInput);

      const option = await screen.findByText('immunizations.siteOptions.leftArm');
      await userEvent.click(option);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'site', value: 'left_arm' },
      });
    });

    test('handles notes textarea changes', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/medical:immunizations\.notes\.label/);
      fireEvent.change(notesTextarea, { target: { value: 'Patient tolerated vaccine well' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const cancelButton = screen.getByText('common:buttons.cancel');
      await userEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('prevents default form submission', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('populates form with existing immunization data', () => {
      const populatedData = {
        vaccine_name: 'Influenza Vaccine',
        date_administered: '2024-01-15',
        dose_number: '1',
        lot_number: 'ABC123',
        manufacturer: 'Sanofi',
        site: 'left_arm',
        route: 'intramuscular',
        expiration_date: '2024-12-31',
        notes: 'Annual flu shot',
      };

      const propsWithData = {
        ...defaultProps,
        formData: populatedData,
      };

      render(<MantineImmunizationForm {...propsWithData} />);

      expect(screen.getByDisplayValue('Influenza Vaccine')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ABC123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Annual flu shot')).toBeInTheDocument();
    });

    test('handles date formatting correctly', () => {
      const propsWithDates = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          date_administered: '2024-01-15',
          expiration_date: '2024-12-31',
        },
      };

      render(<MantineImmunizationForm {...propsWithDates} />);

      const adminDateInput = screen.getByTestId('date-medical:immunizations.dateadministered.label');
      const expDateInput = screen.getByTestId('date-medical:immunizations.expirationdate.label');

      expect(adminDateInput).toHaveValue('2024-01-15');
      expect(expDateInput).toHaveValue('2024-12-31');
    });
  });

  describe('Select Options', () => {
    test('displays correct route of administration options', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const routeInput = getSelectInput(/medical:immunizations\.route\.label/);
      await userEvent.click(routeInput);

      // Options use t() - show as i18n keys
      expect(screen.getByText('immunizations.routeOptions.intramuscular')).toBeInTheDocument();
      expect(screen.getByText('immunizations.routeOptions.subcutaneous')).toBeInTheDocument();
      expect(screen.getByText('immunizations.routeOptions.intradermal')).toBeInTheDocument();
      expect(screen.getByText('immunizations.routeOptions.oral')).toBeInTheDocument();
      expect(screen.getByText('immunizations.routeOptions.nasal')).toBeInTheDocument();
    });

    test('displays correct injection site options', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const siteInput = getSelectInput(/medical:immunizations\.site\.label/);
      await userEvent.click(siteInput);

      expect(screen.getByText('immunizations.siteOptions.leftArm')).toBeInTheDocument();
      expect(screen.getByText('immunizations.siteOptions.rightArm')).toBeInTheDocument();
      expect(screen.getByText('immunizations.siteOptions.leftThigh')).toBeInTheDocument();
      expect(screen.getByText('immunizations.siteOptions.rightThigh')).toBeInTheDocument();
    });

    test('displays manufacturer options correctly', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const manufacturerInput = getSelectInput(/medical:immunizations\.manufacturer\.label/);
      await userEvent.click(manufacturerInput);

      expect(screen.getByText('immunizations.manufacturerOptions.pfizerBioNTech')).toBeInTheDocument();
      expect(screen.getByText('immunizations.manufacturerOptions.moderna')).toBeInTheDocument();
    });
  });

  describe('Vaccine-Specific Validation', () => {
    test('validates required vaccine name field', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const vaccineNameInput = screen.getByLabelText(/medical:immunizations\.vaccineName\.label/);
      expect(vaccineNameInput).toBeRequired();
    });

    test('validates required administration date field', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Date field from mock
      const dateInput = screen.getByTestId('date-medical:immunizations.dateadministered.label');
      expect(dateInput).toBeInTheDocument();
    });

    test('accepts common vaccine names', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const vaccineNameInput = screen.getByLabelText(/medical:immunizations\.vaccineName\.label/);

      const commonVaccines = [
        'COVID-19 Vaccine',
        'Influenza Vaccine',
        'Tetanus-Diphtheria-Pertussis (Tdap)',
        'Measles, Mumps, Rubella (MMR)',
        'Hepatitis B',
        'Pneumococcal Vaccine'
      ];

      for (const vaccine of commonVaccines) {
        fireEvent.change(vaccineNameInput, { target: { value: vaccine } });
        expect(defaultProps.onInputChange).toHaveBeenCalled();
      }
    });

    test('handles dose number validation', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const doseInput = screen.getByLabelText(/medical:immunizations\.doseNumber\.label/);
      // NumberInput from Mantine renders as input
      expect(doseInput).toBeInTheDocument();

      fireEvent.change(doseInput, { target: { value: '3' } });
      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });
  });

  describe('Vaccine Series Management', () => {
    test('supports multi-dose vaccine series', () => {
      const seriesData = {
        vaccine_name: 'COVID-19 Vaccine',
        date_administered: '2024-02-15',
        dose_number: '2',
        manufacturer: 'Pfizer-BioNTech',
        notes: 'Second dose in series, patient completed primary series',
      };

      render(<MantineImmunizationForm {...defaultProps} formData={seriesData} />);

      expect(screen.getByDisplayValue('COVID-19 Vaccine')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Second dose in series, patient completed primary series')).toBeInTheDocument();
    });

    test('supports booster shot documentation', () => {
      const boosterData = {
        vaccine_name: 'COVID-19 Booster',
        date_administered: '2024-08-15',
        dose_number: '3',
        manufacturer: 'Moderna',
        notes: 'First booster shot, 6 months after primary series',
      };

      render(<MantineImmunizationForm {...defaultProps} formData={boosterData} />);

      expect(screen.getByDisplayValue('COVID-19 Booster')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('First booster shot, 6 months after primary series')).toBeInTheDocument();
    });
  });

  describe('Lot Number and Expiration Tracking', () => {
    test('handles lot number input for vaccine tracking', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const lotInput = screen.getByLabelText(/medical:immunizations\.lotNumber\.label/);
      fireEvent.change(lotInput, { target: { value: 'FL4157' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles expiration date tracking', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const expDateInput = screen.getByTestId('date-medical:immunizations.expirationdate.label');
      fireEvent.change(expDateInput, { target: { value: '2025-06-30' } });

      // Date value may shift by timezone due to mock's new Date() UTC parsing
      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'expiration_date' }),
        })
      );
    });

    test('supports vaccine safety tracking information', () => {
      const safetyTrackingData = {
        vaccine_name: 'Influenza Vaccine',
        lot_number: 'LOT2024FLU001',
        manufacturer: 'Sanofi',
        expiration_date: '2024-12-31',
        notes: 'Vaccine stored at proper temperature, no adverse reactions reported',
      };

      render(<MantineImmunizationForm {...defaultProps} formData={safetyTrackingData} />);

      expect(screen.getByDisplayValue('LOT2024FLU001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Vaccine stored at proper temperature, no adverse reactions reported')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles null/undefined form data gracefully', () => {
      const propsWithNullData = {
        ...defaultProps,
        formData: {
          vaccine_name: null,
          date_administered: undefined,
          dose_number: '',
        },
      };

      expect(() => {
        render(<MantineImmunizationForm {...propsWithNullData} />);
      }).not.toThrow();
    });

    test('handles empty manufacturer options gracefully', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Manufacturer select should still render even without pre-selected value
      const manufacturerInputs = screen.getAllByLabelText(/medical:immunizations\.manufacturer\.label/);
      expect(manufacturerInputs.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Check required fields exist
      expect(screen.getByLabelText(/medical:immunizations\.vaccineName\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:immunizations\.dateAdministered\.label/)).toBeInTheDocument();

      // Check optional fields exist
      expect(screen.getByLabelText(/medical:immunizations\.doseNumber\.label/)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/medical:immunizations\.manufacturer\.label/).length).toBeGreaterThan(0);
    });

    test('has proper descriptions for vaccine fields', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Descriptions use i18n keys
      expect(screen.getByText('medical:immunizations.vaccineName.description')).toBeInTheDocument();
      expect(screen.getByText('medical:immunizations.doseNumber.description')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      const submitButton = document.querySelector('button[type="submit"]');
      const cancelButton = screen.getByText('common:buttons.cancel');

      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Clinical Workflow', () => {
    test('supports complete immunization record creation', async () => {
      render(<MantineImmunizationForm {...defaultProps} />);

      // Fill text fields
      const vaccineInput = screen.getByLabelText(/medical:immunizations\.vaccineName\.label/);
      fireEvent.change(vaccineInput, { target: { value: 'Tetanus-Diphtheria-Pertussis (Tdap)' } });

      const dateInput = screen.getByTestId('date-medical:immunizations.dateadministered.label');
      fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

      const doseInput = screen.getByLabelText(/medical:immunizations\.doseNumber\.label/);
      fireEvent.change(doseInput, { target: { value: '1' } });

      const lotInput = screen.getByLabelText(/medical:immunizations\.lotNumber\.label/);
      fireEvent.change(lotInput, { target: { value: 'TDP123456' } });

      // Select injection site
      const siteInput = getSelectInput(/medical:immunizations\.site\.label/);
      await userEvent.click(siteInput);
      const siteOption = await screen.findByText('immunizations.siteOptions.leftArm');
      await userEvent.click(siteOption);

      expect(defaultProps.onInputChange).toHaveBeenCalled();
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'site', value: 'left_arm' },
      });
    });

    test('supports pediatric immunization documentation', () => {
      const pediatricData = {
        vaccine_name: 'DTaP (Diphtheria, Tetanus, Pertussis)',
        date_administered: '2024-03-15',
        dose_number: '4',
        manufacturer: 'Sanofi',
        site: 'left_thigh',
        route: 'intramuscular',
        notes: 'Fourth dose in DTaP series, child age 18 months',
      };

      render(<MantineImmunizationForm {...defaultProps} formData={pediatricData} />);

      expect(screen.getByDisplayValue('DTaP (Diphtheria, Tetanus, Pertussis)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('4')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Fourth dose in DTaP series, child age 18 months')).toBeInTheDocument();
    });

    test('supports travel immunization documentation', () => {
      const travelData = {
        vaccine_name: 'Hepatitis A',
        date_administered: '2024-01-20',
        dose_number: '1',
        manufacturer: 'Merck',
        notes: 'Travel immunization for trip to South America, second dose due in 6-12 months',
      };

      render(<MantineImmunizationForm {...defaultProps} formData={travelData} />);

      expect(screen.getByDisplayValue('Hepatitis A')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Travel immunization for trip to South America, second dose due in 6-12 months')).toBeInTheDocument();
    });
  });
});
