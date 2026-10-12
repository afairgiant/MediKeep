import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render from '../../../test-utils/render';
import MantineMedicationForm from '../MantineMedicationForm';
import MedicationViewModal from '../medications/MedicationViewModal';
import ProcedureFormWrapper from '../procedures/ProcedureFormWrapper';
import ProcedureViewModal from '../procedures/ProcedureViewModal';

// The full forms are slow to render when the whole suite runs in parallel
vi.setConfig({ testTimeout: 20000 });

const api = vi.hoisted(() => ({
  getRecordLabResultLinks: vi.fn(),
  getRecordEncounterLinks: vi.fn(),
  getMedicationConditions: vi.fn(),
}));
vi.mock('../../../services/api', () => ({ apiService: api }));
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: vi.fn(),
    formatDate: date => date,
  }),
}));
vi.mock('../../../hooks/useLinkPanelDescription', () => ({
  useLinkPanelDescription: () => (items, record) =>
    `description:${items}:${record}`,
}));
vi.mock('../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));
vi.mock('../medications/MedicationTreatmentsList', () => ({
  default: () => null,
}));
vi.mock('../../shared/RecordLinkCard', () => ({
  default: props => {
    const testId = {
      labResults: 'record-lab-results',
      medications: 'condition-medications',
      conditions: 'medication-conditions',
    }[props.kind];
    const addLabel = {
      labResults: 'add-pending-lab-result',
      medications: 'add-pending-medication',
      conditions: 'add-pending-condition',
    }[props.kind];
    return (
      <div
        data-testid={testId}
        data-record-path={props.recordPath}
        data-record-id={props.recordId ?? ''}
        data-condition-id={props.recordId ?? ''}
        data-medication-id={props.recordId ?? ''}
        data-patient-id={props.patientId ?? ''}
        data-view-mode={String(Boolean(props.isViewMode))}
        data-pending={JSON.stringify(props.pendingLinks ?? null)}
      >
        {props.description}
        <button
          type="button"
          onClick={() =>
            props.onPendingChange?.([
              { entityId: 5, relevanceNote: 'n', purpose: null },
            ])
          }
        >
          {addLabel}
        </button>
      </div>
    );
  },
}));
vi.mock('../practitioners/PractitionerSelectWithCreate', () => ({
  default: () => null,
}));
vi.mock('../StatusBadge', () => ({
  default: ({ status }) => <span>{status}</span>,
}));
vi.mock('../../common/ClickableTagBadge', () => ({
  ClickableTagBadge: ({ children }) => <span>{children}</span>,
}));
vi.mock('../../common/TagInput', () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));
vi.mock('../../shared/RecordVisitsTab', () => ({
  default: props => (
    <div
      data-testid="record-visits"
      data-record-id={props.recordId ?? ''}
      data-pending={JSON.stringify(props.pendingLinks ?? null)}
    >
      {props.description}
    </div>
  ),
}));

const LAB_TAB = /^shared:tabs\.labResults( \(\d+\))?$/;
const VISITS_TAB = /^Visits( \(\d+\))?$/;
const pendingLab = [{ entityId: 3, relevanceNote: 'n', purpose: null }];

const medicationForm = (extra = {}, formData = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  title: 'Medication',
  formData: {
    medication_name: '',
    tags: [],
    condition_ids: [],
    reminder_times: [],
    ...formData,
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue({}),
  practitioners: [],
  pharmacies: [],
  conditions: [],
  patientId: 7,
  navigate: vi.fn(),
  ...extra,
});

const procedureForm = (extra = {}, formData = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  title: 'Procedure',
  formData: { procedure_name: '', tags: [], ...formData },
  onInputChange: vi.fn(),
  onSubmit: vi.fn(),
  practitioners: [],
  editingItem: null,
  isLoading: false,
  patientId: 7,
  navigate: vi.fn(),
  ...extra,
});

