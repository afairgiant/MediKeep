import { useState } from 'react';
import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LabResultFormWrapper from '../LabResultFormWrapper';

/** A link tab's name, with or without its "(n)" count. */
const withCount = (name: string) =>
  new RegExp(`^${name.replace(/\./g, '\\.')}( \\(\\d+\\))?$`);

// Paths are relative to this test file (src/components/medical/labresults/__tests__/)

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
        <option value="1">Dr. Smith - Internal Medicine</option>
      </select>
    </div>
  ),
}));

const mockSetComponents = vi.hoisted(() => vi.fn());

vi.mock('../InlineTestComponentEntry', () => ({
  default: ({ onRef }) => {
    if (onRef)
      onRef({ getComponents: () => [], setComponents: mockSetComponents });
    return <div data-testid="inline-test-component" />;
  },
}));
vi.mock('../TestComponentsTab', () => ({
  default: () => <div data-testid="test-components-tab" />,
}));
vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));
// The same card for conditions, medications, procedures and treatments; each button
// hands the form a link the way the real card would
const PENDING_LINK_BY_KEY: Record<string, Record<string, unknown>> = {
  conditions: { entityId: 7, relevanceNote: 'cn', purpose: null },
  medications: { entityId: 8, relevanceNote: 'mn', purpose: null },
  procedures: { entityId: 9, relevanceNote: 'pn', purpose: null },
  treatments: {
    entityId: 10,
    relevanceNote: 'tn',
    purpose: 'monitoring',
    expectedFrequency: 'weekly',
  },
};
vi.mock('../../../../hooks/useLinkPanelDescription', () => ({
  useLinkPanelDescription: () => (items: string, record: string) =>
    `description:${items}:${record}`,
}));
vi.mock('../LabResultRecordLinksCard', () => ({
  default: (props: {
    linkKey: string;
    labResultId?: number | null;
    patientId?: number;
    description?: string;
    pendingLinks?: unknown;
    onPendingChange?: (_next: unknown) => void;
    onCountChange?: (_key: string, _count: number) => void;
  }) => (
    <div
      data-testid={`links-card-${props.linkKey}`}
      data-lab-result-id={props.labResultId ?? ''}
      data-patient-id={props.patientId ?? ''}
      data-description={props.description ?? ''}
      data-pending={JSON.stringify(props.pendingLinks ?? null)}
    >
      <button
        type="button"
        onClick={() =>
          props.onPendingChange?.([PENDING_LINK_BY_KEY[props.linkKey]])
        }
      >
        add-pending-{props.linkKey}
      </button>
      <button
        type="button"
        onClick={() => props.onCountChange?.(props.linkKey, 4)}
      >
        set-count-{props.linkKey}
      </button>
    </div>
  ),
}));
vi.mock('../../../shared/RecordVisitsCard', () => ({
  default: (props: {
    recordType: string;
    recordId?: number | null;
    patientId?: number;
    description?: string;
    pendingLinks?: unknown;
    onPendingChange?: (_next: unknown) => void;
  }) => (
    <div
      data-testid="visits-card"
      data-description={props.description ?? ''}
      data-record-type={props.recordType}
      data-record-id={props.recordId ?? ''}
      data-patient-id={props.patientId ?? ''}
      data-pending={JSON.stringify(props.pendingLinks ?? null)}
    >
      <button
        type="button"
        onClick={() =>
          props.onPendingChange?.([
            { entityId: 5, relevanceNote: 'n', purpose: 'reference' },
          ])
        }
      >
        add-pending-visit
      </button>
    </div>
  ),
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: s => new Date(s),
  }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add Lab Result',
  formData: {
    test_name: '',
    test_code: '',
    test_category: '',
    test_type: '',
    facility: '',
    practitioner_id: '',
    ordered_date: '',
    completed_date: '',
    status: '',
    labs_result: '',
    notes: '',
    tags: [],
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn(),
  editingItem: null,
  practitioners: [{ id: 1, name: 'Dr. Smith', specialty: 'Internal Medicine' }],
};

/**
 * Open a linked-record tab. When creating, only types that already have links are tabs;
 * the others are reached through the tab bar's "Link" menu.
 */
const openLinkTab = async (name: string) => {
  const user = userEvent.setup();
  const tab = screen.queryByRole('tab', { name: withCount(name) });
  if (tab) {
    await user.click(tab);
    return user;
  }
  const menuButton = screen
    .getAllByRole('button', { name: 'common:buttons.link' })
    .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement;
  await user.click(menuButton);
  await user.click(await screen.findByRole('menuitem', { name }));
  return user;
};

describe('LabResultFormWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Test name autocomplete (#1027)', () => {
    // Mirrors the page: formData lives in parent state and updates functionally.
    const StatefulForm = (props: Record<string, unknown>) => {
      const [formData, setFormData] = useState(defaultProps.formData);
      return (
        <LabResultFormWrapper
          {...defaultProps}
          {...props}
          formData={formData}
          onInputChange={(e: { target: { name: string; value: string } }) =>
            setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
          }
        />
      );
    };

    const testNameInput = () =>
      screen.getByPlaceholderText('labresults:testName.placeholder');

    test('suggests panels as you type in create mode', async () => {
      render(<StatefulForm advancedCreate />);
      await userEvent.type(testNameInput(), 'Comprehensive Metab');

      expect(
        await screen.findByText('Comprehensive Metabolic Panel (CMP)')
      ).toBeInTheDocument();
    });

    test('picking a panel fills name and category and pre-populates test rows', async () => {
      render(<StatefulForm advancedCreate />);
      await userEvent.type(testNameInput(), 'Comprehensive Metab');
      await userEvent.click(
        await screen.findByText('Comprehensive Metabolic Panel (CMP)')
      );

      expect(testNameInput()).toHaveValue('Comprehensive Metabolic Panel');
      expect(
        screen.getByDisplayValue('labresults:category.chemistry')
      ).toBeInTheDocument();
      expect(mockSetComponents).toHaveBeenCalled();
      const rows = mockSetComponents.mock.calls.at(-1)?.[0];
      expect(rows.length).toBeGreaterThan(1);
    });

    test.each([
      ['edit mode', { editingItem: { id: 5, test_name: 'x' } }],
      ['post-create mode', { postCreate: true }],
    ])(
      'keeps a plain input with no suggestions in %s',
      async (_label, extra) => {
        render(<StatefulForm {...extra} />);
        await userEvent.type(testNameInput(), 'Comprehensive Metab');

        expect(
          screen.queryByText('Comprehensive Metabolic Panel (CMP)')
        ).not.toBeInTheDocument();
      }
    );
  });

  describe('Basic Info tab (default)', () => {
    test('renders the form when open', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<LabResultFormWrapper {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add Lab Result')).not.toBeInTheDocument();
    });

    test('shows Ordered Date on the Basic Info tab without switching tabs', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      // Basic Info is the default active tab — dates must be immediately visible
      expect(screen.getByText('shared:labels.orderedDate')).toBeInTheDocument();
    });

    test('shows Completed Date on the Basic Info tab without switching tabs', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.getByText('shared:labels.completedDate')
      ).toBeInTheDocument();
    });

    test('renders PractitionerSelectWithCreate for the practitioner field', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.getByTestId('practitioner-select-with-create')
      ).toBeInTheDocument();
    });

    test('shows Tags field on the Basic Info tab', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      // Use getAllByText since "tags" may appear in multiple places (e.g. navigation)
      const tagLabels = screen.getAllByText('shared:labels.tags');
      expect(tagLabels.length).toBeGreaterThan(0);
    });

    test('reports a newly entered tag through onInputChange', async () => {
      const onInputChange = vi.fn();
      render(
        <LabResultFormWrapper {...defaultProps} onInputChange={onInputChange} />
      );
      const input = screen.getByPlaceholderText(
        'common:fields.tags.placeholder'
      );
      await userEvent.type(input, 'fasting{Enter}');
      expect(onInputChange).toHaveBeenCalledWith({
        target: { name: 'tags', value: ['fasting'] },
      });
    });

    test('shows existing tags from formData', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, tags: ['fasting', 'annual'] }}
        />
      );
      expect(screen.getByText('fasting')).toBeInTheDocument();
      expect(screen.getByText('annual')).toBeInTheDocument();
    });
  });

  describe('Completed date same-as-ordered link', () => {
    const label = 'labresults:completedDate.sameAsOrdered';

    test('is shown but inert when there is no ordered date', () => {
      const onInputChange = vi.fn();
      render(
        <LabResultFormWrapper {...defaultProps} onInputChange={onInputChange} />
      );
      fireEvent.click(screen.getByText(label));
      expect(onInputChange).not.toHaveBeenCalled();
    });

    test('clicking copies the ordered date into completed date', () => {
      const onInputChange = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          onInputChange={onInputChange}
          formData={{ ...defaultProps.formData, ordered_date: '2024-03-05' }}
        />
      );
      fireEvent.click(screen.getByText(label));
      expect(onInputChange).toHaveBeenCalledWith({
        target: { name: 'completed_date', value: '2024-03-05' },
      });
    });

    test('does not change completed date until clicked', () => {
      const onInputChange = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          onInputChange={onInputChange}
          formData={{
            ...defaultProps.formData,
            ordered_date: '2024-03-05',
            completed_date: '2024-03-09',
          }}
        />
      );
      expect(onInputChange).not.toHaveBeenCalled();
    });
  });

  describe('Results & Status tab', () => {
    // Helper: find the Results & Status tab by its exact i18n key text
    function getResultsTab() {
      return screen.getByRole('tab', { name: 'labresults:tabs.resultsStatus' });
    }

    test('shows Status and Lab Result selects', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      fireEvent.click(getResultsTab());

      expect(
        screen.getByText('labresults:testStatus.label')
      ).toBeInTheDocument();
      expect(screen.getByText('shared:labels.labResult')).toBeInTheDocument();
    });

    test('Ordered Date and Completed Date are not visible on Results & Status tab', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      fireEvent.click(getResultsTab());

      // Mantine keeps all panels mounted but hides inactive ones with CSS
      const orderedLabel = screen.queryByText('shared:labels.orderedDate');
      const completedLabel = screen.queryByText('shared:labels.completedDate');
      if (orderedLabel) expect(orderedLabel).not.toBeVisible();
      if (completedLabel) expect(completedLabel).not.toBeVisible();
    });
  });

  describe('Notes tab', () => {
    test('is not shown when creating a lab result without advanced mode', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.queryByRole('tab', { name: 'shared:tabs.notes' })
      ).not.toBeInTheDocument();
    });

    test('is shown when creating a lab result with advancedCreate enabled', async () => {
      render(<LabResultFormWrapper {...defaultProps} advancedCreate />);
      const notesTab = screen.getByRole('tab', { name: 'shared:tabs.notes' });
      expect(notesTab).toBeInTheDocument();

      await userEvent.click(notesTab);
      expect(
        screen.getByText('shared:fields.additionalNotes')
      ).toBeInTheDocument();
    });

    test('is shown when editing an existing lab result', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
        />
      );
      const notesTab = screen.getByRole('tab', { name: 'shared:tabs.notes' });
      expect(notesTab).toBeInTheDocument();

      await userEvent.click(notesTab);
      expect(
        screen.getByText('shared:fields.additionalNotes')
      ).toBeInTheDocument();
    });
  });

  describe('Linked-record tabs - Visits card', () => {
    const LINK_TABS = [
      'shared:categories.conditions',
      'Visits',
      'shared:categories.medications',
      'shared:categories.procedures',
      'shared:categories.treatments',
    ];

    const openTab = openLinkTab;
    const openRelationships = () => openTab('Visits');

    test('edit mode has a tab per linked record type and no Relationships tab', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 42, test_name: 'CBC' }}
        />
      );
      LINK_TABS.forEach(name =>
        expect(
          screen.getByRole('tab', { name: withCount(name) })
        ).toBeInTheDocument()
      );
      expect(
        screen.queryByRole('tab', { name: 'labresults:tabs.relationships' })
      ).not.toBeInTheDocument();
    });

    test('shows the number of saved links on each tab, loaded when the dialog opens', () => {
      const fetchers = {
        fetchLabResultConditions: vi.fn(),
        fetchLabResultMedications: vi.fn(),
        fetchLabResultProcedures: vi.fn(),
        fetchLabResultTreatments: vi.fn(),
      };
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 42, test_name: 'CBC' }}
          labResultConditions={{ 42: [{ id: 1 }, { id: 2 }] }}
          labResultMedications={{ 42: [{ id: 1 }] }}
          labResultProcedures={{ 42: [] }}
          labResultTreatments={{}}
          {...fetchers}
        />
      );
      expect(
        screen.getByRole('tab', { name: 'shared:categories.conditions (2)' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'shared:categories.medications (1)' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'shared:categories.procedures (0)' })
      ).toBeInTheDocument();
      // Not loaded yet: the name alone
      expect(
        screen.getByRole('tab', { name: 'shared:categories.treatments' })
      ).toBeInTheDocument();
      Object.values(fetchers).forEach(fetcher =>
        expect(fetcher).toHaveBeenCalledWith(42)
      );
    });

    test('does not load saved links for a lab result that is not saved yet', async () => {
      const fetchLabResultConditions = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          advancedCreate
          fetchLabResultConditions={fetchLabResultConditions}
        />
      );
      expect(fetchLabResultConditions).not.toHaveBeenCalled();
      // Nothing chosen yet: no link tabs, but a Link menu offers every type
      LINK_TABS.forEach(name =>
        expect(
          screen.queryByRole('tab', { name: withCount(name) })
        ).not.toBeInTheDocument()
      );
      const menuButton = screen
        .getAllByRole('button', { name: 'common:buttons.link' })
        .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement;
      await userEvent.click(menuButton);
      expect(
        (await screen.findAllByRole('menuitem')).map(item => item.textContent)
      ).toEqual(LINK_TABS);
    });

    test('a type picked from the Link menu is a tab only while it is open or has links', async () => {
      render(<LabResultFormWrapper {...defaultProps} advancedCreate />);
      const user = await openLinkTab('shared:categories.medications');
      expect(
        screen.getByRole('tab', {
          name: 'shared:categories.medications (0)',
        })
      ).toBeInTheDocument();

      // Leave it without linking anything: back into the Link menu, not an empty tab
      await user.click(screen.getAllByRole('tab')[0]);
      expect(
        screen.queryByRole('tab', {
          name: withCount('shared:categories.medications'),
        })
      ).not.toBeInTheDocument();
      const menuButton = screen
        .getAllByRole('button', { name: 'common:buttons.link' })
        .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement;
      await user.click(menuButton);
      // The dropdown is still fading in under jsdom, so it is not yet "visible"
      expect(
        (await screen.findAllByRole('menuitem', { hidden: true })).map(
          item => item.textContent
        )
      ).toContain('shared:categories.medications');
    }, 20000);

    test('each linked-record tab shows its own section', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 42, test_name: 'CBC' }}
        />
      );
      const sections: Array<[string, string]> = [
        ['shared:categories.conditions', 'links-card-conditions'],
        ['Visits', 'visits-card'],
        ['shared:categories.medications', 'links-card-medications'],
        ['shared:categories.procedures', 'links-card-procedures'],
        ['shared:categories.treatments', 'links-card-treatments'],
      ];
      for (const [tab, testId] of sections) {
        await openTab(tab);
        expect(await screen.findByTestId(testId)).toBeInTheDocument();
      }
    });

    test('only the open tab mounts its section', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 42, test_name: 'CBC' }}
        />
      );
      await openTab('shared:categories.medications');
      expect(
        await screen.findByTestId('links-card-medications')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('visits-card')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('links-card-conditions')
      ).not.toBeInTheDocument();
    });

    test('are not shown in a plain (quick) create', () => {
      render(<LabResultFormWrapper {...defaultProps} patientId={7} />);
      LINK_TABS.forEach(name =>
        expect(
          screen.queryByRole('tab', { name: withCount(name) })
        ).not.toBeInTheDocument()
      );
    });

    test('edit mode shows the Visits card for the saved lab result', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          patientId={7}
          editingItem={{ id: 42, test_name: 'CBC' }}
        />
      );
      await openRelationships();
      const card = await screen.findByTestId('visits-card');
      expect(card).toHaveAttribute('data-record-type', 'labResults');
      expect(card).toHaveAttribute('data-record-id', '42');
      expect(card).toHaveAttribute('data-patient-id', '7');
    });

    test('post-create (Simple Add handoff) shows the live Visits card for the new record', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          patientId={7}
          postCreate
          editingItem={{ id: 99, test_name: 'CBC' }}
        />
      );
      await openRelationships();
      const card = await screen.findByTestId('visits-card');
      expect(card).toHaveAttribute('data-record-type', 'labResults');
      expect(card).toHaveAttribute('data-record-id', '99');
    });

    test('advanced create shows the Visits card with no record id', async () => {
      render(
        <LabResultFormWrapper {...defaultProps} patientId={7} advancedCreate />
      );
      await openRelationships();
      const card = await screen.findByTestId('visits-card');
      expect(card).toHaveAttribute('data-record-type', 'labResults');
      expect(card).toHaveAttribute('data-record-id', '');
      expect(JSON.parse(card.getAttribute('data-pending') as string)).toEqual(
        []
      );
    });

    test('pending visits are handed to the page in the API field names', async () => {
      const onPendingRelationshipsRef = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          patientId={7}
          advancedCreate
          onPendingRelationshipsRef={onPendingRelationshipsRef}
        />
      );
      const user = await openRelationships();
      await user.click(await screen.findByText('add-pending-visit'));

      const methods = onPendingRelationshipsRef.mock.calls[0][0];
      expect(methods.hasPendingRelationships()).toBe(true);
      expect(methods.getPendingRelationships().encounters).toEqual([
        { encounter_id: 5, purpose: 'reference', relevance_note: 'n' },
      ]);
      // The card is told about them in its own shape
      expect(
        JSON.parse(
          (await screen.findByTestId('visits-card')).getAttribute(
            'data-pending'
          ) as string
        )
      ).toEqual([{ entityId: 5, relevanceNote: 'n', purpose: 'reference' }]);
    });
  });

  describe('Advanced mode switch', () => {
    test('is not shown when editing an existing lab result', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
          onAdvancedModeChange={vi.fn()}
        />
      );
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    test('is not shown when onAdvancedModeChange is not provided', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    test('calls onAdvancedModeChange when toggled while creating', async () => {
      const onAdvancedModeChange = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          onAdvancedModeChange={onAdvancedModeChange}
        />
      );

      const toggle = screen.getByRole('switch');
      await userEvent.click(toggle);

      expect(onAdvancedModeChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Linked-record tabs (pending vs API-backed sections)', () => {
    test('are not shown when creating a lab result without advanced mode', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.queryByRole('tab', {
          name: withCount('shared:categories.conditions'),
        })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('tab', { name: 'labresults:tabs.relationships' })
      ).not.toBeInTheDocument();
    });

    test('shows the same link card with no record id when creating with advancedCreate enabled', async () => {
      render(
        <LabResultFormWrapper {...defaultProps} advancedCreate patientId={9} />
      );
      await openLinkTab('shared:categories.conditions');

      const card = screen.getByTestId('links-card-conditions');
      expect(card).toHaveAttribute('data-lab-result-id', '');
      expect(card).toHaveAttribute('data-patient-id', '9');
    });

    test('says what each link panel is for', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
        />
      );
      for (const key of [
        'conditions',
        'medications',
        'procedures',
        'treatments',
      ]) {
        const user = userEvent.setup();
        await user.click(
          screen.getByRole('tab', {
            name: withCount(`shared:categories.${key}`),
          })
        );
        expect(await screen.findByTestId(`links-card-${key}`)).toHaveAttribute(
          'data-description',
          `description:${key}:labResult`
        );
      }
      await userEvent.click(
        screen.getByRole('tab', { name: withCount('Visits') })
      );
      expect(await screen.findByTestId('visits-card')).toHaveAttribute(
        'data-description',
        'description:visits:labResult'
      );
    }, 20000);

    test('shows the same link card for the saved lab result when editing', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
          patientId={9}
        />
      );
      await openLinkTab('shared:categories.conditions');

      const card = screen.getByTestId('links-card-conditions');
      expect(card).toHaveAttribute('data-lab-result-id', '1');
      expect(card).toHaveAttribute('data-patient-id', '9');
    });

    test('exposes pending-relationship methods to the parent via onPendingRelationshipsRef', () => {
      const onPendingRelationshipsRef = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          advancedCreate
          onPendingRelationshipsRef={onPendingRelationshipsRef}
        />
      );

      expect(onPendingRelationshipsRef).toHaveBeenCalled();
      const methods = onPendingRelationshipsRef.mock.calls.at(-1)[0];
      expect(methods.hasPendingRelationships()).toBe(false);
      expect(methods.getPendingRelationships()).toEqual({
        conditions: [],
        encounters: [],
        medications: [],
        procedures: [],
        treatments: [],
      });
    });

    test('links chosen in the Add form are handed to the page in the API field names', async () => {
      const onPendingRelationshipsRef = vi.fn();
      const expected: Array<[string, string, string, unknown]> = [
        [
          'shared:categories.conditions',
          'conditions',
          'conditions',
          [{ condition_id: 7, relevance_note: 'cn' }],
        ],
        [
          'shared:categories.medications',
          'medications',
          'medications',
          [{ medication_id: 8, relevance_note: 'mn' }],
        ],
        [
          'shared:categories.procedures',
          'procedures',
          'procedures',
          [{ procedure_id: 9, relevance_note: 'pn' }],
        ],
        [
          'shared:categories.treatments',
          'treatments',
          'treatments',
          [
            {
              treatment_id: 10,
              purpose: 'monitoring',
              expected_frequency: 'weekly',
              relevance_note: 'tn',
            },
          ],
        ],
      ];
      for (const [tab, key, pendingKey, pending] of expected) {
        // A fresh form each time: the Link menu reveals one type per form here
        const { unmount } = render(
          <LabResultFormWrapper
            {...defaultProps}
            advancedCreate
            onPendingRelationshipsRef={onPendingRelationshipsRef}
          />
        );
        const user = await openLinkTab(tab);
        await user.click(
          screen.getByRole('button', { name: `add-pending-${key}` })
        );
        const methods = onPendingRelationshipsRef.mock.calls.at(-1)[0];
        expect(methods.hasPendingRelationships()).toBe(true);
        expect(methods.getPendingRelationships()[pendingKey]).toEqual(pending);
        unmount();
      }
    }, 20000);

    test('pending links are handed back to the card as links', async () => {
      render(<LabResultFormWrapper {...defaultProps} advancedCreate />);
      const user = await openLinkTab('shared:categories.treatments');
      await user.click(
        screen.getByRole('button', { name: 'add-pending-treatments' })
      );
      expect(
        JSON.parse(
          screen.getByTestId('links-card-treatments').dataset.pending ?? 'null'
        )
      ).toEqual([
        {
          entityId: 10,
          relevanceNote: 'tn',
          purpose: 'monitoring',
          expectedFrequency: 'weekly',
        },
      ]);
    });

    test('refreshes the page lists of saved links when the dialog closes after link activity', async () => {
      const fetchers = {
        fetchLabResultConditions: vi.fn(),
        fetchLabResultMedications: vi.fn(),
        fetchLabResultProcedures: vi.fn(),
        fetchLabResultTreatments: vi.fn(),
      };
      const props = {
        ...defaultProps,
        editingItem: { id: 42, test_name: 'CBC' },
        ...fetchers,
      };
      const { rerender } = render(<LabResultFormWrapper {...props} />);
      const user = await openLinkTab('shared:categories.conditions');
      await user.click(
        screen.getByRole('button', { name: 'set-count-conditions' })
      );
      Object.values(fetchers).forEach(fetcher => fetcher.mockClear());

      rerender(<LabResultFormWrapper {...props} isOpen={false} />);
      Object.values(fetchers).forEach(fetcher =>
        expect(fetcher).toHaveBeenCalledWith(42)
      );
    });

    test('does not refresh the page lists on close when no link tab was opened', () => {
      const fetchLabResultConditions = vi.fn();
      const props = {
        ...defaultProps,
        editingItem: { id: 42, test_name: 'CBC' },
        fetchLabResultConditions,
      };
      const { rerender } = render(<LabResultFormWrapper {...props} />);
      fetchLabResultConditions.mockClear();
      rerender(<LabResultFormWrapper {...props} isOpen={false} />);
      expect(fetchLabResultConditions).not.toHaveBeenCalled();
    });

    test('the tab number follows the saved links as the card reports them', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 42, test_name: 'CBC' }}
          labResultConditions={{ 42: [{ id: 1 }] }}
        />
      );
      expect(
        screen.getByRole('tab', { name: 'shared:categories.conditions (1)' })
      ).toBeInTheDocument();
      const user = await openLinkTab('shared:categories.conditions');
      await user.click(
        screen.getByRole('button', { name: 'set-count-conditions' })
      );
      expect(
        screen.getByRole('tab', { name: 'shared:categories.conditions (4)' })
      ).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    test('calls onClose when Cancel is clicked', async () => {
      const mockClose = vi.fn();
      render(<LabResultFormWrapper {...defaultProps} onClose={mockClose} />);

      // i18n keys are rendered as-is in the test environment
      const cancelButton = screen.getByRole('button', {
        name: 'shared:fields.cancel',
      });
      await userEvent.click(cancelButton);

      expect(mockClose).toHaveBeenCalled();
    });

    test('Submit button is disabled when test_name is empty', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      // Button text: "common:buttons.create shared:categories.lab_results"
      const submitButtons = screen.getAllByRole('button');
      const submitButton = submitButtons.find(btn =>
        btn.textContent.includes('common:buttons.create')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton).toBeDisabled();
    });

    test('Submit button is enabled when test_name is provided', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, test_name: 'CBC' }}
        />
      );

      const submitButtons = screen.getAllByRole('button');
      const submitButton = submitButtons.find(btn =>
        btn.textContent.includes('common:buttons.create')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Results & Status tab — components editor visibility (#1025 follow-up)', () => {
    test('hides the Tests/components editor for a legacy result with a flat value and no components', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, value: 50 }}
          isGroupedResult={false}
        />
      );
      // Previously always rendered here, even with zero components, as a full
      // empty-state block (icon/title/description/Add Tests button) below the
      // one flat value being edited - reads as broken/extraneous rather than
      // useful for a legacy result reached via Test Results mode's trend panel.
      expect(
        screen.queryByTestId('test-components-tab')
      ).not.toBeInTheDocument();
    });

    test('hides the Tests/components editor for a legacy result with a flat labs_result and no components', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, labs_result: 'abnormal' }}
          isGroupedResult={false}
        />
      );
      expect(
        screen.queryByTestId('test-components-tab')
      ).not.toBeInTheDocument();
    });

    test('still shows the Tests/components editor for a new-style result with no components and no flat value yet (none added, or all deleted)', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, value: null, labs_result: '' }}
          isGroupedResult={false}
        />
      );
      expect(screen.getByTestId('test-components-tab')).toBeInTheDocument();
    });

    test('still shows the Tests/components editor when editing a result that already has components', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42 }}
          isGroupedResult
        />
      );
      expect(screen.getByTestId('test-components-tab')).toBeInTheDocument();
    });

    test('stays hidden for a legacy result even after the user clears the labs_result field in the live form (regression: must read the saved record, not live formData)', () => {
      // editingItem (the saved record) still has labs_result='abnormal', so
      // this is a legacy result even though the in-progress edit has cleared
      // the field and hasn't entered a value yet - the Tests section must not
      // pop in mid-edit just because the field is momentarily empty.
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, labs_result: 'abnormal' }}
          isGroupedResult={false}
          formData={{ ...defaultProps.formData, labs_result: '', value: '' }}
        />
      );
      expect(
        screen.queryByTestId('test-components-tab')
      ).not.toBeInTheDocument();
    });

    test('stays visible for a new-style empty result even after the user types a value into the live form (regression: must read the saved record, not live formData)', () => {
      // editingItem (the saved record) has neither value nor labs_result, so
      // this is a new-style result with nothing added yet - typing a draft
      // value into the form must not hide the Tests section mid-edit.
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, value: null, labs_result: '' }}
          isGroupedResult={false}
          formData={{ ...defaultProps.formData, value: 50 }}
        />
      );
      expect(screen.getByTestId('test-components-tab')).toBeInTheDocument();
    });
  });
});
