import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import InjuryFormWrapper from '../InjuryFormWrapper';

vi.mock('../../practitioners/PractitionerSelectWithCreate', () => ({
  default: ({
    value,
    onChange,
    label,
    placeholder,
    onPractitionerCreated,
  }: {
    value: string | null;
    onChange: (_v: string | null) => void;
    label: string;
    placeholder?: string;
    onPractitionerCreated?: (_p: { id: number; name: string; specialty: string }) => void;
  }) => (
    <div data-testid="practitioner-select-with-create">
      <label htmlFor="mock-prac-select">{label}</label>
      <select
        id="mock-prac-select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder={placeholder}
      >
        <option value="">--</option>
        <option value="1">Dr. Smith - Surgery</option>
        <option value="2">Dr. Johnson - Cardiology</option>
      </select>
      {onPractitionerCreated && (
        <button
          data-testid="trigger-practitioner-created"
          type="button"
          onClick={() =>
            onPractitionerCreated({ id: 99, name: 'Dr. New', specialty: 'ENT' })
          }
        >
          Trigger Created
        </button>
      )}
    </div>
  ),
}));

vi.mock('../InjuryTypeSelect', () => ({
  default: () => <div data-testid="injury-type-select" />,
}));

vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add New Injury',
  editingInjury: null,
  formData: {
    injury_name: '',
    injury_type_id: null,
    body_part: '',
    laterality: null,
    date_of_injury: '',
    severity: null,
    status: 'active',
    practitioner_id: '',
    mechanism: '',
    treatment_received: '',
    recovery_notes: '',
    notes: '',
    tags: [],
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue({}),
  practitionersOptions: [
    { id: 1, name: 'Dr. Smith', specialty: 'Surgery' },
    { id: 2, name: 'Dr. Johnson', specialty: 'Cardiology' },
  ],
  injuryTypes: [],
  isLoading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InjuryFormWrapper — Add Practitioner', () => {
  describe('Rendering', () => {
    test('renders PractitionerSelectWithCreate instead of a plain Select', () => {
      render(<InjuryFormWrapper {...defaultProps} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('calls onInputChange with parsed integer when a practitioner is selected', () => {
      render(<InjuryFormWrapper {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '1' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: 1 },
      });
    });

    test('calls onInputChange with null when practitioner is cleared', () => {
      render(<InjuryFormWrapper {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: null },
      });
    });
  });

  describe('Data Population', () => {
    test('coerces integer practitioner_id to string for the select value', () => {
      render(
        <InjuryFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, practitioner_id: 2 }}
        />
      );
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });

    test('renders with empty value when practitioner_id is not set', () => {
      render(<InjuryFormWrapper {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  describe('onPractitionerCreated callback', () => {
    test('passes onPractitionerCreated through to PractitionerSelectWithCreate', () => {
      const mockCreated = vi.fn();
      render(
        <InjuryFormWrapper {...defaultProps} onPractitionerCreated={mockCreated} />
      );
      fireEvent.click(screen.getByTestId('trigger-practitioner-created'));
      expect(mockCreated).toHaveBeenCalledWith({
        id: 99,
        name: 'Dr. New',
        specialty: 'ENT',
      });
    });

    test('does not render callback trigger when onPractitionerCreated is not provided', () => {
      render(<InjuryFormWrapper {...defaultProps} />);
      expect(
        screen.queryByTestId('trigger-practitioner-created')
      ).not.toBeInTheDocument();
    });
  });
});