const FORMS = [
  {
    name: 'Medication',
    path: 'medications',
    record: 'medication',
    menu: ['shared:categories.conditions', 'shared:tabs.labResults', 'Visits'],
    Form: MantineMedicationForm,
    props: medicationForm,
    saved: { editingMedication: { id: 42 } },
  },
  {
    name: 'Procedure',
    path: 'procedures',
    record: 'procedure',
    menu: ['Visits', 'shared:tabs.labResults'],
    Form: ProcedureFormWrapper,
    props: procedureForm,
    saved: { editingItem: { id: 42, procedure_name: 'x' } },
  },
];

beforeEach(() => {
  api.getRecordLabResultLinks.mockReset().mockResolvedValue([]);
  api.getRecordEncounterLinks.mockReset().mockResolvedValue([]);
  api.getMedicationConditions.mockReset().mockResolvedValue([]);
});

describe.each(FORMS)(
  '$name Add form - Visits and Lab Results link tabs (#1128)',
  ({ path, record, menu, Form, props, saved }) => {
    it('shows neither tab until a link is added, with a Link menu for both', async () => {
      render(<Form {...props()} />);
      expect(screen.queryByRole('tab', { name: VISITS_TAB })).toBeNull();
      expect(screen.queryByRole('tab', { name: LAB_TAB })).toBeNull();

      await userEvent.click(
        screen.getByRole('button', { name: 'common:buttons.link' })
      );
      const items = await screen.findAllByRole('menuitem');
      expect(items.map(item => item.textContent)).toEqual(menu);
    });

    it('picking Lab Results from the Link menu shows its tab and opens it', async () => {
      render(<Form {...props()} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'common:buttons.link' })
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'shared:tabs.labResults' })
      );

      expect(screen.getByRole('tab', { name: LAB_TAB })).toBeInTheDocument();
      const card = await screen.findByTestId('record-lab-results');
      expect(card).toHaveAttribute('data-record-path', path);
      expect(card).toHaveAttribute('data-record-id', '');
      expect(card).toHaveAttribute('data-patient-id', '7');
      // Visits is still offered by the menu
      expect(screen.queryByRole('tab', { name: VISITS_TAB })).toBeNull();
    });

    it('a type picked from the Link menu goes back into the menu if it is left with no links', async () => {
      render(<Form {...props()} />);
      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', { name: 'common:buttons.link' })
      );
      await user.click(
        await screen.findByRole('menuitem', { name: 'shared:tabs.labResults' })
      );
      expect(
        screen.getByRole('tab', { name: 'shared:tabs.labResults (0)' })
      ).toBeInTheDocument();

      // Leave it without linking anything: no empty (0) tab, it is offered again
      await user.click(screen.getAllByRole('tab')[0]);
      expect(screen.queryByRole('tab', { name: LAB_TAB })).toBeNull();
      await user.click(
        screen.getByRole('button', { name: 'common:buttons.link' })
      );
      // The dropdown is still fading in under jsdom, so it is not yet "visible"
      expect(
        (await screen.findAllByRole('menuitem', { hidden: true })).map(
          item => item.textContent
        )
      ).toEqual(menu);
    }, 20000);

    it('picking Visits from the Link menu shows its tab', async () => {
      render(<Form {...props()} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'common:buttons.link' })
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'Visits' })
      );
      expect(screen.getByRole('tab', { name: VISITS_TAB })).toBeInTheDocument();
      expect(await screen.findByTestId('record-visits')).toBeInTheDocument();
    });

    it('shows the Lab Results tab, with its count, when a lab result is already chosen', () => {
      render(<Form {...props({}, { pending_lab_result_links: pendingLab })} />);
      expect(
        screen.getByRole('tab', { name: 'shared:tabs.labResults (1)' })
      ).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: VISITS_TAB })).toBeNull();
    });

    it('shows the Visits tab, with its count, when a visit is already chosen', () => {
      render(
        <Form
          {...props(
            {},
            {
              pending_visit_links: [
                { entityId: 1, relevanceNote: null, purpose: null },
              ],
            }
          )}
        />
      );
      expect(
        screen.getByRole('tab', { name: 'Visits (1)' })
      ).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: LAB_TAB })).toBeNull();
    });

    it('stores chosen lab results in the form data under pending_lab_result_links', async () => {
      const onInputChange = vi.fn();
      render(
        <Form
          {...props(
            { onInputChange },
            { pending_lab_result_links: pendingLab }
          )}
        />
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: LAB_TAB }));
      expect(
        JSON.parse(
          (await screen.findByTestId('record-lab-results')).dataset.pending
        )
      ).toEqual(pendingLab);
      await user.click(screen.getByText('add-pending-lab-result'));
      expect(onInputChange).toHaveBeenCalledWith({
        target: {
          name: 'pending_lab_result_links',
          value: [{ entityId: 5, relevanceNote: 'n', purpose: null }],
        },
      });
    });

    it('says what the Visits and Lab Results panels are for', async () => {
      render(
        <Form
          {...props(
            {},
            {
              pending_visit_links: pendingLab,
              pending_lab_result_links: pendingLab,
            }
          )}
        />
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: VISITS_TAB }));
      expect(
        await screen.findByText(`description:visits:${record}`)
      ).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: LAB_TAB }));
      expect(
        await screen.findByText(`description:labResults:${record}`)
      ).toBeInTheDocument();
    });

    it('keeps both tabs, and no Link menu, when editing a saved record', async () => {
      api.getRecordLabResultLinks.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      render(<Form {...props(saved)} />);
      expect(screen.getByRole('tab', { name: VISITS_TAB })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: LAB_TAB })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'common:buttons.link' })
      ).toBeNull();
      expect(
        await screen.findByRole('tab', { name: 'shared:tabs.labResults (2)' })
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('tab', { name: LAB_TAB }));
      const card = await screen.findByTestId('record-lab-results');
      expect(card).toHaveAttribute('data-record-id', '42');
      expect(card).toHaveAttribute('data-view-mode', 'false');
    });
  }
);

