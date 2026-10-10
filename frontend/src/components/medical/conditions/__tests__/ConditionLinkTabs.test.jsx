import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render from '../../../../test-utils/render';
import ConditionFormWrapper from '../ConditionFormWrapper';
import ConditionViewModal from '../ConditionViewModal';
import {
  SUB_DIALOG_Z_INDEX,
  SubDialogContext,
} from '../../../../contexts/SubDialogContext';

// The full dialogs are slow to render when the whole suite runs in parallel
vi.setConfig({ testTimeout: 20000 });

const api = vi.hoisted(() => ({
  getConditionMedicationLinks: vi.fn(),
  getRecordLabResultLinks: vi.fn(),
  getRecordEncounterLinks: vi.fn(),
}));
vi.mock('../../../../services/api', () => ({ apiService: api }));
vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: vi.fn(),
    formatDate: date => date,
  }),
}));
vi.mock('../../../../hooks/useLinkPanelDescription', () => ({
  useLinkPanelDescription: () => (items, record) =>
    `description:${items}:${record}`,
}));
vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));
vi.mock('../../practitioners/PractitionerSelectWithCreate', () => ({
  default: () => null,
}));
vi.mock('../../StatusBadge', () => ({
  default: ({ status }) => <span>{status}</span>,
}));
vi.mock('../../../common/ClickableTagBadge', () => ({
  ClickableTagBadge: ({ children }) => <span>{children}</span>,
}));
vi.mock('../../../common/TagInput', () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));
vi.mock('../../../shared/RecordVisitsTab', () => ({
  default: props => (
    <div
      data-testid="record-visits"
      data-record-id={props.recordId ?? ''}
      data-view-mode={String(Boolean(props.isViewMode))}
    >
      {props.description}
    </div>
  ),
}));
vi.mock('../../../shared/RecordLinkCard', () => ({
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

const MEDS = 'shared:categories.medications';
const LABS = 'shared:tabs.labResults';
const tab = (name, count) =>
  new RegExp(
    `^${name}${count === undefined ? '( \\(\\d+\\))?' : ` \\(${count}\\)`}$`
  );
const MEDS_TAB = tab(MEDS);
const LABS_TAB = tab(LABS);
const VISITS_TAB = tab('Visits');

const formProps = (extra = {}, formData = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add Condition',
  formData: {
    diagnosis: '',
    tags: [],
    pending_medication_links: [],
    pending_lab_result_links: [],
    pending_visit_links: [],
    ...formData,
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn(),
  practitioners: [],
  isLoading: false,
  patientId: 7,
  navigate: vi.fn(),
  ...extra,
});

const link = [{ entityId: 3, relevanceNote: 'n', purpose: null }];

const openMenu = async user =>
  user.click(screen.getByRole('button', { name: 'common:buttons.link' }));

beforeEach(() => {
  api.getConditionMedicationLinks.mockReset().mockResolvedValue([]);
  api.getRecordLabResultLinks.mockReset().mockResolvedValue([]);
  api.getRecordEncounterLinks.mockReset().mockResolvedValue([]);
});

describe('Condition Add form - link tabs (#1128)', () => {
  it('shows no link tabs until a link is added, with a Link menu for all three', async () => {
    render(<ConditionFormWrapper {...formProps()} />);
    for (const name of [MEDS_TAB, LABS_TAB, VISITS_TAB]) {
      expect(screen.queryByRole('tab', { name })).toBeNull();
    }
    const user = userEvent.setup();
    await openMenu(user);
    expect(
      (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    ).toEqual([MEDS, LABS, 'Visits']);
  });

  it('picking Medications from the Link menu shows its tab and opens the card', async () => {
    render(<ConditionFormWrapper {...formProps()} />);
    const user = userEvent.setup();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: MEDS }));

    expect(
      screen.getByRole('tab', { name: `${MEDS} (0)` })
    ).toBeInTheDocument();
    const card = await screen.findByTestId('condition-medications');
    expect(card).toHaveAttribute('data-condition-id', '');
    expect(card).toHaveAttribute('data-patient-id', '7');
    expect(card).toHaveAttribute('data-view-mode', 'false');
  });

  it('a type picked from the menu goes back into it if it is left with no links', async () => {
    render(<ConditionFormWrapper {...formProps()} />);
    const user = userEvent.setup();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: LABS }));
    expect(
      screen.getByRole('tab', { name: `${LABS} (0)` })
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole('tab')[0]);
    expect(screen.queryByRole('tab', { name: LABS_TAB })).toBeNull();
    await openMenu(user);
    // The dropdown is still fading in under jsdom, so it is not yet "visible"
    expect(
      (await screen.findAllByRole('menuitem', { hidden: true })).map(
        item => item.textContent
      )
    ).toEqual([MEDS, LABS, 'Visits']);
  });

  it.each([
    ['medications', 'pending_medication_links', MEDS],
    ['lab results', 'pending_lab_result_links', LABS],
    ['visits', 'pending_visit_links', 'Visits'],
  ])(
    'shows only the %s tab, with its count, when one is already chosen',
    (_label, field, name) => {
      render(<ConditionFormWrapper {...formProps({}, { [field]: link })} />);
      expect(
        screen.getByRole('tab', { name: `${name} (1)` })
      ).toBeInTheDocument();
      // The other two link tabs stay in the Link menu
      const linkTabs = screen
        .getAllByRole('tab')
        .filter(t =>
          [MEDS, LABS, 'Visits'].some(n => t.textContent.startsWith(n))
        );
      expect(linkTabs).toHaveLength(1);
    }
  );

  it('stores chosen medications in the form data under pending_medication_links', async () => {
    const onInputChange = vi.fn();
    render(
      <ConditionFormWrapper
        {...formProps({ onInputChange }, { pending_medication_links: link })}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: MEDS_TAB }));
    expect(
      JSON.parse(
        (await screen.findByTestId('condition-medications')).dataset.pending
      )
    ).toEqual(link);
    await user.click(screen.getByText('add-pending-medication'));
    expect(onInputChange).toHaveBeenCalledWith({
      target: {
        name: 'pending_medication_links',
        value: [{ entityId: 5, relevanceNote: 'n', purpose: null }],
      },
    });
  });

  it('says what each panel is for', async () => {
    render(
      <ConditionFormWrapper
        {...formProps(
          {},
          {
            pending_medication_links: link,
            pending_lab_result_links: link,
            pending_visit_links: link,
          }
        )}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: MEDS_TAB }));
    expect(
      await screen.findByText('description:medications:condition')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: LABS_TAB }));
    expect(
      await screen.findByText('description:labResults:condition')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: VISITS_TAB }));
    expect(
      await screen.findByText('description:visits:condition')
    ).toBeInTheDocument();
  });

  it('keeps all three tabs, and no Link menu, when editing a saved condition', async () => {
    api.getConditionMedicationLinks.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    render(
      <ConditionFormWrapper
        {...formProps({ editingCondition: { id: 42, diagnosis: 'x' } })}
      />
    );
    for (const name of [MEDS_TAB, LABS_TAB, VISITS_TAB]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
    expect(
      await screen.findByRole('tab', { name: `${MEDS} (2)` })
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: MEDS_TAB }));
    expect(await screen.findByTestId('condition-medications')).toHaveAttribute(
      'data-condition-id',
      '42'
    );
    await user.click(screen.getByRole('tab', { name: LABS_TAB }));
    const labs = await screen.findByTestId('record-lab-results');
    expect(labs).toHaveAttribute('data-record-path', 'conditions');
    expect(labs).toHaveAttribute('data-record-id', '42');
  });

  it('offers no link tabs inside a nested dialog', () => {
    render(
      <SubDialogContext.Provider value={{ zIndex: SUB_DIALOG_Z_INDEX }}>
        <ConditionFormWrapper {...formProps()} />
      </SubDialogContext.Provider>
    );
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
    for (const name of [MEDS_TAB, LABS_TAB, VISITS_TAB]) {
      expect(screen.queryByRole('tab', { name })).toBeNull();
    }
  });
});

