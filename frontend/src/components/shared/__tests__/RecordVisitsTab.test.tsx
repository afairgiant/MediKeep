import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor, within } from '../../../test-utils/render';
import RecordVisitsTab from '../RecordVisitsTab';

const api = vi.hoisted(() => ({
  getRecordEncounterLinks: vi.fn(),
  createRecordEncounterLinksBulk: vi.fn(),
  updateRecordEncounterLink: vi.fn(),
  deleteRecordEncounterLink: vi.fn(),
  getPatientEncounters: vi.fn(),
}));

vi.mock('../../../services/api', () => ({ apiService: api }));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

import { navigateToEntity } from '../../../utils/linkNavigation';

Element.prototype.scrollIntoView = vi.fn();

const RECORD_ID = 31;
const PATIENT_ID = 7;

const I18N = {
  link: 'common:buttons.link',
  linkSelected: 'common:visits.relationships.linkSelected',
  none: 'common:visits.relationships.none',
  saveFirst: 'common:recordRelationships.saveFirstInfo',
  placeholder: 'common:visits.relationships.selectPlaceholder',
  editLink: 'common:visits.relationships.editLink',
  removeLink: 'common:visits.relationships.removeLink',
  save: 'common:buttons.save',
  notePlaceholder: 'common:modals.relevanceNoteOptional',
  noteLabel: 'common:modals.relevanceNote',
  visits: 'shared:tabs.visits',
};

/** Real record-side response shape: encounter_* describe the visit. */
const savedLink = {
  id: 77,
  encounter_id: 5,
  entity_id: RECORD_ID,
  relevance_note: 'Discussed at visit',
  entity_name: 'Knee arthroscopy',
  entity_date: '2026-01-10',
  entity_status: 'completed',
  encounter_reason: 'Annual checkup',
  encounter_date: '2026-03-01',
};

const visits = [
  {
    id: 5,
    reason: 'Annual checkup',
    date: '2026-03-01',
    visit_type: 'routine',
  },
  { id: 6, reason: 'Follow-up', date: '2026-04-02', visit_type: null },
];

let savedRows: unknown[];

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
  savedRows = [];
  api.getRecordEncounterLinks.mockImplementation(() =>
    Promise.resolve(savedRows)
  );
  api.createRecordEncounterLinksBulk.mockResolvedValue([]);
  api.updateRecordEncounterLink.mockResolvedValue({});
  api.deleteRecordEncounterLink.mockResolvedValue({});
  api.getPatientEncounters.mockResolvedValue(visits);
});

async function linkVisit(optionLabel: string) {
  const section = screen.getByText(I18N.visits).closest('.mantine-Paper-root');
  const linkButton = await within(section as HTMLElement).findByRole('button', {
    name: I18N.link,
  });
  await waitFor(() => expect(linkButton).toBeEnabled());
  await userEvent.click(linkButton);
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByPlaceholderText(I18N.placeholder));
  await userEvent.click(
    await screen.findByRole('option', { name: optionLabel, hidden: true })
  );
  return dialog;
}

describe('RecordVisitsTab - view mode', () => {
  it('lists the linked visits read-only and navigates to the visit', async () => {
    savedRows = [savedLink];
    const navigate = vi.fn();
    render(
      <RecordVisitsTab
        recordType="procedures"
        recordId={RECORD_ID}
        patientId={PATIENT_ID}
        isViewMode
        navigate={navigate}
      />
    );

    const name = await screen.findByText('Annual checkup');
    expect(screen.getByText('Discussed at visit')).toBeInTheDocument();
    expect(api.getRecordEncounterLinks).toHaveBeenCalledWith(
      'procedures',
      RECORD_ID,
      expect.anything()
    );

    expect(screen.queryByRole('button', { name: I18N.link })).toBeNull();
    expect(screen.queryByLabelText(I18N.editLink)).toBeNull();
    expect(screen.queryByLabelText(I18N.removeLink)).toBeNull();
    expect(api.getPatientEncounters).not.toHaveBeenCalled();

    await userEvent.click(name);
    expect(navigateToEntity).toHaveBeenCalledWith('encounter', 5, navigate);
  });

  it('shows an empty message when no visits are linked', async () => {
    render(
      <RecordVisitsTab
        recordType="conditions"
        recordId={RECORD_ID}
        isViewMode
      />
    );
    expect(await screen.findByText(I18N.none)).toBeInTheDocument();
  });
});

