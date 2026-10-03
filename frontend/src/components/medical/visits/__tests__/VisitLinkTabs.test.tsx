import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Tabs } from '@mantine/core';

import render, { screen, waitFor, within } from '../../../../test-utils/render';
import { VisitLinkTabButtons, VisitLinkTabPanels } from '../VisitLinkTabs';
import type { PendingLinks } from '../../../../types/encounterLinks';

const api = vi.hoisted(() => ({
  getEncounterLinks: vi.fn(),
  createEncounterLinksBulk: vi.fn(),
  updateEncounterLink: vi.fn(),
  deleteEncounterLink: vi.fn(),
  getPatientProcedures: vi.fn(),
  getPatientTreatments: vi.fn(),
  getPatientInjuries: vi.fn(),
  getPatientConditions: vi.fn(),
  getPatientMedications: vi.fn(),
  getPatientLabResults: vi.fn(),
  getSymptoms: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({ apiService: api }));
vi.mock('../../../../services/api/symptomApi', () => ({
  symptomApi: { getAll: api.getSymptoms },
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

import { navigateToEntity } from '../../../../utils/linkNavigation';

Element.prototype.scrollIntoView = vi.fn();

const VISIT_ID = 55;
const PATIENT_ID = 7;

const I18N = {
  link: 'common:buttons.link',
  linkSelected: 'common:visits.relationships.linkSelected',
  none: 'common:visits.relationships.none',
  placeholder: 'common:visits.relationships.selectPlaceholder',
  editLink: 'common:visits.relationships.editLink',
  removeLink: 'common:visits.relationships.removeLink',
  save: 'common:buttons.save',
  notePlaceholder: 'common:modals.relevanceNoteOptional',
  noteLabel: 'common:modals.relevanceNote',
  purpose: 'common:visits.relationships.purpose',
  procedures: 'shared:categories.procedures',
  labResults: 'shared:categories.lab_results',
};

/** Real response shapes from /encounters/{id}/{type}. */
const procedureLink = {
  id: 11,
  encounter_id: VISIT_ID,
  entity_id: 3,
  relevance_note: 'Performed during visit',
  entity_name: 'Knee arthroscopy',
  entity_date: '2026-01-10',
  entity_status: 'completed',
};
const labResultLink = {
  id: 21,
  encounter_id: VISIT_ID,
  lab_result_id: 9,
  purpose: 'results_reviewed',
  relevance_note: null,
  lab_result_name: 'Complete Blood Count',
  lab_result_date: '2026-02-01',
  lab_result_status: 'completed',
};

const candidates = {
  procedures: [
    {
      id: 3,
      procedure_name: 'Knee arthroscopy',
      date: '2026-01-10',
      status: 'completed',
    },
    {
      id: 4,
      procedure_name: 'Appendectomy',
      date: '2025-05-02',
      status: 'completed',
    },
  ],
  labResults: [
    {
      id: 9,
      test_name: 'Complete Blood Count',
      ordered_date: '2026-02-01',
      status: 'completed',
    },
    {
      id: 10,
      test_name: 'Lipid Panel',
      ordered_date: '2026-02-03',
      status: 'completed',
    },
  ],
};

type TypeKey = 'procedures' | 'labResults' | 'conditions';
const tabValue = (key: TypeKey) => `link-${key}`;

interface TabProps {
  visitId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  pendingLinks?: PendingLinks;
  onPendingChange?: (_next: PendingLinks) => void;
  navigate?: (_path: string) => void;
  onSelectTab?: (_tab: string) => void;
}

const buildTree = (key: TypeKey, props: TabProps = {}) => {
  const { onSelectTab, ...panelProps } = props;
  return (
    <Tabs value={tabValue(key)}>
      <Tabs.List>
        <VisitLinkTabButtons
          visitId={props.visitId}
          pendingLinks={props.pendingLinks}
          isViewMode={props.isViewMode}
          onSelectTab={onSelectTab}
        />
      </Tabs.List>
      <VisitLinkTabPanels activeTab={tabValue(key)} {...panelProps} />
    </Tabs>
  );
};

/** Renders the tab buttons and panels with one type's tab open. */
const renderTab = (key: TypeKey, props: TabProps = {}) =>
  render(buildTree(key, props));

/** Per-type visit-side rows returned by getEncounterLinks. */
let linkRows: Record<string, unknown[]>;

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
  linkRows = {};
  api.getEncounterLinks.mockImplementation(
    (_visitId: number, linkType: string) =>
      Promise.resolve(linkRows[linkType] ?? [])
  );
  api.createEncounterLinksBulk.mockResolvedValue([]);
  api.updateEncounterLink.mockResolvedValue({});
  api.deleteEncounterLink.mockResolvedValue({});
  api.getPatientProcedures.mockResolvedValue(candidates.procedures);
  api.getPatientLabResults.mockResolvedValue(candidates.labResults);
  api.getPatientTreatments.mockResolvedValue([]);
  api.getPatientInjuries.mockResolvedValue([]);
  api.getPatientConditions.mockResolvedValue([]);
  api.getPatientMedications.mockResolvedValue([]);
  api.getSymptoms.mockResolvedValue([]);
});

/** Open the Link modal in the open tab and choose a record by its label. */
async function linkRecord(optionLabel: string) {
  // The tab bar's "Link" menu (add mode) has the same name; it is the one with a popup
  const linkButton = (
    await screen.findAllByRole('button', { name: I18N.link })
  ).find(button => !button.hasAttribute('aria-haspopup'))!;
  await waitFor(() => expect(linkButton).toBeEnabled());
  await userEvent.click(linkButton);
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByPlaceholderText(I18N.placeholder));
  await userEvent.click(
    await screen.findByRole('option', { name: optionLabel, hidden: true })
  );
  return dialog;
}

/** Open the tab bar's "Link" menu (add mode). */
async function openLinkMenu() {
  const menuButton = screen
    .getAllByRole('button', { name: I18N.link })
    .find(button => button.hasAttribute('aria-haspopup'))!;
  await userEvent.click(menuButton);
}

describe('VisitLinkTabButtons', () => {
  it('editing a saved visit shows a tab for every linked record type, and no Link menu', async () => {
    renderTab('procedures', { visitId: VISIT_ID, patientId: PATIENT_ID });
    await screen.findByRole('tab', {
      name: 'shared:categories.lab_results (0)',
    });
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'shared:categories.procedures (0)',
      'shared:categories.treatments (0)',
      'shared:categories.injuries (0)',
      'shared:categories.symptoms (0)',
      'shared:categories.conditions (0)',
      'shared:categories.medications (0)',
      'shared:categories.lab_results (0)',
    ]);
    expect(screen.queryByRole('tab', { name: /elationships/ })).toBeNull();
    // Opening the panel's own Link button is separate; there is no tab-bar menu
    expect(
      screen
        .getAllByRole('button', { name: I18N.link })
        .some(button => button.hasAttribute('aria-haspopup'))
    ).toBe(false);
  });

  it('view mode shows only the types that have links, and no Link menu', async () => {
    linkRows = {
      procedures: [procedureLink],
      'lab-results': [labResultLink],
    };
    renderTab('procedures', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      isViewMode: true,
    });
    await screen.findByRole('tab', {
      name: 'shared:categories.procedures (1)',
    });
    await screen.findByRole('tab', {
      name: 'shared:categories.lab_results (1)',
    });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: I18N.link })).toBeNull();
  });

  it('view mode shows no link tabs for a visit without links', async () => {
    renderTab('procedures', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      isViewMode: true,
    });
    await waitFor(() => expect(api.getEncounterLinks).toHaveBeenCalled());
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('add mode starts with no link tabs and a Link menu listing every type', async () => {
    renderTab('procedures');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);

    await openLinkMenu();
    const items = await screen.findAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual([
      'shared:categories.procedures',
      'shared:categories.treatments',
      'shared:categories.injuries',
      'shared:categories.symptoms',
      'shared:categories.conditions',
      'shared:categories.medications',
      'shared:categories.lab_results',
    ]);
  });

  it('add mode: choosing a type from the menu shows its tab and opens it', async () => {
    const onSelectTab = vi.fn();
    renderTab('conditions', { onSelectTab });
    await openLinkMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: 'shared:categories.injuries',
      })
    );

    expect(onSelectTab).toHaveBeenCalledWith('link-injuries');
    expect(
      screen.getByRole('tab', { name: 'shared:categories.injuries (0)' })
    ).toBeInTheDocument();
  });

  it('add mode: a type that already has links is not offered in the Link menu', async () => {
    renderTab('procedures', {
      pendingLinks: {
        injuries: [{ entityId: 1, relevanceNote: null, purpose: null }],
      },
    });
    await openLinkMenu();
    const names = (await screen.findAllByRole('menuitem')).map(
      item => item.textContent
    );
    expect(names).toHaveLength(6);
    expect(names).not.toContain('shared:categories.injuries');
  });

  it('add mode counts the links chosen in the form and shows only those tabs', () => {
    renderTab('procedures', {
      pendingLinks: {
        procedures: [
          { entityId: 1, relevanceNote: null, purpose: null },
          { entityId: 2, relevanceNote: null, purpose: null },
        ],
        labResults: [
          { entityId: 9, relevanceNote: null, purpose: 'reference' },
        ],
      },
    });
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'shared:categories.procedures (2)',
      'shared:categories.lab_results (1)',
    ]);
    expect(screen.queryByRole('tab', { name: /injuries/ })).toBeNull();
  });

  it('add mode keeps a tab once shown, even after its last pending link is removed', () => {
    const withLink: PendingLinks = {
      procedures: [{ entityId: 1, relevanceNote: null, purpose: null }],
    };
    const { rerender } = renderTab('procedures', { pendingLinks: withLink });
    expect(
      screen.getByRole('tab', { name: 'shared:categories.procedures (1)' })
    ).toBeInTheDocument();

    rerender(buildTree('procedures', { pendingLinks: { procedures: [] } }));
    expect(
      screen.getByRole('tab', { name: 'shared:categories.procedures (0)' })
    ).toBeInTheDocument();
  });

  it('shows the number of saved links on every tab without opening them', async () => {
    linkRows = {
      procedures: [procedureLink, { ...procedureLink, id: 12, entity_id: 4 }],
      'lab-results': [labResultLink],
    };
    renderTab('conditions', { visitId: VISIT_ID, patientId: PATIENT_ID });

    // Not loaded yet: just the name, no number
    expect(
      screen.getByRole('tab', { name: 'shared:categories.procedures' })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', {
        name: 'shared:categories.procedures (2)',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'shared:categories.lab_results (1)' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'shared:categories.treatments (0)' })
    ).toBeInTheDocument();
    // One request per type, all up front; the open tab loads its own list as well
    const types = api.getEncounterLinks.mock.calls.map(c => c[1]);
    expect(new Set(types).size).toBe(7);
  });

  it("keeps a tab's number current when links are added or removed in it", async () => {
    linkRows = { procedures: [procedureLink] };
    renderTab('procedures', { visitId: VISIT_ID, patientId: PATIENT_ID });
    await screen.findByRole('tab', {
      name: 'shared:categories.procedures (1)',
    });

    // The list is reloaded after the removal and now has no links
    linkRows = { procedures: [] };
    await userEvent.click(screen.getByLabelText(I18N.removeLink));
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'shared:categories.procedures (0)' })
      ).toBeInTheDocument()
    );
  });

  it('leaves a tab without a number when its count cannot be loaded', async () => {
    api.getEncounterLinks.mockImplementation((_id: number, type: string) =>
      type === 'injuries'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve([])
    );
    renderTab('conditions', { visitId: VISIT_ID, patientId: PATIENT_ID });
    await screen.findByRole('tab', {
      name: 'shared:categories.procedures (0)',
    });
    expect(
      screen.getByRole('tab', { name: 'shared:categories.injuries' })
    ).toBeInTheDocument();
  });
});

