import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../test-utils/render';
import '@testing-library/jest-dom';
import MantinePatientForm from '../MantinePatientForm';

vi.mock('../practitioners/PractitionerSelectWithCreate', () => ({
  default: ({
    value,
    onChange,
    label,
    placeholder,
    practitioners,
  }: {
    value: string | null;
    onChange: (_v: string | null) => void;
    label: string;
    placeholder?: string;
    practitioners: { id: number; name: string; specialty?: string }[];
  }) => (
    <div data-testid="practitioner-select-with-create">
      <label htmlFor="mock-physician-select">{label}</label>
      <select
        id="mock-physician-select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder={placeholder}
        data-practitioner-count={practitioners.length}
      >
        <option value="">--</option>
        {practitioners.map(p => (
          <option key={p.id} value={String(p.id)}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock('@mantine/dates', () => ({
  DateInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: unknown;
    onChange: (_v: unknown) => void;
  }) => (
    <div>
      <label htmlFor={`date-${label}`}>{label}</label>
      <input
        id={`date-${label}`}
        type="date"
        value={value ? String(value) : ''}
        onChange={e => onChange(e.target.value ? new Date(e.target.value) : null)}
      />
    </div>
  ),
}));

vi.mock('../PatientPhotoUpload', () => ({
  default: () => <div data-testid="patient-photo-upload" />,
}));

vi.mock('../../../services/api/patientApi', () => ({
  default: {
    hasPhoto: vi.fn(() => Promise.resolve(false)),
    getPhotoUrl: vi.fn(() => Promise.resolve('')),
  },
}));

Element.prototype.scrollIntoView = vi.fn();

const practitioners = [
  { id: 1, name: 'Dr. Smith', specialty: 'General Practice' },
  { id: 2, name: 'Dr. Jones', specialty: 'Internal Medicine' },
];

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
  practitioners,
  saving: false,
  isCreating: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MantinePatientForm — Add Practitioner', () => {
  describe('Rendering', () => {
    test('renders PractitionerSelectWithCreate for the physician field', () => {
      render(<MantinePatientForm {...defaultProps} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });

    test('passes practitioners array to PractitionerSelectWithCreate', () => {
      render(<MantinePatientForm {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.dataset.practitionerCount).toBe('2');
    });
  });

  describe('Form Interactions', () => {
    test('calls onInputChange with selected physician id as string', () => {
      render(<MantinePatientForm {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '1' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'physician_id', value: '1' },
      });
    });

    test('calls onInputChange with empty string when physician is cleared', () => {
      render(<MantinePatientForm {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'physician_id', value: '' },
      });
    });
  });

  describe('Data Population', () => {
    test('coerces integer physician_id to string for the select value', () => {
      render(
        <MantinePatientForm
          {...defaultProps}
          formData={{ ...defaultFormData, physician_id: 2 }}
        />
      );
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });

    test('renders with empty value when physician_id is null', () => {
      render(<MantinePatientForm {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });
});