describe('Medication Add form - Conditions link tab (#1128)', () => {
  const COND = 'shared:categories.conditions';
  const COND_TAB = new RegExp(`^${COND}( \\(\\d+\\))?$`);
  const pendingCondition = [{ entityId: 3, relevanceNote: 'n', purpose: null }];

  it('is not a tab until a condition is linked, and the old condition picker is gone', async () => {
    render(<MantineMedicationForm {...medicationForm()} />);
    expect(screen.queryByRole('tab', { name: COND_TAB })).toBeNull();
    expect(screen.queryByText('common:buttons.linkConditions')).toBeNull();
  });

  it('picking Conditions from the Link menu shows its tab and opens the card', async () => {
    render(<MantineMedicationForm {...medicationForm()} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'common:buttons.link' })
    );
    await user.click(await screen.findByRole('menuitem', { name: COND }));

    expect(
      screen.getByRole('tab', { name: `${COND} (0)` })
    ).toBeInTheDocument();
    const card = await screen.findByTestId('medication-conditions');
    expect(card).toHaveAttribute('data-medication-id', '');
    expect(card).toHaveAttribute('data-patient-id', '7');
    expect(card).toHaveAttribute('data-view-mode', 'false');
    expect(card).toHaveTextContent('description:conditions:medication');
  });

  it('shows the tab, with its count, and stores chosen conditions under pending_condition_links', async () => {
    const onInputChange = vi.fn();
    render(
      <MantineMedicationForm
        {...medicationForm(
          { onInputChange },
          { pending_condition_links: pendingCondition }
        )}
      />
    );
    expect(
      screen.getByRole('tab', { name: `${COND} (1)` })
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: COND_TAB }));
    expect(
      JSON.parse(
        (await screen.findByTestId('medication-conditions')).dataset.pending
      )
    ).toEqual(pendingCondition);
    await user.click(screen.getByText('add-pending-condition'));
    expect(onInputChange).toHaveBeenCalledWith({
      target: {
        name: 'pending_condition_links',
        value: [{ entityId: 5, relevanceNote: 'n', purpose: null }],
      },
    });
  });

  it('keeps the Conditions tab, with the saved medication, when editing', async () => {
    api.getMedicationConditions.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    render(
      <MantineMedicationForm
        {...medicationForm({ editingMedication: { id: 42 } })}
      />
    );
    expect(
      await screen.findByRole('tab', { name: `${COND} (2)` })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: COND_TAB }));
    expect(await screen.findByTestId('medication-conditions')).toHaveAttribute(
      'data-medication-id',
      '42'
    );
  });
});