describe('VisitLinkTabPanels - loading', () => {
  it('loads the record lists of the open tab only, not of the other types', async () => {
    renderTab('procedures', { visitId: VISIT_ID, patientId: PATIENT_ID });
    await waitFor(() => expect(api.getPatientProcedures).toHaveBeenCalled());
    // The numbers on the tabs are counted up front (one list per type)...
    await waitFor(() =>
      expect(
        new Set(api.getEncounterLinks.mock.calls.map(c => c[1])).size
      ).toBe(7)
    );
    // ...but the records you could link are only fetched for the tab that is open
    expect(api.getPatientLabResults).not.toHaveBeenCalled();
    expect(api.getPatientTreatments).not.toHaveBeenCalled();
  });
});

describe('VisitLinkTabPanels - view mode', () => {
  it('shows saved links read-only', async () => {
    linkRows = { procedures: [procedureLink] };
    renderTab('procedures', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      isViewMode: true,
    });

    expect(await screen.findByText('Knee arthroscopy')).toBeInTheDocument();
    expect(screen.getByText('Performed during visit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: I18N.link })).toBeNull();
    expect(screen.queryByLabelText(I18N.editLink)).toBeNull();
    expect(screen.queryByLabelText(I18N.removeLink)).toBeNull();
    // Nothing can be added, so the record list is never fetched
    expect(api.getPatientProcedures).not.toHaveBeenCalled();
  });

  it('shows the lab result purpose', async () => {
    linkRows = { 'lab-results': [labResultLink] };
    renderTab('labResults', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      isViewMode: true,
    });
    expect(await screen.findByText('Complete Blood Count')).toBeInTheDocument();
    expect(screen.getByText('Results Reviewed')).toBeInTheDocument();
  });

  it('shows an empty card when nothing is linked', async () => {
    renderTab('procedures', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      isViewMode: true,
    });
    expect(await screen.findByText(I18N.none)).toBeInTheDocument();
  });

  it('navigates to the linked record when its name is clicked', async () => {
    linkRows = { procedures: [procedureLink] };
    const navigate = vi.fn();
    renderTab('procedures', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      isViewMode: true,
      navigate,
    });
    await userEvent.click(await screen.findByText('Knee arthroscopy'));
    expect(navigateToEntity).toHaveBeenCalledWith('procedure', 3, navigate);
  });
});

