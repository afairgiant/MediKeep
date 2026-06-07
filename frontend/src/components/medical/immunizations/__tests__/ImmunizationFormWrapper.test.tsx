import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ImmunizationFormWrapper from '../ImmunizationFormWrapper';

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
      <label htmlFor="mock-prac-select">{label}</label>
      <select
        id="mock-prac-select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder={placeholder}
      >
        <option value="">--</option>
        <option value="1">Dr. Smith - Internal Medicine</option>
        <option value="2">Dr. Jones - Pediatrics</option>
      </select>
    </div>
  ),
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
  title: 'Add Immunization',
  editingImmunization: null,
  formData: {
    vaccine_name: '',
    vaccine_trade_name: '',
    manufacturer: '',
    dose_number: '',
    lot_number: '',
    ndc_number: '',
    expiration_date: '',
    date_administered: '',
    site: null,
    route: null,
    location: '',
    practitioner_id: '',
    notes: '',
    tags: [],
    standardized_vaccine_who_code: null,
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue({}),
  practitioners: [
    { id: 1, name: 'Dr. Smith', specialty: 'Internal Medicine' },
    { id: 2, name: 'Dr. Jones', specialty: 'Pediatrics' },
  ],
  isLoading: false,
};

function getAdministrationTab() {
  return screen.getByRole('tab', { name: /administration/i });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImmunizationFormWrapper — Add Practitioner', () => {
  describe('Rendering', () => {
    test('renders PractitionerSelectWithCreate on the Administration tab', async () => {
      render(<ImmunizationFormWrapper {...defaultProps} />);
      await userEvent.click(getAdministrationTab());
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('calls onInputChange with selected practitioner id as string', async () => {
      render(<ImmunizationFormWrapper {...defaultProps} />);
      await userEvent.click(getAdministrationTab());
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '1' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '1' },
      });
    });

    test('calls onInputChange with empty string when practitioner is cleared', async () => {
      render(<ImmunizationFormWrapper {...defaultProps} />);
      await userEvent.click(getAdministrationTab());
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '' },
      });
    });
  });

  describe('Data Population', () => {
    test('coerces integer practitioner_id to string for the select value', async () => {
      render(
        <ImmunizationFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, practitioner_id: 2 }}
        />
      );
      await userEvent.click(getAdministrationTab());
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });
  });
});
