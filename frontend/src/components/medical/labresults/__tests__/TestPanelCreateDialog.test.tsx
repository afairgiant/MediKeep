import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestPanelCreateDialog from '../TestPanelCreateDialog';

vi.mock('@mantine/core', () => ({
  Modal: ({ children, opened, title }: any) =>
    opened ? (
      <div data-testid="modal">
        <div>{title}</div>
        {children}
      </div>
    ) : null,
  Stack: ({ children }: any) => <div>{children}</div>,
  Grid: Object.assign(
    ({ children }: any) => <div>{children}</div>,
    { Col: ({ children }: any) => <div>{children}</div> }
  ),
  TextInput: ({ label, placeholder, value, onChange, required }: any) => (
    <div>
      {label && <label>{label}{required && ' *'}</label>}
      <input
        placeholder={placeholder}
        value={value ?? ''}
        onChange={onChange ?? (() => {})}
        readOnly={!onChange}
        aria-label={label}
      />
    </div>
  ),
  Textarea: ({ label, value, onChange }: any) => (
    <div>
      {label && <label>{label}</label>}
      <textarea value={value ?? ''} onChange={onChange} aria-label={label} />
    </div>
  ),
  Button: ({ children, onClick, loading, disabled }: any) => (
    <button onClick={onClick} disabled={loading || disabled}>
      {children}
    </button>
  ),
  Group: ({ children }: any) => <div>{children}</div>,
  Box: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children, title }: any) => (
    <div role="alert">
      {title && <strong>{title}</strong>}
      {children}
    </div>
  ),
  Text: ({ children }: any) => <span>{children}</span>,
  Paper: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Collapse: ({ children, in: open }: any) => open ? <div>{children}</div> : null,
  ActionIcon: ({ children, onClick, disabled, 'aria-label': ariaLabel }: any) => (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  NumberInput: ({ label, value, onChange }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        aria-label={label}
      />
    </div>
  ),
  Autocomplete: ({ label, placeholder, value, onChange, onOptionSubmit, data }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input
        placeholder={placeholder}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
      />
      <ul data-testid={`autocomplete-options-${placeholder}`}>
        {(data || []).map((option: string) => (
          <li key={option}>{option}</li>
        ))}
      </ul>
      {onOptionSubmit && (
        <button
          type="button"
          data-testid={`autocomplete-submit-${placeholder}`}
          onClick={() => onOptionSubmit(value)}
        >
          select option
        </button>
      )}
    </div>
  ),
  Select: ({ label, value, onChange, data }: any) => (
    <div>
      {label && <label>{label}</label>}
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">--</option>
        {(data || []).map((o: any) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  ),
  Input: Object.assign(
    ({ children }: any) => <div>{children}</div>,
    { Label: ({ children }: any) => <label>{children}</label> }
  ),
  Switch: ({ label, checked, onChange }: any) => (
    <div>
      {label && <label htmlFor="mock-switch">{label}</label>}
      <input
        id="mock-switch"
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked ?? false}
        onChange={onChange ?? (() => {})}
      />
    </div>
  ),
  Tooltip: ({ children }: any) => children,
}));

const translations: Record<string, string> = {
  'medical:labResults.addPanel.title': 'Add Lab Results',
  'medical:labResults.addPanel.panelName': 'Lab Results Panel or Type',
  'medical:labResults.addPanel.panelNamePlaceholder': 'e.g. CBC Panel, Annual Bloodwork',
  'medical:labResults.addPanel.panelNameDescription': 'A name for this group of tests',
  'medical:labResults.addPanel.createButton': 'Save Results',
  'medical:labResults.addPanel.creating': 'Creating...',
  'medical:labResults.addPanel.createError': 'Failed to create test panel',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      if (typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null) {
        const dv = fallbackOrOptions['defaultValue'];
        if (typeof dv === 'string') {
          return dv.replace(/\{\{(\w+)\}\}/g, (_, k) =>
            String(fallbackOrOptions[k] ?? '')
          );
        }
      }
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../../../adapters/DateInput', () => ({
  DateInput: ({ label }: any) => <input aria-label={label} type="text" />,
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: (val: string) => new Date(val),
  }),
}));

vi.mock('../../practitioners/PractitionerSelectWithCreate', () => ({
  default: ({ label, onChange }: any) => (
    <select aria-label={label} onChange={e => onChange(e.target.value || null)}>
      <option value="">--</option>
    </select>
  ),
}));