describe('VisitLinkTabPanels - linked item lozenge', () => {
  it('shows the linked item as a badge in View mode, like the Treatment dialogs', async () => {
    linkRows = { procedures: [procedureLink] };
    renderTab('procedures', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      isViewMode: true,
      navigate: vi.fn(),
    });
    const name = await screen.findByText('Knee arthroscopy');
    expect(name.closest('.mantine-Badge-root')).not.toBeNull();
    expect(name.closest('.mantine-Badge-root')).toHaveStyle({
      cursor: 'pointer',
    });
  });

  it('shows the same badge in Edit mode but does not navigate away from the form', async () => {
    linkRows = { procedures: [procedureLink] };
    const navigate = vi.fn();
    renderTab('procedures', {
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      navigate,
    });
    const name = await screen.findByText('Knee arthroscopy');
    expect(name.closest('.mantine-Badge-root')).not.toBeNull();

    await userEvent.click(name);
    expect(navigateToEntity).not.toHaveBeenCalled();
  });
});

describe('VisitLinkTabPanels - add mode (visit not saved yet)', () => {
  it('holds links as pending and makes no link API calls', async () => {
    const onPendingChange = vi.fn();
    renderTab('procedures', {
      patientId: PATIENT_ID,
      pendingLinks: {},
      onPendingChange,
    });

    // No note about links being saved later: they are shown as chosen
    expect(screen.queryByText(/saveFirstInfo/)).toBeNull();
    const dialog = await linkRecord('Appendectomy (2025-05-02, completed)');
    await userEvent.type(
      within(dialog).getByLabelText(I18N.noteLabel),
      'before surgery'
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );

    await waitFor(() =>
      expect(onPendingChange).toHaveBeenCalledWith({
        procedures: [
          { entityId: 4, relevanceNote: 'before surgery', purpose: null },
        ],
      })
    );
    expect(api.getEncounterLinks).not.toHaveBeenCalled();
    expect(api.createEncounterLinksBulk).not.toHaveBeenCalled();
  });

  it('keeps links of other types when one tab changes', async () => {
    const onPendingChange = vi.fn();
    renderTab('procedures', {
      patientId: PATIENT_ID,
      pendingLinks: {
        labResults: [
          { entityId: 9, relevanceNote: null, purpose: 'reference' },
        ],
      },
      onPendingChange,
    });
    const dialog = await linkRecord('Appendectomy (2025-05-02, completed)');
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );
    await waitFor(() =>
      expect(onPendingChange).toHaveBeenCalledWith({
        labResults: [
          { entityId: 9, relevanceNote: null, purpose: 'reference' },
        ],
        procedures: [{ entityId: 4, relevanceNote: null, purpose: null }],
      })
    );
  });

  it('lists pending links by label and removes one without calling the API', async () => {
    const onPendingChange = vi.fn();
    renderTab('procedures', {
      patientId: PATIENT_ID,
      pendingLinks: {
        procedures: [{ entityId: 4, relevanceNote: 'planned', purpose: null }],
      },
      onPendingChange,
    });

    expect(
      await screen.findByText('Appendectomy (2025-05-02, completed)')
    ).toBeInTheDocument();
    expect(screen.getByText('planned')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(I18N.removeLink));
    expect(onPendingChange).toHaveBeenCalledWith({ procedures: [] });
    expect(api.deleteEncounterLink).not.toHaveBeenCalled();
  });

  it('does not submit an enclosing form when buttons are clicked', async () => {
    const onSubmit = vi.fn(e => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Tabs value={tabValue('procedures')}>
          <VisitLinkTabPanels
            activeTab={tabValue('procedures')}
            patientId={PATIENT_ID}
            pendingLinks={{
              procedures: [{ entityId: 4, relevanceNote: null, purpose: null }],
            }}
            onPendingChange={vi.fn()}
          />
        </Tabs>
      </form>
    );
    await userEvent.click(await screen.findByLabelText(I18N.editLink));
    await userEvent.click(screen.getByLabelText(I18N.save));
    await userEvent.click(
      await screen.findByRole('button', { name: I18N.link })
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('VisitLinkTabPanels - edit mode (saved visit)', () => {
  const edit = (key: TypeKey = 'procedures') =>
    renderTab(key, { visitId: VISIT_ID, patientId: PATIENT_ID });

  it('creates a generic link with entity_ids and the note', async () => {
    edit();
    const dialog = await linkRecord('Knee arthroscopy (2026-01-10, completed)');
    await userEvent.type(
      within(dialog).getByLabelText(I18N.noteLabel),
      '  seen today '
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );

    await waitFor(() =>
      expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
        VISIT_ID,
        'procedures',
        { entity_ids: [3], relevance_note: 'seen today' }
      )
    );
    await waitFor(() =>
      expect(api.getEncounterLinks.mock.calls.length).toBeGreaterThanOrEqual(2)
    );
  });

  it('does not offer records that are already linked', async () => {
    linkRows = { procedures: [procedureLink] };
    edit();
    await screen.findByText('Knee arthroscopy');
    await userEvent.click(
      await screen.findByRole('button', { name: I18N.link })
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByPlaceholderText(I18N.placeholder)
    );
    expect(
      await screen.findByRole('option', {
        name: 'Appendectomy (2025-05-02, completed)',
        hidden: true,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {
        name: 'Knee arthroscopy (2026-01-10, completed)',
        hidden: true,
      })
    ).toBeNull();
  });

  it('updates only the note for a generic link', async () => {
    linkRows = { procedures: [procedureLink] };
    edit();
    await screen.findByText('Knee arthroscopy');
    await userEvent.click(screen.getByLabelText(I18N.editLink));
    const note = screen.getByPlaceholderText(I18N.notePlaceholder);
    await userEvent.clear(note);
    await userEvent.type(note, 'updated note');
    await userEvent.click(screen.getByLabelText(I18N.save));
    await waitFor(() =>
      expect(api.updateEncounterLink).toHaveBeenCalledWith(
        VISIT_ID,
        'procedures',
        11,
        { relevance_note: 'updated note' }
      )
    );
  });

  it('removes a link after confirmation and keeps it when declined', async () => {
    linkRows = { procedures: [procedureLink] };
    edit();
    await screen.findByText('Knee arthroscopy');

    window.confirm = vi.fn(() => false);
    await userEvent.click(screen.getByLabelText(I18N.removeLink));
    expect(api.deleteEncounterLink).not.toHaveBeenCalled();

    window.confirm = vi.fn(() => true);
    await userEvent.click(screen.getByLabelText(I18N.removeLink));
    await waitFor(() =>
      expect(api.deleteEncounterLink).toHaveBeenCalledWith(
        VISIT_ID,
        'procedures',
        11
      )
    );
  });

  it('shows the API error and keeps the dialog open when linking fails', async () => {
    api.createEncounterLinksBulk.mockRejectedValue(new Error('Already linked'));
    edit();
    const dialog = await linkRecord('Appendectomy (2025-05-02, completed)');
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );
    expect(await screen.findByText('Already linked')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('links a lab result with its purpose using the lab result body', async () => {
    edit('labResults');
    const dialog = await linkRecord('Lipid Panel (2026-02-03, completed)');
    await userEvent.click(
      within(dialog).getByRole('textbox', { name: I18N.purpose })
    );
    await userEvent.click(
      await screen.findByRole('option', {
        name: 'Ordered During Visit',
        hidden: true,
      })
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );
    await waitFor(() =>
      expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
        VISIT_ID,
        'lab-results',
        {
          lab_result_ids: [10],
          relevance_note: null,
          purpose: 'ordered_during',
        }
      )
    );
  });

  it('shows and updates the purpose of a saved lab result link', async () => {
    linkRows = { 'lab-results': [labResultLink] };
    edit('labResults');
    expect(await screen.findByText('Complete Blood Count')).toBeInTheDocument();
    expect(screen.getByText('Results Reviewed')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(I18N.editLink));
    await userEvent.click(screen.getByRole('textbox', { name: I18N.purpose }));
    await userEvent.click(
      await screen.findByRole('option', { name: 'Reference', hidden: true })
    );
    await userEvent.click(screen.getByLabelText(I18N.save));
    await waitFor(() =>
      expect(api.updateEncounterLink).toHaveBeenCalledWith(
        VISIT_ID,
        'lab-results',
        21,
        { relevance_note: null, purpose: 'reference' }
      )
    );
  });
});
