import { vi } from 'vitest';
import { screen } from '@testing-library/react';
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
vi.mock('../MedicationRelationships', () => ({ default: () => null }));
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
vi.mock('../../shared/RecordLabResultsCard', () => ({
  default: props => (
    <div
      data-testid="record-lab-results"
      data-record-path={props.recordPath}
      data-record-id={props.recordId ?? ''}
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
        add-pending-lab-result
      </button>
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
    Form: MantineMedicationForm,
    props: medicationForm,
    saved: { editingMedication: { id: 42 } },
  },
  {
    name: 'Procedure',
    path: 'procedures',
    record: 'procedure',
    Form: ProcedureFormWrapper,
    props: procedureForm,
    saved: { editingItem: { id: 42, procedure_name: 'x' } },
  },
];

beforeEach(() => {
  api.getRecordLabResultLinks.mockReset().mockResolvedValue([]);
  api.getRecordEncounterLinks.mockReset().mockResolvedValue([]);
});

describe.each(FORMS)(
  '$name Add form - Visits and Lab Results link tabs (#1128)',
  ({ path, record, Form, props, saved }) => {
    it('shows neither tab until a link is added, with a Link menu for both', async () => {
      render(<Form {...props()} />);
      expect(screen.queryByRole('tab', { name: VISITS_TAB })).toBeNull();
      expect(screen.queryByRole('tab', { name: LAB_TAB })).toBeNull();

      await userEvent.click(
        screen.getByRole('button', { name: 'common:buttons.link' })
      );
      const items = await screen.findAllByRole('menuitem');
      expect(items.map(item => item.textContent)).toEqual([
        'Visits',
        'shared:tabs.labResults',
      ]);
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
      ).toEqual(['Visits', 'shared:tabs.labResults']);
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

describe('Medication and Procedure View dialogs - Lab Results tab (#1128)', () => {
  it('medication view shows a read-only card', async () => {
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
    await userEvent.click(screen.getByRole('tab', { name: LAB_TAB }));
    const card = await screen.findByTestId('record-lab-results');
    expect(card).toHaveAttribute('data-record-path', 'medications');
    expect(card).toHaveAttribute('data-record-id', '42');
    expect(card).toHaveAttribute('data-view-mode', 'true');
  });

  it('procedure view shows a read-only card', async () => {
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
    await userEvent.click(screen.getByRole('tab', { name: LAB_TAB }));
    const card = await screen.findByTestId('record-lab-results');
    expect(card).toHaveAttribute('data-record-path', 'procedures');
    expect(card).toHaveAttribute('data-record-id', '9');
    expect(card).toHaveAttribute('data-view-mode', 'true');
  });
});