vi.mock('../LabResultTagsField', () => ({
  default: ({ value, onChange }: any) => (
    <button type="button" onClick={() => onChange([...value, 'fasting'])}>
      add-tag
    </button>
  ),
}));


vi.mock('../../../shared/FormLoadingOverlay', () => ({
  default: ({ visible }: any) =>
    visible ? <div data-testid="loading-overlay" /> : null,
}));

const mockCreateLabResult = vi.fn();
vi.mock('../../../../services/api', () => ({
  apiService: {
    createLabResult: (...args: any[]) => mockCreateLabResult(...args),
  },
}));

const mockCreateBulkForLabResult = vi.fn();
vi.mock('../../../../services/api/labTestComponentApi', () => ({
  labTestComponentApi: {
    createBulkForLabResult: (...args: any[]) => mockCreateBulkForLabResult(...args),
  },
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertCircle: () => <span />,
  IconFlask: () => <span />,
  IconPlus: () => <span />,
  IconTrash: () => <span />,
  IconChevronDown: () => <span />,
  IconChevronUp: () => <span />,
  IconX: () => <span />,
  IconCopy: () => <span />,
}));

const TESTOSTERONE_TEST = {
  test_name: 'Testosterone',
  abbreviation: 'TEST',
  test_code: '2986-8',
  default_unit: 'ng/dL',
  category: 'endocrinology',
  is_common: true,
  result_type: 'quantitative' as const,
};

vi.mock('../../../../constants/testLibrary', () => ({
  getAutocompleteOptions: (query: string = '') => {
    const q = query.toLowerCase().trim();
    if (!q || !TESTOSTERONE_TEST.test_name.toLowerCase().includes(q)) return [];
    return [`${TESTOSTERONE_TEST.test_name} (${TESTOSTERONE_TEST.abbreviation})`];
  },
  extractTestName: (v: string) => v.replace(/\s*\([^)]*\)$/, '').trim(),
  getTestByName: (name: string) =>
    name.toLowerCase() === TESTOSTERONE_TEST.test_name.toLowerCase()
      ? TESTOSTERONE_TEST
      : null,
  getMatchedCommonName: () => null,
  TEST_CATEGORY_TO_FORM_CATEGORY: { endocrinology: 'blood work' },
}));

vi.mock('../../../../constants/labCategories', () => ({
  QUALITATIVE_SELECT_OPTIONS: [
    { value: 'positive', label: 'Positive' },
    { value: 'negative', label: 'Negative' },
  ],
  CATEGORY_SELECT_OPTIONS: [
    { value: 'chemistry', label: 'Chemistry' },
  ],
}));

vi.mock('../../../../utils/labTestComponentUtils', async () => {
  const actual = await vi.importActual<typeof import('../../../../utils/labTestComponentUtils')>(
    '../../../../utils/labTestComponentUtils'
  );
  return actual;
});

const defaultProps = {
  opened: true,
  onClose: vi.fn(),
  onCreateSuccess: vi.fn(),
  practitioners: [],
  currentPatient: { id: 42 },
  advancedMode: false,
  onAdvancedModeChange: vi.fn(),
};

