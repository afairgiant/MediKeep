import type { ComponentType } from 'react';
import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../test-utils/render';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import MantineVisitForm from '../MantineVisitForm';

/** A link tab's name, with or without its "(n)" count. */
const withCount = (name: string) =>
  new RegExp(`^${name.replace(/\./g, '\\.')}( \\(\\d+\\))?$`);

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

// Keep the real tab buttons; replace the panels with a probe that exposes their props
vi.mock('../visits/VisitLinkTabs', async importOriginal => ({
  ...(await importOriginal<typeof import('../visits/VisitLinkTabs')>()),
  VisitLinkTabPanels: (props: {
    activeTab: string;
    visitId?: number | null;
    patientId?: number;
    pendingLinks?: unknown;
    onPendingChange?: (_next: unknown) => void;
  }) => (
    <div
      data-testid="visit-link-panels"
      data-active-tab={props.activeTab}
      data-visit-id={props.visitId ?? ''}
      data-patient-id={props.patientId ?? ''}
      data-pending={JSON.stringify(props.pendingLinks ?? null)}
    >
      <button
        type="button"
        onClick={() => props.onPendingChange?.({ procedures: [] })}
      >
        change-pending
      </button>
    </div>
  ),
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
    pending_links: {},
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
  patientId: 1,
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

// The JS form infers every destructured prop as required; these tests pass a subset.
const LooseVisitForm = MantineVisitForm as unknown as ComponentType<
  Record<string, unknown>
>;

describe('MantineVisitForm — linked record tabs', () => {
  const LINK_TABS = [
    'shared:categories.procedures',
    'shared:categories.treatments',
    'shared:categories.injuries',
    'shared:categories.symptoms',
    'shared:categories.conditions',
    'shared:categories.medications',
    'shared:categories.lab_results',
  ];

  const linkMenuButton = () =>
    screen
      .getAllByRole('button', { name: 'common:buttons.link' })
      .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement;

  test('add mode shows no link tabs until a type is chosen from the Link menu', async () => {
    render(<LooseVisitForm {...defaultProps} />);
    LINK_TABS.forEach(name =>
      expect(screen.queryByRole('tab', { name: withCount(name) })).toBeNull()
    );
    expect(screen.queryByRole('tab', { name: /elationships/ })).toBeNull();

    const user = userEvent.setup();
    await user.click(linkMenuButton());
    const items = await screen.findAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual(LINK_TABS);
  });

  test('add mode shows a tab for each type that already has pending links', () => {
    render(
      <LooseVisitForm
        {...defaultProps}
        formData={{
          ...defaultProps.formData,
          pending_links: {
            procedures: [{ entityId: 4, relevanceNote: null, purpose: null }],
          },
        }}
      />
    );
    expect(
      screen.getByRole('tab', { name: 'shared:categories.procedures (1)' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', {
        name: withCount('shared:categories.injuries'),
      })
    ).toBeNull();
  });

  test('editing a saved visit keeps a tab for every linked record type and no Link menu', () => {
    render(
      <LooseVisitForm {...defaultProps} editingVisit={{ id: 55 } as never} />
    );
    LINK_TABS.forEach(name =>
      expect(
        screen.getByRole('tab', { name: withCount(name) })
      ).toBeInTheDocument()
    );
    expect(screen.queryByRole('tab', { name: /elationships/ })).toBeNull();
    expect(
      screen
        .queryAllByRole('button', { name: 'common:buttons.link' })
        .some(button => button.hasAttribute('aria-haspopup'))
    ).toBe(false);
  });

  test('choosing a type from the Link menu opens its tab, so the panel loads on demand', async () => {
    render(<LooseVisitForm {...defaultProps} />);
    expect(screen.getByTestId('visit-link-panels')).toHaveAttribute(
      'data-active-tab',
      'info'
    );
    const user = userEvent.setup();
    await user.click(linkMenuButton());
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'shared:categories.lab_results',
      })
    );
    expect(screen.getByTestId('visit-link-panels')).toHaveAttribute(
      'data-active-tab',
      'link-labResults'
    );
  });

  test('add mode passes no visit id and the pending links from form data', () => {
    render(
      <LooseVisitForm
        {...defaultProps}
        formData={{
          ...defaultProps.formData,
          pending_links: {
            procedures: [{ entityId: 4, relevanceNote: null, purpose: null }],
          },
        }}
      />
    );
    const panels = screen.getByTestId('visit-link-panels');
    expect(panels).toHaveAttribute('data-visit-id', '');
    expect(panels).toHaveAttribute('data-patient-id', '1');
    expect(JSON.parse(panels.getAttribute('data-pending') as string)).toEqual({
      procedures: [{ entityId: 4, relevanceNote: null, purpose: null }],
    });
  });

  test('edit mode passes the saved visit id', () => {
    render(
      <LooseVisitForm {...defaultProps} editingVisit={{ id: 55 } as never} />
    );
    expect(screen.getByTestId('visit-link-panels')).toHaveAttribute(
      'data-visit-id',
      '55'
    );
  });

  test('stores pending link changes in the form data under pending_links', async () => {
    render(<LooseVisitForm {...defaultProps} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('change-pending'));
    expect(defaultProps.onInputChange).toHaveBeenCalledWith({
      target: { name: 'pending_links', value: { procedures: [] } },
    });
  });
});
