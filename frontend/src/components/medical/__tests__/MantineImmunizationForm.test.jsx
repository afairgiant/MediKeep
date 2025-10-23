import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
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

// Wrapper component with Mantine provider
const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

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
    practitioners: [
      { id: 1, name: 'Dr. Smith', specialty: 'Family Medicine' },
      { id: 2, name: 'Dr. Johnson', specialty: 'Pediatrics' },
    ],
    editingImmunization: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Add New Immunization')).toBeInTheDocument();
      expect(screen.getByLabelText('Vaccine Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Date Administered *')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} isOpen={false} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Add New Immunization')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      // Required fields
      expect(screen.getByLabelText('Vaccine Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Date Administered *')).toBeInTheDocument();

      // Optional fields
      expect(screen.getByLabelText('Dose Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Lot Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Manufacturer')).toBeInTheDocument();
      expect(screen.getByLabelText('Injection Site')).toBeInTheDocument();
      expect(screen.getByLabelText('Route of Administration')).toBeInTheDocument();
      expect(screen.getByLabelText('Expiration Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Additional Notes')).toBeInTheDocument();
      expect(screen.getByLabelText('Administering Practitioner')).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Immunization',
        editingImmunization: { id: 1, vaccine_name: 'COVID-19' },
      };

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...editProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Edit Immunization')).toBeInTheDocument();
      expect(screen.getByText('Update Immunization')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('handles vaccine name input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const vaccineNameInput = screen.getByLabelText('Vaccine Name *');
      await user.type(vaccineNameInput, 'COVID-19 Vaccine');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'vaccine_name', value: 'COVID-19 Vaccine' },
      });
    });

    test('handles date input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const dateInput = screen.getByTestId('date-date-administered');
      await user.type(dateInput, '2024-01-15');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'date_administered', value: '2024-01-15' },
      });
    });

    test('handles dose number input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const doseInput = screen.getByLabelText('Dose Number');
      await user.type(doseInput, '2');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'dose_number', value: '2' },
      });
    });

    test('handles manufacturer input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const manufacturerInput = screen.getByLabelText('Manufacturer');
      await user.type(manufacturerInput, 'Pfizer-BioNTech');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'manufacturer', value: 'Pfizer-BioNTech' },
      });
    });

    test('handles route of administration select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const routeSelect = screen.getByLabelText('Route of Administration');
      await user.click(routeSelect);
      
      const intramuscularOption = screen.getByText('Intramuscular - Injection into muscle');
      await user.click(intramuscularOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'route', value: 'intramuscular' },
      });
    });

    test('handles injection site select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const siteSelect = screen.getByLabelText('Injection Site');
      await user.click(siteSelect);
      
      const leftArmOption = screen.getByText('Left arm - Left deltoid muscle');
      await user.click(leftArmOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'site', value: 'left_arm' },
      });
    });

    test('handles practitioner select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const practitionerSelect = screen.getByLabelText('Administering Practitioner');
      await user.click(practitionerSelect);
      
      const drSmithOption = screen.getByText('Dr. Smith - Family Medicine');
      await user.click(drSmithOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '1' },
      });
    });

    test('handles notes textarea changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const notesTextarea = screen.getByLabelText('Additional Notes');
      await user.type(notesTextarea, 'Patient tolerated vaccine well');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'notes', value: 'Patient tolerated vaccine well' },
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Immunization');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('prevents default form submission', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const form = screen.getByRole('form');
      
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
        manufacturer: 'Sanofi Pasteur',
        site: 'left_arm',
        route: 'intramuscular',
        expiration_date: '2024-12-31',
        notes: 'Annual flu shot',
      };

      const propsWithData = {
        ...defaultProps,
        formData: populatedData,
      };

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...propsWithData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('Influenza Vaccine')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ABC123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Sanofi Pasteur')).toBeInTheDocument();
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

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...propsWithDates} />
        </MantineWrapper>
      );

      const adminDateInput = screen.getByTestId('date-date-administered');
      const expDateInput = screen.getByTestId('date-expiration-date');
      
      expect(adminDateInput).toHaveValue('2024-01-15');
      expect(expDateInput).toHaveValue('2024-12-31');
    });
  });

  describe('Select Options', () => {
    test('displays correct route of administration options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const routeSelect = screen.getByLabelText('Route of Administration');
      await user.click(routeSelect);

      expect(screen.getByText('Intramuscular - Injection into muscle')).toBeInTheDocument();
      expect(screen.getByText('Subcutaneous - Injection under skin')).toBeInTheDocument();
      expect(screen.getByText('Intradermal - Injection into skin')).toBeInTheDocument();
      expect(screen.getByText('Oral - By mouth')).toBeInTheDocument();
      expect(screen.getByText('Nasal - Nasal spray')).toBeInTheDocument();
    });

    test('displays correct injection site options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const siteSelect = screen.getByLabelText('Injection Site');
      await user.click(siteSelect);

      expect(screen.getByText('Left arm - Left deltoid muscle')).toBeInTheDocument();
      expect(screen.getByText('Right arm - Right deltoid muscle')).toBeInTheDocument();
      expect(screen.getByText('Left thigh - Left vastus lateralis')).toBeInTheDocument();
      expect(screen.getByText('Right thigh - Right vastus lateralis')).toBeInTheDocument();
    });

    test('displays practitioner options correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const practitionerSelect = screen.getByLabelText('Administering Practitioner');
      await user.click(practitionerSelect);

      expect(screen.getByText('Dr. Smith - Family Medicine')).toBeInTheDocument();
      expect(screen.getByText('Dr. Johnson - Pediatrics')).toBeInTheDocument();
    });
  });

  describe('Vaccine-Specific Validation', () => {
    test('validates required vaccine name field', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const vaccineNameInput = screen.getByLabelText('Vaccine Name *');
      expect(vaccineNameInput).toBeRequired();
    });

    test('validates required administration date field', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const dateInput = screen.getByLabelText('Date Administered *');
      expect(dateInput).toBeRequired();
    });

    test('accepts common vaccine names', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const vaccineNameInput = screen.getByLabelText('Vaccine Name *');
      
      const commonVaccines = [
        'COVID-19 Vaccine',
        'Influenza Vaccine',
        'Tetanus-Diphtheria-Pertussis (Tdap)',
        'Measles, Mumps, Rubella (MMR)',
        'Hepatitis B',
        'Pneumococcal Vaccine'
      ];
      
      for (const vaccine of commonVaccines) {
        await user.clear(vaccineNameInput);
        await user.type(vaccineNameInput, vaccine);
        
        expect(defaultProps.onInputChange).toHaveBeenCalledWith({
          target: { name: 'vaccine_name', value: vaccine },
        });
      }
    });

    test('handles dose number validation', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const doseInput = screen.getByLabelText('Dose Number');
      
      expect(doseInput).toHaveAttribute('type', 'number');
      expect(doseInput).toHaveAttribute('min', '1');
      
      await user.type(doseInput, '3');
      
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'dose_number', value: '3' },
      });
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

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} formData={seriesData} />
        </MantineWrapper>
      );

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

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} formData={boosterData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('COVID-19 Booster')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('First booster shot, 6 months after primary series')).toBeInTheDocument();
    });
  });

  describe('Lot Number and Expiration Tracking', () => {
    test('handles lot number input for vaccine tracking', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const lotInput = screen.getByLabelText('Lot Number');
      await user.type(lotInput, 'FL4157');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'lot_number', value: 'FL4157' },
      });
    });

    test('handles expiration date tracking', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const expDateInput = screen.getByTestId('date-expiration-date');
      await user.type(expDateInput, '2025-06-30');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'expiration_date', value: '2025-06-30' },
      });
    });

    test('supports vaccine safety tracking information', () => {
      const safetyTrackingData = {
        vaccine_name: 'Influenza Vaccine',
        lot_number: 'LOT2024FLU001',
        manufacturer: 'Sanofi Pasteur',
        expiration_date: '2024-12-31',
        notes: 'Vaccine stored at proper temperature, no adverse reactions reported',
      };

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} formData={safetyTrackingData} />
        </MantineWrapper>
      );

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
        render(
          <MantineWrapper>
            <MantineImmunizationForm {...propsWithNullData} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });

    test('handles empty practitioner list gracefully', () => {
      const propsWithNoPractitioners = {
        ...defaultProps,
        practitioners: [],
      };

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...propsWithNoPractitioners} />
        </MantineWrapper>
      );

      const practitionerSelect = screen.getByLabelText('Administering Practitioner');
      expect(practitionerSelect).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      // Check required fields have asterisks
      expect(screen.getByLabelText('Vaccine Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Date Administered *')).toBeInTheDocument();

      // Check optional fields don't have asterisks
      expect(screen.getByLabelText('Dose Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Manufacturer')).toBeInTheDocument();
    });

    test('has proper descriptions for vaccine fields', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Name of the vaccine administered')).toBeInTheDocument();
      expect(screen.getByText('Date when the vaccine was given')).toBeInTheDocument();
      expect(screen.getByText('Which dose in the series (1st, 2nd, booster, etc.)')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Immunization');
      const cancelButton = screen.getByText('Cancel');

      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Clinical Workflow', () => {
    test('supports complete immunization record creation', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} />
        </MantineWrapper>
      );

      // Fill out complete immunization record
      await user.type(screen.getByLabelText('Vaccine Name *'), 'Tetanus-Diphtheria-Pertussis (Tdap)');
      
      await user.type(screen.getByTestId('date-date-administered'), '2024-01-15');
      
      await user.type(screen.getByLabelText('Dose Number'), '1');
      await user.type(screen.getByLabelText('Lot Number'), 'TDP123456');
      await user.type(screen.getByLabelText('Manufacturer'), 'GlaxoSmithKline');
      
      await user.click(screen.getByLabelText('Injection Site'));
      await user.click(screen.getByText('Left arm - Left deltoid muscle'));
      
      await user.click(screen.getByLabelText('Route of Administration'));
      await user.click(screen.getByText('Intramuscular - Injection into muscle'));
      
      await user.type(screen.getByLabelText('Additional Notes'), 'Patient up to date with tetanus vaccination');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'vaccine_name', value: 'Tetanus-Diphtheria-Pertussis (Tdap)' },
      });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'site', value: 'left_arm' },
      });
    });

    test('supports pediatric immunization documentation', () => {
      const pediatricData = {
        vaccine_name: 'DTaP (Diphtheria, Tetanus, Pertussis)',
        date_administered: '2024-03-15',
        dose_number: '4',
        manufacturer: 'Sanofi Pasteur',
        site: 'left_thigh',
        route: 'intramuscular',
        notes: 'Fourth dose in DTaP series, child age 18 months',
      };

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} formData={pediatricData} />
        </MantineWrapper>
      );

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

      render(
        <MantineWrapper>
          <MantineImmunizationForm {...defaultProps} formData={travelData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('Hepatitis A')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Travel immunization for trip to South America, second dose due in 6-12 months')).toBeInTheDocument();
    });
  });
});
