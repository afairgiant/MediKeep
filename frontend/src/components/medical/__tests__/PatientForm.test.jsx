import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, waitFor, within, cleanup } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PatientForm from '../PatientForm';
import patientApi from '../../../services/api/patientApi';

// Explicit cleanup between tests: this file's Select instances re-generate
// Mantine's auto ids (mantine-xxxxx) per test, and stale portal/listbox nodes
// left over from a prior test's render can otherwise collide with the current
// test's id-based queries.
afterEach(cleanup);

// Mock DateInput component (via @mantine/dates, same pattern as MantinePatientForm tests)
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label, value, onChange, required, ...props }) => {
    const {
      firstDayOfWeek: _firstDayOfWeek,
      maxDate: _maxDate,
      minDate: _minDate,
      popoverProps: _popoverProps,
      valueFormat: _valueFormat,
      dateParser: _dateParser,
      ...domProps
    } = props;
    return (
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
          {...domProps}
        />
      </div>
    );
  },
}));

vi.mock('../../../services/api/patientApi', () => ({
  default: {
    createPatient: vi.fn(),
    updatePatient: vi.fn(),
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

// Mock scrollIntoView for Mantine Select/Combobox
Element.prototype.scrollIntoView = vi.fn();

describe('PatientForm', () => {
  const basePatient = {
    id: 5,
    first_name: 'John',
    last_name: 'Doe',
    birth_date: '1990-01-01',
    gender: 'M',
    relationship_to_self: 'child',
    address: '',
    blood_type: '',
    height: null,
    weight: null,
    physician_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    patientApi.updatePatient.mockResolvedValue({
      ...basePatient,
      first_name: 'John',
      last_name: 'Doe',
    });
    patientApi.createPatient.mockResolvedValue({
      ...basePatient,
      id: 6,
    });
  });

  // Mantine's Select associates the same label with both the visible <input>
  // and its (always-mounted, CSS-hidden-when-closed) options listbox <div>, and
  // their relative order in getAllByLabelText's results is not guaranteed, so
  // filter for the actual <input> rather than assuming index [0].
  function getSelectInput(labelRegex) {
    return screen
      .getAllByLabelText(labelRegex)
      .find(el => el.tagName === 'INPUT');
  }

  // Mantine's Select mounts its option listbox in the DOM at all times (visibility
  // is CSS-driven, not conditional rendering), so queries must be scoped to the
  // specific listbox via its `aria-labelledby` -> input `id` relationship. This also
  // matters because PatientForm.jsx's gender and relationship option lists both use
  // the shared `shared:fields.other` translation key for their "Other" entries.
  function getListboxFor(input) {
    return document.querySelector(
      `[role="listbox"][aria-labelledby="${input.id}-label"]`
    );
  }

  it('renders gender options using canonical backend values (M/F/OTHER/U)', () => {
    render(<PatientForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    const genderInput = getSelectInput(/shared:fields\.gender/);
    const listbox = within(getListboxFor(genderInput));

    // Gender options pass a fallback default to t(), so the global test mock
    // renders the fallback text rather than the raw i18n key.
    expect(listbox.getByText('Male')).toBeInTheDocument();
    expect(listbox.getByText('Female')).toBeInTheDocument();
    expect(listbox.getByText('Other')).toBeInTheDocument();
    expect(listbox.getByText('Prefer not to say')).toBeInTheDocument();
  });

  it('re-selects the correct gender option when editing a patient with gender "M"', () => {
    render(
      <PatientForm patient={basePatient} onSuccess={vi.fn()} onCancel={vi.fn()} />
    );

    // Mantine Select displays the label of the option matching the current value
    expect(screen.getByDisplayValue('Male')).toBeInTheDocument();
  });

  it('sends the canonical gender value on submit, not the label', async () => {
    render(<PatientForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/shared:labels\.firstName/), 'Jane');
    await userEvent.type(screen.getByLabelText(/shared:labels\.lastName/), 'Smith');

    const dateInput = screen.getByLabelText(/patients\.form\.birthDate\.label/);
    await userEvent.type(dateInput, '1990-01-15');

    const genderInput = getSelectInput(/shared:fields\.gender/);
    await userEvent.click(genderInput);
    const genderListbox = within(getListboxFor(genderInput));
    await userEvent.click(genderListbox.getByText('Female'));

    const submitButton = screen.getByText(
      'patients.form.buttons.createPatient'
    );
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(patientApi.createPatient).toHaveBeenCalled();
    });
    const submittedData = patientApi.createPatient.mock.calls[0][0];
    expect(submittedData.gender).toBe('F');
  });

  it('sends relationship_to_self on submit', async () => {
    render(<PatientForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/shared:labels\.firstName/), 'Jane');
    await userEvent.type(screen.getByLabelText(/shared:labels\.lastName/), 'Smith');

    const dateInput = screen.getByLabelText(/patients\.form\.birthDate\.label/);
    await userEvent.type(dateInput, '1990-01-15');

    const relationshipInput = getSelectInput(
      /patients\.form\.relationship\.label/
    );
    await userEvent.click(relationshipInput);
    const relationshipListbox = within(getListboxFor(relationshipInput));
    await userEvent.click(
      relationshipListbox.getByText('patients.form.relationship.options.spouse')
    );

    const submitButton = screen.getByText(
      'patients.form.buttons.createPatient'
    );
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(patientApi.createPatient).toHaveBeenCalled();
    });
    const submittedData = patientApi.createPatient.mock.calls[0][0];
    expect(submittedData.relationship_to_self).toBe('spouse');
  });
});
