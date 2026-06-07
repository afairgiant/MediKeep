import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import ProcedureFormWrapper from '../ProcedureFormWrapper';

// Paths are relative to this test file (src/components/medical/procedures/__tests__/)

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
  title: 'Add New Procedure',
  formData: {
    procedure_name: '',
    procedure_type: '',
    procedure_code: '',
    procedure_setting: '',
    description: '',
    procedure_date: '',
    status: '',
    outcome: '',
    procedure_duration: '',
    facility: '',
    practitioner_id: '',
    procedure_complications: '',
    notes: '',
    anesthesia_type: '',
    anesthesia_notes: '',
    tags: [],
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn(),
  practitioners: [
    { id: 1, name: 'Dr. Smith', specialty: 'Surgery' },
    { id: 2, name: 'Dr. Johnson', specialty: 'Cardiology' },
  ],
  editingItem: null,
  isLoading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProcedureFormWrapper', () => {
  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(<ProcedureFormWrapper {...defaultProps} />);
      expect(screen.getByText('Add New Procedure')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<ProcedureFormWrapper {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add New Procedure')).not.toBeInTheDocument();
    });

    test('renders PractitionerSelectWithCreate for the practitioner field', () => {
      render(<ProcedureFormWrapper {...defaultProps} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });

    test('renders required procedure name field', () => {
      render(<ProcedureFormWrapper {...defaultProps} />);
      expect(
        screen.getByPlaceholderText(/Enter procedure name/i)
      ).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('calls onInputChange when practitioner is selected', () => {
      render(<ProcedureFormWrapper {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '1' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '1' },
      });
    });

    test('calls onClose when cancel button is clicked', () => {
      render(<ProcedureFormWrapper {...defaultProps} />);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('passes existing practitioner_id as string to PractitionerSelectWithCreate', () => {
      render(
        <ProcedureFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, practitioner_id: 2 }}
        />
      );
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });
  });
});