describe('Condition View dialog - link tabs (#1128)', () => {
  const renderModal = () =>
    render(
      <ConditionViewModal
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        navigate={vi.fn()}
        practitioners={[]}
        condition={{
          id: 42,
          diagnosis: 'Hypertension',
          status: 'active',
          tags: [],
        }}
      />
    );

  it('shows only the link tabs that have links, with their counts', async () => {
    api.getConditionMedicationLinks.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    api.getRecordLabResultLinks.mockResolvedValue([]);
    api.getRecordEncounterLinks.mockResolvedValue([{ id: 3 }]);
    renderModal();

    expect(
      await screen.findByRole('tab', { name: `${MEDS} (2)` })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: 'Visits (1)' })
    ).toBeInTheDocument();
    // No empty "(0)" tab for the type without links
    expect(screen.queryByRole('tab', { name: LABS_TAB })).toBeNull();
  });

  it('shows no link tabs at all for a condition without links', async () => {
    renderModal();
    await waitFor(() =>
      expect(api.getConditionMedicationLinks).toHaveBeenCalled()
    );
    await waitFor(() => expect(api.getRecordLabResultLinks).toHaveBeenCalled());
    for (const name of [MEDS_TAB, LABS_TAB, VISITS_TAB]) {
      expect(screen.queryByRole('tab', { name })).toBeNull();
    }
  });

  it('shows read-only Medications and Lab Results cards in their own tabs', async () => {
    api.getConditionMedicationLinks.mockResolvedValue([{ id: 1 }]);
    api.getRecordLabResultLinks.mockResolvedValue([{ id: 2 }]);
    renderModal();
    const user = userEvent.setup();

    expect(
      await screen.findByRole('tab', { name: `${MEDS} (1)` })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: MEDS_TAB }));
    const meds = await screen.findByTestId('condition-medications');
    expect(meds).toHaveAttribute('data-condition-id', '42');
    expect(meds).toHaveAttribute('data-view-mode', 'true');

    await user.click(screen.getByRole('tab', { name: LABS_TAB }));
    const labs = await screen.findByTestId('record-lab-results');
    expect(labs).toHaveAttribute('data-record-path', 'conditions');
    expect(labs).toHaveAttribute('data-record-id', '42');
    expect(labs).toHaveAttribute('data-view-mode', 'true');
  });

  it('does not add the panel descriptions to the View dialog', async () => {
    api.getConditionMedicationLinks.mockResolvedValue([{ id: 1 }]);
    renderModal();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: MEDS_TAB }));
    await screen.findByTestId('condition-medications');
    expect(screen.queryByText(/linkPanels\./)).toBeNull();
  });

  it('no longer lists the medications inside the Overview tab', () => {
    renderModal();
    expect(screen.queryByTestId('condition-medications')).toBeNull();
  });
});
