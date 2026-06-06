import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import ConditionFormWrapper from '../ConditionFormWrapper';

// Paths are relative to this test file (src/components/medical/conditions/__tests__/)

vi.mock('../../practitioners/PractitionerSelectWithCreate', () => ({
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
      <label htmlFor="mock-practitioner-select">{label}</label>
      <select
        id="mock-practitioner-select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder={placeholder}
      >
        <option value="">--</option>
        <option value="1">Dr. Smith - Surgery</option>
        <option value="2">Dr. Johnson - Cardiology</option>
      </select>
    </div>
  ),
}));

vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));

vi.mock('../../LabResultRelationships', () => ({
  default: () => <div data-testid="lab-result-relationships" />,
}));

vi.mock('../../MedicationRelationships', () => ({
  default: () => <div data-testid="medication-relationships" />,
}));

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: (s: string) => new Date(s),
  }),
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add New Condition',
  formData: {
    diagnosis: '',
    condition_name: '',
    severity: '',
    status: '',
    onset_date: '',
    end_date: '',
    practitioner_id: '',
    icd10_code: '',
    snomed_code: '',
    code_description: '',
    notes: '',
    tags: [],
    pending_medication_ids: [],
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue({}),
  practitioners: [
    { id: 1, name: 'Dr. Smith', specialty: 'Surgery' },
    { id: 2, name: 'Dr. Johnson', specialty: 'Cardiology' },
  ],
  isLoading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConditionFormWrapper', () => {
  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(<ConditionFormWrapper {...defaultProps} />);
      expect(screen.getByText('Add New Condition')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<ConditionFormWrapper {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add New Condition')).not.toBeInTheDocument();
    });

    test('renders PractitionerSelectWithCreate for the practitioner field', () => {
      render(<ConditionFormWrapper {...defaultProps} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });

    test('renders required diagnosis field', () => {
      render(<ConditionFormWrapper {...defaultProps} />);
      expect(
        screen.getByPlaceholderText(/Enter diagnosis/i)
      ).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('calls onInputChange when practitioner is selected', () => {
      render(<ConditionFormWrapper {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '1' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '1' },
      });
    });

    test('calls onClose when cancel button is clicked', () => {
      render(<ConditionFormWrapper {...defaultProps} />);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('passes existing practitioner_id as string to PractitionerSelectWithCreate', () => {
      render(
        <ConditionFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, practitioner_id: 2 }}
        />
      );
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });

    test('handles empty practitioners list gracefully', () => {
      render(<ConditionFormWrapper {...defaultProps} practitioners={[]} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });
  });
});
