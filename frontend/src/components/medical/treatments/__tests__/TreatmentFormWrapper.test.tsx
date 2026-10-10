import { useState } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import TreatmentFormWrapper from '../TreatmentFormWrapper';

// Paths are relative to this test file (src/components/medical/treatments/__tests__/)

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

vi.mock('../TreatmentRelationshipsManager', () => ({
  default: (props: { activeSection?: string; treatmentId?: number }) => (
    <div
      data-testid="treatment-relationships-manager"
      data-section={props.activeSection}
      data-treatment-id={props.treatmentId}
    />
  ),
}));

vi.mock('../TreatmentPlanSetup', () => ({
  default: (props: { activeSection?: string }) => (
    <div
      data-testid="treatment-plan-setup"
      data-section={props.activeSection}
    />
  ),
}));

vi.mock('../../../services/api', () => ({
  apiService: {
    linkTreatmentMedication: vi.fn(),
    linkTreatmentEncounter: vi.fn(),
    linkTreatmentLabResult: vi.fn(),
    linkTreatmentEquipment: vi.fn(),
  },
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
  title: 'Add New Treatment',
  formData: {
    treatment_name: '',
    treatment_type: '',
    status: '',
    condition_id: '',
    practitioner_id: '',
    start_date: '',
    end_date: '',
    dosage: '',
    frequency: '',
    description: '',
    notes: '',
    tags: [],
    mode: 'simple',
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue({}),
  conditionsOptions: [],
  practitionersOptions: [
    { id: 1, name: 'Dr. Smith', specialty: 'Surgery' },
    { id: 2, name: 'Dr. Johnson', specialty: 'Cardiology' },
  ],
  isLoading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TreatmentFormWrapper', () => {
  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(<TreatmentFormWrapper {...defaultProps} />);
      expect(screen.getByText('Add New Treatment')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<TreatmentFormWrapper {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add New Treatment')).not.toBeInTheDocument();
    });

    test('renders PractitionerSelectWithCreate for the practitioner field', () => {
      render(<TreatmentFormWrapper {...defaultProps} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });

    test('renders required treatment name field', () => {
      render(<TreatmentFormWrapper {...defaultProps} />);
      expect(
        screen.getByPlaceholderText(/Enter treatment name/i)
      ).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('calls onInputChange when practitioner is selected', () => {
      render(<TreatmentFormWrapper {...defaultProps} />);
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select')!;
      fireEvent.change(select, { target: { value: '1' } });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'practitioner_id', value: '1' },
      });
    });

    test('calls onClose when cancel button is clicked', () => {
      render(<TreatmentFormWrapper {...defaultProps} />);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('passes existing practitioner_id as string to PractitionerSelectWithCreate', () => {
      render(
        <TreatmentFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, practitioner_id: 2 }}
        />
      );
      const container = screen.getByTestId('practitioner-select-with-create');
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });

    test('handles empty practitionersOptions gracefully', () => {
      render(
        <TreatmentFormWrapper {...defaultProps} practitionersOptions={[]} />
      );
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });
  });
});