describe('TestPanelCreateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with Lab Results Panel or Type field and test component section', () => {
    render(<TestPanelCreateDialog {...defaultProps} />);
    expect(screen.getByText('Add Lab Results')).toBeTruthy();
    expect(screen.getByText(/Lab Results Panel or Type/)).toBeTruthy();
    expect(screen.getByText('Save Results')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText(/Add Tests/i)).toBeTruthy();
  });

  it('shows the same-as-ordered link under Completed Date, disabled until an ordered date is set', () => {
    render(<TestPanelCreateDialog {...defaultProps} />);
    expect(
      screen.getByText('labresults:completedDate.sameAsOrdered')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('labresults:completedDate.sameAsOrdered')
    ).toBeDisabled();
  });

  it('calls onAdvancedModeChange when the Advanced mode switch is toggled', async () => {
    const onAdvancedModeChange = vi.fn();
    render(
      <TestPanelCreateDialog
        {...defaultProps}
        onAdvancedModeChange={onAdvancedModeChange}
      />
    );

    await userEvent.click(screen.getByRole('switch'));
    expect(onAdvancedModeChange).toHaveBeenCalledWith(true);
  });

  it('shows validation error with field name when Lab Results Panel or Type is empty', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Save Results'));
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('Lab Results Panel or Type is required');
    });
    expect(mockCreateLabResult).not.toHaveBeenCalled();
  });

  it('shows validation error when no test results are provided', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);

    await userEvent.type(
      screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork'),
      'CBC Panel'
    );
    await userEvent.click(screen.getByText('Save Results'));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('At least one test result is required');
    });
    expect(mockCreateLabResult).not.toHaveBeenCalled();
    expect(defaultProps.onCreateSuccess).not.toHaveBeenCalled();
  });

  it('creates panel with components when a submittable row is filled', async () => {
    const newLabResult = { id: 99, test_name: 'CBC Panel' };
    mockCreateLabResult.mockResolvedValueOnce(newLabResult);
    mockCreateBulkForLabResult.mockResolvedValueOnce({
      created_count: 1,
      components: [],
      errors: [],
    });

    render(<TestPanelCreateDialog {...defaultProps} />);

    await userEvent.type(
      screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork'),
      'CBC Panel'
    );

    // Quantitative rows require test_name + value to pass isSubmittableComponent (unit is optional)
    await userEvent.type(screen.getByPlaceholderText('Type to search tests...'), 'Glucose');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Value' }), '95');
    await userEvent.type(screen.getByPlaceholderText('Unit'), 'mg/dL');

    await userEvent.click(screen.getByText('Save Results'));

    await waitFor(() => {
      expect(mockCreateBulkForLabResult).toHaveBeenCalledWith(
        99,
        [
          expect.objectContaining({
            test_name: 'Glucose',
            value: 95,
            unit: 'mg/dL',
            lab_result_id: 99,
            result_type: 'quantitative',
          }),
        ],
        42
      );
      expect(defaultProps.onCreateSuccess).toHaveBeenCalledWith(newLabResult);
    });
  });

  it('sends the tags entered in the dialog when creating the panel', async () => {
    mockCreateLabResult.mockResolvedValueOnce({ id: 99, test_name: 'CBC Panel' });
    mockCreateBulkForLabResult.mockResolvedValueOnce({ created_count: 1, components: [], errors: [] });

    render(<TestPanelCreateDialog {...defaultProps} />);

    await userEvent.type(
      screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork'),
      'CBC Panel'
    );
    await userEvent.click(screen.getByText('add-tag'));
    await userEvent.type(screen.getByPlaceholderText('Type to search tests...'), 'Glucose');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Value' }), '95');
    await userEvent.click(screen.getByText('Save Results'));

    await waitFor(() => {
      expect(mockCreateLabResult).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['fasting'] })
      );
    });
  });

  it('creates panel with component that has only a test name (value is optional)', async () => {
    const newLabResult = { id: 101, test_name: 'Custom Panel' };
    mockCreateLabResult.mockResolvedValueOnce(newLabResult);
    mockCreateBulkForLabResult.mockResolvedValueOnce({
      created_count: 1,
      components: [],
      errors: [],
    });

    render(<TestPanelCreateDialog {...defaultProps} />);

    await userEvent.type(
      screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork'),
      'Custom Panel'
    );
    // Only fill test name; leave value blank
    await userEvent.type(screen.getByPlaceholderText('Type to search tests...'), 'Blood Glucose');

    await userEvent.click(screen.getByText('Save Results'));

    await waitFor(() => {
      expect(mockCreateBulkForLabResult).toHaveBeenCalledWith(
        101,
        [
          expect.objectContaining({
            test_name: 'Blood Glucose',
            value: null,
            lab_result_id: 101,
          }),
        ],
        42
      );
      expect(defaultProps.onCreateSuccess).toHaveBeenCalledWith(newLabResult);
    });
  });

  it('creates panel with component that has no unit filled', async () => {
    const newLabResult = { id: 100, test_name: 'Lipid Panel' };
    mockCreateLabResult.mockResolvedValueOnce(newLabResult);
    mockCreateBulkForLabResult.mockResolvedValueOnce({
      created_count: 1,
      components: [],
      errors: [],
    });

    render(<TestPanelCreateDialog {...defaultProps} />);

    await userEvent.type(
      screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork'),
      'Lipid Panel'
    );

    await userEvent.type(screen.getByPlaceholderText('Type to search tests...'), 'Cholesterol');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Value' }), '180');
    // Intentionally omit unit — should still be submitted

    await userEvent.click(screen.getByText('Save Results'));

    await waitFor(() => {
      expect(mockCreateBulkForLabResult).toHaveBeenCalledWith(
        100,
        [
          expect.objectContaining({
            test_name: 'Cholesterol',
            value: 180,
            lab_result_id: 100,
            result_type: 'quantitative',
          }),
        ],
        42
      );
      expect(defaultProps.onCreateSuccess).toHaveBeenCalledWith(newLabResult);
    });
  });

  it('shows error alert when API call fails', async () => {
    mockCreateLabResult.mockRejectedValueOnce(new Error('Network error'));

    render(<TestPanelCreateDialog {...defaultProps} />);

    await userEvent.type(
      screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork'),
      'Lipid Panel'
    );
    await userEvent.click(screen.getByText('Save Results'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(defaultProps.onCreateSuccess).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('auto-populates test rows when a known panel name is selected', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);

    const panelInput = screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork');
    await userEvent.type(panelInput, 'Complete Blood Count');

    // Fire onOptionSubmit as if the user selected from the dropdown
    await userEvent.click(screen.getByTestId('autocomplete-submit-e.g. CBC Panel, Annual Bloodwork'));

    await waitFor(() => {
      // CBC template has 8 tests; each renders an Autocomplete with test_name as value
      expect(screen.getByDisplayValue('White Blood Cell Count')).toBeTruthy();
      expect(screen.getByDisplayValue('Hemoglobin')).toBeTruthy();
      expect(screen.getByDisplayValue('Platelet Count')).toBeTruthy();
    });
  });

  it('keeps manually entered rows when template is added via panel selection', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);

    // User enters a test first
    const testNameInput = screen.getByPlaceholderText('Type to search tests...');
    await userEvent.type(testNameInput, 'Glucose');

    // Then selects a panel name — user row should be kept alongside template rows
    const panelInput = screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork');
    await userEvent.type(panelInput, 'Complete Blood Count');
    await userEvent.click(screen.getByTestId('autocomplete-submit-e.g. CBC Panel, Annual Bloodwork'));

    await waitFor(() => {
      // User-entered test name should be preserved
      expect(screen.getByDisplayValue('Glucose')).toBeTruthy();
      // CBC template rows should also be added
      expect(screen.getByDisplayValue('White Blood Cell Count')).toBeTruthy();
    });
  });

  it('removes unfilled auto-populated rows when panel name is manually changed', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);

    const panelInput = screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork');
    await userEvent.type(panelInput, 'Complete Blood Count');
    await userEvent.click(screen.getByTestId('autocomplete-submit-e.g. CBC Panel, Annual Bloodwork'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('White Blood Cell Count')).toBeTruthy();
    });

    // User now types to change the panel name
    await userEvent.clear(panelInput);
    await userEvent.type(panelInput, 'Custom Panel');

    await waitFor(() => {
      // Auto-populated CBC rows should be gone (no values were entered)
      expect(screen.queryByDisplayValue('White Blood Cell Count')).toBeNull();
    });
  });

  it('falls back to individual test suggestions when no panel matches the typed text', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);

    const panelInput = screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork');
    await userEvent.type(panelInput, 'Testosterone');

    await waitFor(() => {
      const options = screen.getByTestId(
        'autocomplete-options-e.g. CBC Panel, Annual Bloodwork'
      );
      // No panel matches "Testosterone", so the individual test suggestion is shown...
      expect(options.textContent).toContain('Testosterone (TEST)');
      // ...and the dropdown is never a mix of panels and tests.
      expect(options.textContent).not.toContain('Panel');
    });
  });

  it('does not suggest individual tests while a panel still matches the typed text', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);

    const panelInput = screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork');
    await userEvent.type(panelInput, 'Complete Blood Count');

    await waitFor(() => {
      const options = screen.getByTestId(
        'autocomplete-options-e.g. CBC Panel, Annual Bloodwork'
      );
      expect(options.textContent).toContain('Complete Blood Count');
      expect(options.textContent).not.toContain('Testosterone');
    });
  });

  it('auto-populates a test row when an individual test (not a panel) is selected', async () => {
    render(<TestPanelCreateDialog {...defaultProps} />);

    const panelInput = screen.getByPlaceholderText('e.g. CBC Panel, Annual Bloodwork');
    await userEvent.type(panelInput, 'Testosterone');
    await userEvent.click(
      screen.getByTestId('autocomplete-submit-e.g. CBC Panel, Annual Bloodwork')
    );

    await waitFor(() => {
      // The panel/type field takes the selected test's name, and a matching
      // component row is auto-populated below — both show "Testosterone".
      expect(panelInput).toHaveValue('Testosterone');
      expect(screen.getAllByDisplayValue('Testosterone')).toHaveLength(2);
    });
  });
});
