import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render from '../../../../test-utils/render';
import EquipmentFormWrapper from '../EquipmentFormWrapper';

// Mock useDateFormat to avoid UserPreferencesProvider dependency
vi.mock('../../../../hooks/useDateFormat', () => ({
  default: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateFormat: 'mdy',
    formatDate: d => d,
    formatDateWithTime: d => d,
    formatDateTime: d => d,
    formatLongDate: d => d,
    formatDateTimeInput: d => d,
    locale: 'en-US',
    formatLabel: 'MM/DD/YYYY',
    formatExample: '01/31/2024',
    dateTimePlaceholder: 'MM/DD/YYYY HH:MM',
    formatOptions: {},
  }),
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateFormat: 'mdy',
    formatDate: d => d,
  }),
}));

// Mock Date Input component
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label, value, onChange, required, ...props }) => (
    <div>
      <label htmlFor={`date-${label}`}>
        {label}
        {required && ' *'}
      </label>
      <input
        id={`date-${label}`}
        type="date"
        value={
          value
            ? value instanceof Date
              ? value.toISOString().split('T')[0]
              : value
            : ''
        }
        onChange={e =>
          onChange(e.target.value ? new Date(e.target.value) : null)
        }
        data-testid={`date-${label.toLowerCase().replace(/\s+/g, '-')}`}
        {...props}
      />
    </div>
  ),
}));

// Mock i18next - return default values for labels
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key,
  }),
}));

// Mock useFormHandlers
vi.mock('../../../../hooks/useFormHandlers', () => ({
  useFormHandlers: onInputChange => ({
    handleTextInputChange: name => e => {
      onInputChange({ target: { name, value: e.target.value } });
    },
  }),
}));

// Mock TagInput
vi.mock('../../../common/TagInput', () => ({
  TagInput: ({ label, value, onChange, placeholder }) => (
    <div>
      <label htmlFor="tag-input">{label}</label>
      <input
        id="tag-input"
        type="text"
        placeholder={placeholder}
        value={value?.join(', ') || ''}
        onChange={e => onChange(e.target.value.split(', ').filter(Boolean))}
        data-testid="tag-input"
      />
    </div>
  ),
}));

// Mock FormLoadingOverlay
vi.mock('../../../shared/FormLoadingOverlay', () => ({
  default: ({ visible, message }) =>
    visible ? <div data-testid="loading-overlay">{message}</div> : null,
}));