describe('TreatmentFormWrapper - Visits tab in both modes', () => {
  const advancedProps = {
    ...defaultProps,
    formData: { ...defaultProps.formData, mode: 'advanced' },
  };
  const tabNames = () => screen.getAllByRole('tab').map(t => t.textContent);
  const visitsTab = () =>
    screen.getByRole('tab', { name: /shared:tabs.visits/ });
  // A new treatment shows only link tabs that hold links; the rest sit in the Link menu
  const linkMenuButton = () =>
    screen
      .getAllByRole('button', { name: 'common:buttons.link' })
      .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement;
  const revealTab = async (name: RegExp) => {
    const user = userEvent.setup();
    await user.click(linkMenuButton());
    await user.click(await screen.findByRole('menuitem', { name }));
    return user;
  };

  test('Simple mode starts with no link tabs; the Link menu offers Visits, Lab Results and Equipment (not Medications)', async () => {
    render(<TreatmentFormWrapper {...defaultProps} />);
    expect(
      screen.queryByRole('tab', { name: /shared:tabs.visits/ })
    ).toBeNull();
    expect(tabNames().join('|')).not.toMatch(
      /medications|medical_equipment|lab_results/
    );

    await userEvent.click(linkMenuButton());
    expect(
      (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    ).toEqual([
      'shared:tabs.visits',
      'shared:categories.lab_results',
      'shared:categories.medical_equipment',
    ]);
  });

  test.each([
    ['Lab Results', /shared:categories.lab_results/, 'labs'],
    ['Medical Equipment', /shared:categories.medical_equipment/, 'equipment'],
  ])(
    'Simple mode: picking %s from the Link menu opens its section',
    async (_name, menuName, section) => {
      render(<TreatmentFormWrapper {...defaultProps} />);
      await revealTab(menuName);
      expect(await screen.findByTestId('treatment-plan-setup')).toHaveAttribute(
        'data-section',
        section
      );
      // The tab shows (with no links yet) while it is open
      expect(
        screen.getByRole('tab', { name: new RegExp(`${menuName.source}.*`) })
      ).toHaveAttribute('aria-selected', 'true');
    }
  );

  test('Simple mode edit shows all three link tabs, each with its own section', async () => {
    render(
      <TreatmentFormWrapper
        {...defaultProps}
        editingTreatment={{ id: 42, patient_id: 7 }}
      />
    );
    expect(tabNames().join('|')).toMatch(/lab_results/);
    expect(tabNames().join('|')).toMatch(/medical_equipment/);
    expect(tabNames().join('|')).not.toMatch(/medications/);

    fireEvent.click(screen.getByRole('tab', { name: /lab_results/ }));
    expect(
      await screen.findByTestId('treatment-relationships-manager')
    ).toHaveAttribute('data-section', 'labs');
    fireEvent.click(screen.getByRole('tab', { name: /medical_equipment/ }));
    expect(
      await screen.findByTestId('treatment-relationships-manager')
    ).toHaveAttribute('data-section', 'equipment');
  });

  test('Simple mode loads the relationship content only when Visits is opened', async () => {
    render(<TreatmentFormWrapper {...defaultProps} />);
    expect(screen.queryByTestId('treatment-plan-setup')).toBeNull();
    expect(screen.queryByTestId('treatment-relationships-manager')).toBeNull();

    await revealTab(/shared:tabs.visits/);
    expect(await screen.findByTestId('treatment-plan-setup')).toHaveAttribute(
      'data-section',
      'encounters'
    );
  });

  test('Simple mode edit uses the saved treatment and shows only the visits section', async () => {
    render(
      <TreatmentFormWrapper
        {...defaultProps}
        editingTreatment={{ id: 42, patient_id: 7 }}
      />
    );
    fireEvent.click(visitsTab());
    const manager = await screen.findByTestId(
      'treatment-relationships-manager'
    );
    expect(manager).toHaveAttribute('data-section', 'encounters');
    expect(manager).toHaveAttribute('data-treatment-id', '42');
  });

  test('Treatment Plan mode offers all four relationship types in the Link menu and mounts content up front', async () => {
    render(<TreatmentFormWrapper {...advancedProps} />);
    expect(screen.getByTestId('treatment-plan-setup')).toBeInTheDocument();
    expect(tabNames().join('|')).not.toMatch(
      /medications|medical_equipment|lab_results|visits/
    );

    await userEvent.click(linkMenuButton());
    expect(
      (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    ).toEqual([
      'shared:categories.medications',
      'shared:tabs.visits',
      'shared:categories.lab_results',
      'shared:categories.medical_equipment',
    ]);
  });

  test('switching to Simple mode keeps the Visits, Lab Results and Equipment tabs but leaves Medications', async () => {
    const Stateful = () => {
      const [mode, setMode] = useState('advanced');
      return (
        <TreatmentFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, mode }}
          onInputChange={(e: { target: { name: string; value: string } }) => {
            if (e.target.name === 'mode') setMode(e.target.value);
          }}
        />
      );
    };

    // From the Visits tab: stays on Visits after switching to Simple
    const { unmount } = render(<Stateful />);
    await revealTab(/shared:tabs.visits/);
    fireEvent.click(screen.getByText('Simple'));
    expect(visitsTab()).toHaveAttribute('aria-selected', 'true');
    unmount();

    // From the Lab Results tab: stays on it after switching to Simple
    const { unmount: unmountLabs } = render(<Stateful />);
    await revealTab(/shared:categories.lab_results/);
    fireEvent.click(screen.getByText('Simple'));
    expect(
      screen.getByRole('tab', { name: /shared:categories.lab_results/ })
    ).toHaveAttribute('aria-selected', 'true');
    unmountLabs();

    // From the Medications tab: falls back to Basic Info
    render(<Stateful />);
    await revealTab(/shared:categories.medications/);
    fireEvent.click(screen.getByText('Simple'));
    expect(
      screen.getByRole('tab', { name: /shared:tabs.basicInfo|Basic Info/ })
    ).toHaveAttribute('aria-selected', 'true');
  });
});