describe('RecordVisitsTab - add mode (record not saved yet)', () => {
  it('holds visits as pending and makes no link API calls', async () => {
    const onPendingChange = vi.fn();
    render(
      <RecordVisitsTab
        recordType="injuries"
        patientId={PATIENT_ID}
        pendingLinks={[]}
        onPendingChange={onPendingChange}
      />
    );

    expect(screen.getByText(I18N.saveFirst)).toBeInTheDocument();
    const dialog = await linkVisit('Annual checkup (2026-03-01, routine)');
    await userEvent.type(
      within(dialog).getByLabelText(I18N.noteLabel),
      'raised at visit'
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );

    await waitFor(() =>
      expect(onPendingChange).toHaveBeenCalledWith([
        { entityId: 5, relevanceNote: 'raised at visit', purpose: null },
      ])
    );
    expect(api.getRecordEncounterLinks).not.toHaveBeenCalled();
    expect(api.createRecordEncounterLinksBulk).not.toHaveBeenCalled();
  });

  it('lists pending visits by label and removes one without calling the API', async () => {
    const onPendingChange = vi.fn();
    render(
      <RecordVisitsTab
        recordType="symptoms"
        patientId={PATIENT_ID}
        pendingLinks={[
          { entityId: 6, relevanceNote: 'planned', purpose: null },
        ]}
        onPendingChange={onPendingChange}
      />
    );

    expect(
      await screen.findByText('Follow-up (2026-04-02)')
    ).toBeInTheDocument();
    expect(screen.getByText('planned')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(I18N.removeLink));
    expect(onPendingChange).toHaveBeenCalledWith([]);
    expect(api.deleteRecordEncounterLink).not.toHaveBeenCalled();
  });
});

describe('RecordVisitsTab - edit mode (saved record)', () => {
  const renderEdit = (
    recordType: 'medications' | 'procedures' = 'procedures'
  ) =>
    render(
      <RecordVisitsTab
        recordType={recordType}
        recordId={RECORD_ID}
        patientId={PATIENT_ID}
      />
    );

  it('creates a link with encounter_ids and the note on the record route', async () => {
    renderEdit('medications');
    const dialog = await linkVisit('Follow-up (2026-04-02)');
    await userEvent.type(
      within(dialog).getByLabelText(I18N.noteLabel),
      ' started here '
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );

    await waitFor(() =>
      expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledWith(
        'medications',
        RECORD_ID,
        { encounter_ids: [6], relevance_note: 'started here' }
      )
    );
  });

  it('does not offer visits that are already linked', async () => {
    savedRows = [savedLink];
    renderEdit();
    await screen.findByText('Annual checkup');

    await userEvent.click(
      await screen.findByRole('button', { name: I18N.link })
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByPlaceholderText(I18N.placeholder)
    );
    expect(
      await screen.findByRole('option', {
        name: 'Follow-up (2026-04-02)',
        hidden: true,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {
        name: 'Annual checkup (2026-03-01, routine)',
        hidden: true,
      })
    ).toBeNull();
  });

  it('updates only the note', async () => {
    savedRows = [savedLink];
    renderEdit();
    await screen.findByText('Annual checkup');

    await userEvent.click(screen.getByLabelText(I18N.editLink));
    const note = screen.getByPlaceholderText(I18N.notePlaceholder);
    await userEvent.clear(note);
    await userEvent.type(note, 'new note');
    await userEvent.click(screen.getByLabelText(I18N.save));

    await waitFor(() =>
      expect(api.updateRecordEncounterLink).toHaveBeenCalledWith(
        'procedures',
        RECORD_ID,
        77,
        { relevance_note: 'new note' }
      )
    );
  });

  it('removes a link after confirmation and keeps it when declined', async () => {
    savedRows = [savedLink];
    renderEdit();
    await screen.findByText('Annual checkup');

    window.confirm = vi.fn(() => false);
    await userEvent.click(screen.getByLabelText(I18N.removeLink));
    expect(api.deleteRecordEncounterLink).not.toHaveBeenCalled();

    window.confirm = vi.fn(() => true);
    await userEvent.click(screen.getByLabelText(I18N.removeLink));
    await waitFor(() =>
      expect(api.deleteRecordEncounterLink).toHaveBeenCalledWith(
        'procedures',
        RECORD_ID,
        77
      )
    );
  });

  it('shows the API error when linking fails', async () => {
    api.createRecordEncounterLinksBulk.mockRejectedValue(
      new Error('Already linked')
    );
    renderEdit();
    const dialog = await linkVisit('Follow-up (2026-04-02)');
    await userEvent.click(
      within(dialog).getByRole('button', { name: I18N.linkSelected })
    );
    expect(await screen.findByText('Already linked')).toBeInTheDocument();
  });
});