// Mock SubmitButton - render as real button with type="submit"
vi.mock('../../../shared/SubmitButton', () => ({
  default: ({ children, disabled, loading, ...props }) => (
    <button
      type="submit"
      disabled={disabled || loading}
      data-testid="submit-btn"
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock scrollIntoView for Mantine Combobox
Element.prototype.scrollIntoView = vi.fn();

describe('EquipmentFormWrapper', () => {
  const defaultFormData = {
    equipment_name: '',
    equipment_type: '',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    prescribed_date: '',
    last_service_date: '',
    next_service_date: '',
    supplier: '',
    status: 'active',
    usage_instructions: '',
    notes: '',
    tags: [],
    practitioner_id: '',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Add New Equipment',
    editingEquipment: null,
    formData: defaultFormData,
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    practitionersOptions: [
      { id: 1, name: 'Dr. Smith', specialty: 'Pulmonology' },
      { id: 2, name: 'Dr. Jones', specialty: 'Sleep Medicine' },
    ],
    practitionersLoading: false,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(<EquipmentFormWrapper {...defaultProps} />);

      expect(screen.getByText('Add New Equipment')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<EquipmentFormWrapper {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Add New Equipment')).not.toBeInTheDocument();
    });

    test('renders all form fields', async () => {
      const user = userEvent.setup();
      render(<EquipmentFormWrapper {...defaultProps} />);

      // Basic Info tab (default) - check name, type, status, practitioner
      expect(screen.getByLabelText(/Equipment Name/i)).toBeInTheDocument();
      expect(screen.getByText('Equipment Type')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Prescribed By')).toBeInTheDocument();

      // Navigate to Device Details tab to check those fields
      await user.click(screen.getByRole('tab', { name: /Device Details/i }));
      expect(screen.getByLabelText(/Manufacturer/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Model Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Serial Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Supplier/i)).toBeInTheDocument();

      // Navigate to Service & Dates tab to check those fields
      await user.click(screen.getByRole('tab', { name: /Service & Dates/i }));
      expect(screen.getByLabelText(/Usage Instructions/i)).toBeInTheDocument();

      // Navigate to Notes tab to check those fields
      await user.click(screen.getByRole('tab', { name: /Notes/i }));
      expect(
        screen.getByRole('textbox', { name: /^Notes/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Tags/i)).toBeInTheDocument();
    });

    test('renders date fields', async () => {
      const user = userEvent.setup();
      render(<EquipmentFormWrapper {...defaultProps} />);

      // Date fields are in the "Service & Dates" tab
      await user.click(screen.getByRole('tab', { name: /Service & Dates/i }));

      expect(screen.getByTestId('date-prescribed-date')).toBeInTheDocument();
      expect(screen.getByTestId('date-last-service-date')).toBeInTheDocument();
      expect(screen.getByTestId('date-next-service-date')).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Equipment',
        editingEquipment: { id: 1, equipment_name: 'CPAP Machine' },
      };

      render(<EquipmentFormWrapper {...editProps} />);

      expect(screen.getByText('Edit Equipment')).toBeInTheDocument();
      expect(screen.getByText('Update Equipment')).toBeInTheDocument();
    });

    test('shows create button in add mode', () => {
      render(<EquipmentFormWrapper {...defaultProps} />);

      expect(screen.getByText('Create Equipment')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('handles equipment name input changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Equipment Name is on the Basic Info tab (default)
      const nameInput = screen.getByLabelText(/Equipment Name/i);
      await user.type(nameInput, 'R');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'equipment_name' }),
        })
      );
    });

    test('handles manufacturer input changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Manufacturer is on the Device Details tab
      await user.click(screen.getByRole('tab', { name: /Device Details/i }));

      const manufacturerInput = screen.getByLabelText(/Manufacturer/i);
      await user.type(manufacturerInput, 'R');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'manufacturer' }),
        })
      );
    });

    test('handles model number input changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Model Number is on the Device Details tab
      await user.click(screen.getByRole('tab', { name: /Device Details/i }));

      const modelInput = screen.getByLabelText(/Model Number/i);
      await user.type(modelInput, 'A');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'model_number' }),
        })
      );
    });

    test('handles serial number input changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Serial Number is on the Device Details tab
      await user.click(screen.getByRole('tab', { name: /Device Details/i }));

      const serialInput = screen.getByLabelText(/Serial Number/i);
      await user.type(serialInput, 'S');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'serial_number' }),
        })
      );
    });

    test('handles equipment type select changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Equipment Type is on the Basic Info tab (default)
      const typeInput = screen.getByPlaceholderText(/Select type/i);
      await user.click(typeInput);

      // Wait for dropdown and click option
      const cpapOption = await screen.findByText('CPAP Machine');
      await user.click(cpapOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'equipment_type', value: 'cpap' },
      });
    });

    test('renders status select with default value', () => {
      render(<EquipmentFormWrapper {...defaultProps} />);

      // Status Select is on the Basic Info tab (default)
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Active')).toBeInTheDocument();
    });

    test('handles practitioner select changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Prescribed By is on the Basic Info tab (default)
      const practitionerInput =
        screen.getByPlaceholderText(/Select practitioner/i);
      await user.click(practitionerInput);

      // Wait for dropdown
      const doctorOption = await screen.findByText('Dr. Smith - Pulmonology');
      await user.click(doctorOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '1' },
      });
    });

    test('handles usage instructions textarea changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Usage Instructions is on the Service & Dates tab
      await user.click(screen.getByRole('tab', { name: /Service & Dates/i }));

      const instructionsTextarea = screen.getByLabelText(/Usage Instructions/i);
      await user.type(instructionsTextarea, 'U');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'usage_instructions' }),
        })
      );
    });

    test('handles notes textarea changes', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Notes is on the Notes tab
      await user.click(screen.getByRole('tab', { name: /^Notes/i }));

      const notesTextarea = screen.getByRole('textbox', { name: /^Notes/i });
      await user.type(notesTextarea, 'P');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'notes' }),
        })
      );
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      const propsWithData = {
        ...defaultProps,
        formData: {
          ...defaultFormData,
          equipment_name: 'CPAP Machine',
          equipment_type: 'cpap',
        },
      };

      render(<EquipmentFormWrapper {...propsWithData} />);

      const submitButton = screen.getByText('Create Equipment');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('submit button is disabled without required fields', () => {
      render(<EquipmentFormWrapper {...defaultProps} />);

      const submitButton = screen.getByTestId('submit-btn');
      expect(submitButton).toBeDisabled();
    });

    test('submit button is enabled with required fields', () => {
      const propsWithData = {
        ...defaultProps,
        formData: {
          ...defaultFormData,
          equipment_name: 'CPAP Machine',
          equipment_type: 'cpap',
        },
      };

      render(<EquipmentFormWrapper {...propsWithData} />);

      const submitButton = screen.getByTestId('submit-btn');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Data Population', () => {
    test('populates form with existing equipment data', async () => {
      const user = userEvent.setup();
      const populatedData = {
        equipment_name: 'Portable Nebulizer',
        equipment_type: 'nebulizer',
        manufacturer: 'Omron',
        model_number: 'NE-C801',
        serial_number: 'SN-98765',
        prescribed_date: '2024-02-01',
        last_service_date: '2024-05-01',
        next_service_date: '2024-11-01',
        supplier: 'Medical Supply Co',
        status: 'active',
        usage_instructions: 'Use as needed for breathing treatments',
        notes: 'Keep clean and dry',
        tags: ['respiratory', 'home use'],
        practitioner_id: '1',
      };

      render(
        <EquipmentFormWrapper {...defaultProps} formData={populatedData} />
      );

      // Basic Info tab (default) - equipment name is visible
      expect(
        screen.getByDisplayValue('Portable Nebulizer')
      ).toBeInTheDocument();

      // Device Details tab - manufacturer, model, serial, supplier
      await user.click(screen.getByRole('tab', { name: /Device Details/i }));
      expect(screen.getByDisplayValue('Omron')).toBeInTheDocument();
      expect(screen.getByDisplayValue('NE-C801')).toBeInTheDocument();
      expect(screen.getByDisplayValue('SN-98765')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Medical Supply Co')).toBeInTheDocument();

      // Service & Dates tab - usage instructions
      await user.click(screen.getByRole('tab', { name: /Service & Dates/i }));
      expect(
        screen.getByDisplayValue('Use as needed for breathing treatments')
      ).toBeInTheDocument();

      // Notes tab - notes
      await user.click(screen.getByRole('tab', { name: /^Notes/i }));
      expect(
        screen.getByDisplayValue('Keep clean and dry')
      ).toBeInTheDocument();
    });
  });

  describe('Equipment Type Options', () => {
    test('displays all equipment type options', async () => {
      const user = userEvent.setup();

      render(<EquipmentFormWrapper {...defaultProps} />);

      // Equipment Type is on the Basic Info tab (default)
      const typeInput = screen.getByPlaceholderText(/Select type/i);
      await user.click(typeInput);

      expect(screen.getByText('CPAP Machine')).toBeInTheDocument();
      expect(screen.getByText('BiPAP Machine')).toBeInTheDocument();
      expect(screen.getByText('Nebulizer')).toBeInTheDocument();
      expect(screen.getByText('Inhaler')).toBeInTheDocument();
      expect(screen.getByText('Glucose Monitor')).toBeInTheDocument();
      expect(screen.getByText('Blood Pressure Monitor')).toBeInTheDocument();
    });
  });

  describe('Status Options', () => {
    test('renders status select with correct default', () => {
      render(<EquipmentFormWrapper {...defaultProps} />);

      // Status is on the Basic Info tab (default)
      expect(screen.getByText('Status')).toBeInTheDocument();
      // Default status is "active" which displays as "Active"
      expect(screen.getByDisplayValue('Active')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    test('shows loading overlay when isLoading is true', () => {
      render(<EquipmentFormWrapper {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Saving equipment...')).toBeInTheDocument();
    });

    test('disables cancel button when loading', () => {
      render(<EquipmentFormWrapper {...defaultProps} isLoading={true} />);

      // Mantine Button renders <button> - find by role
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    test('disables practitioner select when practitioners loading', () => {
      render(
        <EquipmentFormWrapper {...defaultProps} practitionersLoading={true} />
      );

      // Mantine Select's input should be disabled
      const practitionerInput =
        screen.getByPlaceholderText(/Select practitioner/i);
      expect(practitionerInput).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    test('handles null/undefined form data gracefully', () => {
      const propsWithNullData = {
        ...defaultProps,
        formData: {
          equipment_name: null,
          equipment_type: undefined,
          manufacturer: '',
          status: 'active',
        },
      };

      expect(() => {
        render(<EquipmentFormWrapper {...propsWithNullData} />);
      }).not.toThrow();
    });

    test('handles empty practitioners list gracefully', () => {
      const propsWithNoPractitioners = {
        ...defaultProps,
        practitionersOptions: [],
      };

      expect(() => {
        render(<EquipmentFormWrapper {...propsWithNoPractitioners} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form structure', () => {
      render(<EquipmentFormWrapper {...defaultProps} />);

      // Modal renders into a portal so use document.querySelector
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    test('required fields have proper attributes', () => {
      render(<EquipmentFormWrapper {...defaultProps} />);

      // Equipment Name is on the Basic Info tab (default)
      const nameInput = screen.getByLabelText(/Equipment Name/i);
      expect(nameInput).toBeRequired();
    });

    test('buttons have proper types', () => {
      const propsWithData = {
        ...defaultProps,
        formData: {
          ...defaultFormData,
          equipment_name: 'Test',
          equipment_type: 'cpap',
        },
      };

      render(<EquipmentFormWrapper {...propsWithData} />);

      const submitButton = screen.getByTestId('submit-btn');
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });
});
