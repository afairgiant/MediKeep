import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../test-utils/render';
import '@testing-library/jest-dom';
import MantineVisitForm from '../MantineVisitForm';

vi.mock('../practitioners/PractitionerSelectWithCreate', () => ({
  default: ({
    value,
    onChange,
    label,
    placeholder,
  }: {
    value: string | null;
    onChange: (_v: string | null) => void;
    label: string;
    placeholder?: string;
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
        <option value="1">Dr. Smith - General Practice</option>
        <option value="2">Dr. Jones - Internal Medicine</option>
      </select>
    </div>
  ),
}));

vi.mock('../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));

vi.mock('../visits/EncounterLabResultRelationships', () => ({
  default: () => <div data-testid="encounter-lab-results" />,
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add New Visit',
  formData: {
    reason: '',
    date: '',
    practitioner_id: '',
    visit_type: '',
    priority: '',
    condition_id: '',
    chief_complaint: '',
    duration_minutes: '',
    location: '',
    tags: [],
    diagnosis: '',
    treatment_plan: '',
    follow_up_instructions: '',
    notes: '',
    pending_lab_result_ids: [],
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue({}),
  practitioners: [
    { id: 1, name: 'Dr. Smith', specialty: 'General Practice' },
    { id: 2, name: 'Dr. Jones', specialty: 'Internal Medicine' },
  ],
  conditionsOptions: [],
  editingVisit: null,
  isLoading: false,
  labResults: [],
  encounterLabResults: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MantineVisitForm — Add Practitioner', () => {
  describe('Rendering', () => {
    test('renders PractitionerSelectWithCreate on the default Visit Info tab', () => {
      render(<MantineVisitForm {...defaultProps} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('calls onInputChange with selected practitioner id as string', () => {
      render(<MantineVisitForm {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '1' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '1' },
      });
    });

    test('calls onInputChange with empty string when practitioner is cleared', () => {
      render(<MantineVisitForm {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '' },
      });
    });
  });

  describe('Data Population', () => {
    test('coerces integer practitioner_id to string for the select value', () => {
      render(
        <MantineVisitForm
          {...defaultProps}
          formData={{ ...defaultProps.formData, practitioner_id: 2 }}
        />
      );
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });

    test('renders with empty value when practitioner_id is not set', () => {
      render(<MantineVisitForm {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });
});