describe('Medication and Procedure View dialogs - Lab Results tab (#1128)', () => {
  it('medication view shows a read-only card', async () => {
    api.getRecordLabResultLinks.mockResolvedValue([{ id: 1 }]);
    render(
      <MedicationViewModal
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        navigate={vi.fn()}
        practitioners={[]}
        conditions={[]}
        medication={{
          id: 42,
          medication_name: 'Ibuprofen',
          status: 'active',
          tags: [],
        }}
      />
    );
    await userEvent.click(await screen.findByRole('tab', { name: LAB_TAB }));
    const card = await screen.findByTestId('record-lab-results');
    expect(card).toHaveAttribute('data-record-path', 'medications');
    expect(card).toHaveAttribute('data-record-id', '42');
    expect(card).toHaveAttribute('data-view-mode', 'true');
  });

  it('medication view shows its conditions in their own read-only tab', async () => {
    api.getMedicationConditions.mockResolvedValue([{ id: 1 }]);
    render(
      <MedicationViewModal
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        navigate={vi.fn()}
        practitioners={[]}
        medication={{
          id: 42,
          medication_name: 'Ibuprofen',
          status: 'active',
          tags: [],
        }}
      />
    );
    expect(
      await screen.findByRole('tab', {
        name: 'shared:categories.conditions (1)',
      })
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('tab', { name: /^shared:categories\.conditions/ })
    );
    const card = await screen.findByTestId('medication-conditions');
    expect(card).toHaveAttribute('data-medication-id', '42');
    expect(card).toHaveAttribute('data-view-mode', 'true');
    expect(card).not.toHaveTextContent('description:');
  });

  it.each([
    [
      'medication',
      <MedicationViewModal
        key="m"
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        navigate={vi.fn()}
        practitioners={[]}
        medication={{ id: 42, medication_name: 'Ibuprofen', tags: [] }}
      />,
    ],
    [
      'procedure',
      <ProcedureViewModal
        key="p"
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        navigate={vi.fn()}
        practitioners={[]}
        procedure={{ id: 9, procedure_name: 'Appendectomy', tags: [] }}
      />,
    ],
  ])(
    '%s view has no link tabs when nothing is linked',
    async (_name, dialog) => {
      render(dialog);
      await waitFor(() =>
        expect(api.getRecordLabResultLinks).toHaveBeenCalled()
      );
      await waitFor(() =>
        expect(api.getRecordEncounterLinks).toHaveBeenCalled()
      );
      for (const name of [
        LAB_TAB,
        VISITS_TAB,
        /^shared:categories\.conditions/,
      ]) {
        expect(screen.queryByRole('tab', { name })).toBeNull();
      }
    }
  );

  it('procedure view shows a read-only card', async () => {
    api.getRecordLabResultLinks.mockResolvedValue([{ id: 1 }]);
    render(
      <ProcedureViewModal
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        navigate={vi.fn()}
        practitioners={[]}
        procedure={{ id: 9, procedure_name: 'Appendectomy', tags: [] }}
      />
    );
    await userEvent.click(await screen.findByRole('tab', { name: LAB_TAB }));
    const card = await screen.findByTestId('record-lab-results');
    expect(card).toHaveAttribute('data-record-path', 'procedures');
    expect(card).toHaveAttribute('data-record-id', '9');
    expect(card).toHaveAttribute('data-view-mode', 'true');
  });
});
