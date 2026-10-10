import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor, within } from '../../../test-utils/render';
import MantineVisitForm from '../../medical/MantineVisitForm';
import ProcedureCreateDialog from '../ProcedureCreateDialog';
import ProcedureFormWrapper from '../../medical/procedures/ProcedureFormWrapper';
import { INITIAL_PROCEDURE_FORM_DATA } from '../../../utils/procedureFormUtils';
import { InlineCreateProvider } from '../../../contexts/InlineCreateContext';
import {
  SUB_DIALOG_Z_INDEX,
  SubDialogContext,
} from '../../../contexts/SubDialogContext';

/** A link tab's name, with or without its "(n)" count. */
const withCount = (name: string) =>
  new RegExp(`^${name.replace(/\./g, '\\.')}( \\(\\d+\\))?$`);

const api = vi.hoisted(() => ({
  createProcedure: vi.fn(),
  createEncounterLinksBulk: vi.fn(),
  getEncounterLinks: vi.fn(),
  getPatientProcedures: vi.fn(),
  getPatientTreatments: vi.fn(),
  getPatientInjuries: vi.fn(),
  getPatientConditions: vi.fn(),
  getPatientMedications: vi.fn(),
  getPatientLabResults: vi.fn(),
  getSymptoms: vi.fn(),
  createSymptom: vi.fn(),
  createInjury: vi.fn(),
  createCondition: vi.fn(),
  createMedication: vi.fn(),
  createTreatment: vi.fn(),
  createLabResult: vi.fn(),
  getInjuryTypes: vi.fn(),
  createEncounter: vi.fn(),
  getRecordEncounterLinks: vi.fn(),
  createRecordEncounterLinksBulk: vi.fn(),
  getPatientEncounters: vi.fn(),
}));
const docs = vi.hoisted(() => ({
  mounted: vi.fn(),
  unmounted: vi.fn(),
  uploadProcedureFiles: vi.fn(),
  uploadVisitFiles: vi.fn(),
}));

vi.mock('../../../services/api', () => ({ apiService: api }));
vi.mock('../../../services/api/symptomApi', () => ({
  symptomApi: { getAll: api.getSymptoms, create: api.createSymptom },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({ canCreate: true, isViewOnly: false }),
}));
vi.mock('../../../hooks/useGlobalData', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../hooks/useGlobalData')>()),
  usePractitioners: () => ({ practitioners: [] }),
  usePharmacies: () => ({ pharmacies: [] }),
}));
vi.mock('../../../hooks/useTestNameAutocomplete', () => ({
  useTestNameAutocomplete: ({
    onFieldsChange,
  }: {
    onFieldsChange: (_f: { test_name: string }) => void;
  }) => ({
    nameOptions: [],
    handleChange: (value: string) => onFieldsChange({ test_name: value }),
    handleOptionSubmit: vi.fn(),
    handleClear: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock('../../../utils/labTestComponentUtils', () => ({
  submitPendingTestComponents: vi.fn().mockResolvedValue(undefined),
}));
// Stands in for the test-result rows: one pending result, as if the user had entered it
vi.mock('../../medical/labresults/InlineTestComponentEntry', async () => {
  const { useEffect } = await import('react');
  const InlineTestComponentEntryMock = ({
    onRef,
  }: {
    onRef: (_m: unknown) => void;
  }) => {
    useEffect(() => {
      onRef({
        hasPendingComponents: () => true,
        getPendingComponents: () => [{ test_name: 'Glucose', value: 5 }],
        clearComponents: vi.fn(),
      });
      return () => onRef(null);
    }, [onRef]);
    return <div />;
  };
  return { default: InlineTestComponentEntryMock };
});
vi.mock('../../medical/treatments/TreatmentPlanSetup', () => ({
  default: () => <div data-testid="treatment-plan-setup" />,
}));
vi.mock('../../medical/practitioners/PractitionerSelectWithCreate', () => ({
  default: () => <div data-testid="practitioner-select" />,
}));
vi.mock('../../common/TagInput', () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));
// A simple date field stands in for Mantine's DateInput
vi.mock('../../adapters/DateInput', () => ({
  DateInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | null;
    onChange: (_d: Date | null) => void;
  }) => (
    <input
      aria-label={label}
      type="date"
      value={value instanceof Date ? value.toISOString().slice(0, 10) : ''}
      onChange={e =>
        onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)
      }
    />
  ),
}));
// Stands in for the file manager: reports staged files and records mounts/unmounts
vi.mock('../../shared/DocumentManagerWithProgress', () => {
  function MockDocumentManager({
    entityType,
    onUploadPendingFiles,
  }: {
    entityType: string;
    onUploadPendingFiles?: (_methods: unknown) => void;
  }) {
    useEffect(() => {
      docs.mounted(entityType);
      onUploadPendingFiles?.({
        hasPendingFiles: () => true,
        uploadPendingFiles:
          entityType === 'procedure'
            ? docs.uploadProcedureFiles
            : docs.uploadVisitFiles,
      });
      return () => docs.unmounted(entityType);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid={`docs-${entityType}`} />;
  }

  return { default: MockDocumentManager };
});

Element.prototype.scrollIntoView = vi.fn();

// These render real forms and type into them, which takes a few seconds
vi.setConfig({ testTimeout: 30000 });

const VisitForm = MantineVisitForm as unknown as ComponentType<
  Record<string, unknown>
>;

const PATIENT_ID = 7;
const NEW_PROCEDURE = {
  id: 501,
  procedure_name: 'Knee scope',
  date: '2026-01-15',
  status: 'scheduled',
};

const parentSubmit = vi.fn(e => e.preventDefault());
const parentClose = vi.fn();

const baseVisit = {
  reason: 'Annual checkup',
  date: '2026-03-01',
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
};

/** A Visit dialog whose form state lives in the parent, like the Visits page. */
const ParentVisit = ({
  editing,
  onFormData,
}: {
  editing: boolean;
  onFormData?: (_f: typeof baseVisit) => void;
}) => {
  const [formData, setFormData] = useState(baseVisit);
  useEffect(() => onFormData?.(formData), [formData, onFormData]);
  return (
    <VisitForm
      isOpen
      onClose={parentClose}
      title="Visit"
      formData={formData}
      onInputChange={(e: { target: { name: string; value: unknown } }) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
      }
      onSubmit={parentSubmit}
      practitioners={[]}
      conditionsOptions={[]}
      editingVisit={editing ? { id: 55 } : null}
      patientId={PATIENT_ID}
      navigate={vi.fn()}
      onDocumentManagerRef={vi.fn()}
    />
  );
};

const renderWithHost = (editing: boolean, onFormData?: (_f: unknown) => void) =>
  render(
    <InlineCreateProvider>
      <ParentVisit editing={editing} onFormData={onFormData} />
    </InlineCreateProvider>
  );

/**
 * Open a link tab. An unsaved Add Visit only shows tabs for types that already have
 * links, so the others are reached through the tab bar's "Link" menu.
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

const openProceduresTab = () => openLinkTab('shared:categories.procedures');

const fillAndSubmitSubDialog = async (
  user: ReturnType<typeof userEvent.setup>
) => {
  const dialog = await screen.findByRole('dialog', { name: 'Add Procedure' });
  await user.type(
    within(dialog).getByLabelText(/Procedure Name/),
    'Knee scope'
  );
  await user.type(
    within(dialog).getByLabelText(/Procedure Date/),
    '2026-01-15'
  );
  await user.click(
    within(dialog).getByRole('button', { name: 'Create Procedure' })
  );
  return dialog;
};

beforeEach(() => {
  vi.clearAllMocks();
  api.createProcedure.mockResolvedValue(NEW_PROCEDURE);
  api.createEncounterLinksBulk.mockResolvedValue([]);
  api.getEncounterLinks.mockResolvedValue([]);
  api.getPatientProcedures.mockResolvedValue([]);
  api.getPatientTreatments.mockResolvedValue([]);
  api.getPatientInjuries.mockResolvedValue([]);
  api.getPatientConditions.mockResolvedValue([]);
  api.getPatientMedications.mockResolvedValue([]);
  api.getPatientLabResults.mockResolvedValue([]);
  api.getSymptoms.mockResolvedValue([]);
  api.getInjuryTypes.mockResolvedValue([]);
  api.getRecordEncounterLinks.mockResolvedValue([]);
  api.getPatientEncounters.mockResolvedValue([]);
  api.createRecordEncounterLinksBulk.mockResolvedValue([]);
  docs.uploadProcedureFiles.mockResolvedValue(undefined);
});

describe('Add Procedure from an open Visit (saved visit)', () => {
  it('creates and links the procedure without disturbing the Visit dialog', async () => {
    renderWithHost(true);
    const user = userEvent.setup();

    // Unsaved edits in the Visit
    const reason = screen.getByDisplayValue('Annual checkup');
    await user.type(reason, ' - follow up');
    expect(reason).toHaveValue('Annual checkup - follow up');
    expect(docs.mounted).toHaveBeenCalledWith('visit');

    await openProceduresTab();
    // After the link, the tab reloads and now lists the new procedure
    api.getEncounterLinks.mockResolvedValue([
      {
        id: 9,
        encounter_id: 55,
        entity_id: 501,
        entity_name: 'Knee scope',
        entity_date: '2026-01-15',
        entity_status: 'scheduled',
        relevance_note: null,
      },
    ]);
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );

    const sub = await screen.findByRole('dialog', { name: 'Add Procedure' });
    // One level deep: the sub-dialog has none of the link tabs
    expect(within(sub).queryByRole('tab', { name: 'Visits' })).toBeNull();
    expect(
      within(sub).getByRole('tab', { name: /Basic Info/ })
    ).toBeInTheDocument();
    expect(
      within(sub).getByRole('tab', { name: /Documents|Add Files/ })
    ).toBeInTheDocument();

    await fillAndSubmitSubDialog(user);

    await waitFor(() =>
      expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
        55,
        'procedures',
        { entity_ids: [501], relevance_note: null }
      )
    );
    // Created for the Visit's patient, with the typed values
    expect(api.createProcedure).toHaveBeenCalledTimes(1);
    expect(api.createProcedure.mock.calls[0][0]).toMatchObject({
      procedure_name: 'Knee scope',
      date: '2026-01-15',
      patient_id: PATIENT_ID,
    });
    // Files staged in the sub-dialog are uploaded for the new record
    await waitFor(() =>
      expect(docs.uploadProcedureFiles).toHaveBeenCalledWith(501)
    );

    // Sub-dialog closed; back on the Procedures tab showing the linked procedure
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add Procedure' })).toBeNull()
    );
    expect(
      screen.getByRole('tab', {
        name: withCount('shared:categories.procedures'),
      })
    ).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Knee scope')).toBeInTheDocument();

    // The Visit was never submitted or closed, and nothing in it was lost
    expect(parentSubmit).not.toHaveBeenCalled();
    expect(parentClose).not.toHaveBeenCalled();
    expect(
      screen.getByDisplayValue('Annual checkup - follow up')
    ).toBeInTheDocument();
    expect(docs.unmounted).not.toHaveBeenCalledWith('visit');
    expect(docs.uploadVisitFiles).not.toHaveBeenCalled();
  });

  it('Escape inside the sub-dialog closes only the sub-dialog', async () => {
    renderWithHost(true);
    const user = await openProceduresTab();
    await user.type(screen.getByDisplayValue('Annual checkup'), '!');
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );
    const sub = await screen.findByRole('dialog', { name: 'Add Procedure' });
    await user.type(within(sub).getByLabelText(/Procedure Name/), 'half typed');

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add Procedure' })).toBeNull()
    );
    expect(parentClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Annual checkup!')).toBeInTheDocument();
    expect(api.createProcedure).not.toHaveBeenCalled();
  });

  it('keeps the sub-dialog and everything typed when the create fails', async () => {
    api.createProcedure.mockRejectedValue(new Error('server error'));
    renderWithHost(true);
    const user = await openProceduresTab();
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );
    await fillAndSubmitSubDialog(user);

    await waitFor(() => expect(api.createProcedure).toHaveBeenCalled());
    const sub = screen.getByRole('dialog', { name: 'Add Procedure' });
    expect(within(sub).getByLabelText(/Procedure Name/)).toHaveValue(
      'Knee scope'
    );
    expect(api.createEncounterLinksBulk).not.toHaveBeenCalled();
    expect(docs.uploadProcedureFiles).not.toHaveBeenCalled();
    expect(parentSubmit).not.toHaveBeenCalled();
  });

  it('shows a missing-date message inside the dialog and creates nothing', async () => {
    renderWithHost(true);
    const user = await openProceduresTab();
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );
    const sub = await screen.findByRole('dialog', { name: 'Add Procedure' });
    // A name but no date: the case that used to look like "nothing happened"
    await user.type(within(sub).getByLabelText(/Procedure Name/), 'Knee scope');
    await user.click(
      within(sub).getByRole('button', { name: 'Create Procedure' })
    );

    // The message is in the dialog itself, not only in a toast that could hide behind it
    expect(await within(sub).findByRole('alert')).toHaveTextContent(
      'Please enter a valid date.'
    );
    expect(api.createProcedure).not.toHaveBeenCalled();
    expect(within(sub).getByLabelText(/Procedure Name/)).toHaveValue(
      'Knee scope'
    );

    // Fixing the field clears the message, and the same dialog then creates it
    await user.type(within(sub).getByLabelText(/Procedure Date/), '2026-01-15');
    expect(within(sub).queryByRole('alert')).toBeNull();
    await user.click(
      within(sub).getByRole('button', { name: 'Create Procedure' })
    );
    await waitFor(() => expect(api.createProcedure).toHaveBeenCalledTimes(1));
  });

  it('shows a create failure inside the dialog', async () => {
    api.createProcedure.mockRejectedValue(new Error('server error'));
    renderWithHost(true);
    const user = await openProceduresTab();
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );
    const sub = await fillAndSubmitSubDialog(user);
    expect(await within(sub).findByRole('alert')).toHaveTextContent(
      'Could not create it. Please try again.'
    );
  });

  it('keeps the procedure and says so when linking fails', async () => {
    api.createEncounterLinksBulk.mockRejectedValue(new Error('link failed'));
    renderWithHost(true);
    const user = await openProceduresTab();
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );
    await fillAndSubmitSubDialog(user);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add Procedure' })).toBeNull()
    );
    // The record exists, and its staged files were still uploaded
    expect(api.createProcedure).toHaveBeenCalledTimes(1);
    expect(docs.uploadProcedureFiles).toHaveBeenCalledWith(501);
    expect(screen.getByDisplayValue('Annual checkup')).toBeInTheDocument();

    // The warning promises it can be linked from the list: it really is offered there
    await user.click(
      await screen.findByRole('button', { name: 'common:buttons.link' })
    );
    const linkDialog = await screen.findByRole('dialog', {
      name: /common:visits.relationships.modalTitle/,
    });
    await user.click(
      within(linkDialog).getByPlaceholderText(
        'common:visits.relationships.selectPlaceholder'
      )
    );
    expect(
      await screen.findByRole('option', {
        name: 'Knee scope (2026-01-15, scheduled)',
        hidden: true,
      })
    ).toBeInTheDocument();
  });
});

describe('Add Procedure from an unsaved Add Visit', () => {
  it('holds the link as pending with a proper label until the Visit is saved', async () => {
    let latest: typeof baseVisit | undefined;
    renderWithHost(false, f => {
      latest = f as typeof baseVisit;
    });
    const user = await openProceduresTab();
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );
    await fillAndSubmitSubDialog(user);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add Procedure' })).toBeNull()
    );
    // The record exists now; nothing is linked through the API yet
    expect(api.createProcedure).toHaveBeenCalledTimes(1);
    expect(api.createEncounterLinksBulk).not.toHaveBeenCalled();
    // The pending row is labelled, not "#501"
    expect(
      await screen.findByText('Knee scope (2026-01-15, scheduled)')
    ).toBeInTheDocument();
    expect(latest?.pending_links).toEqual({
      procedures: [{ entityId: 501, relevanceNote: null, purpose: null }],
    });
    expect(parentSubmit).not.toHaveBeenCalled();
  });
});

describe('negative control', () => {
  it('a create dialog rendered INSIDE the parent form would submit the parent', async () => {
    // The old, unsafe arrangement: the dialog is part of the parent <form>'s React tree
    render(
      <form onSubmit={parentSubmit}>
        <SubDialogContext.Provider value={{ zIndex: SUB_DIALOG_Z_INDEX }}>
          <ProcedureCreateDialog
            patientId={PATIENT_ID}
            onCreated={vi.fn()}
            onClose={vi.fn()}
          />
        </SubDialogContext.Provider>
      </form>
    );
    const user = userEvent.setup();
    await fillAndSubmitSubDialog(user);
    await waitFor(() => expect(api.createProcedure).toHaveBeenCalled());
    // This is what the app-level host prevents
    expect(parentSubmit).toHaveBeenCalled();
  });
});

const openTab = openLinkTab;

describe.each([
  {
    name: 'Injury',
    tab: 'shared:categories.injuries',
    addButton: 'common:inlineCreate.add.injury',
    dialog: 'Add Injury',
    created: {
      id: 601,
      injury_name: 'Sprained ankle',
      date_of_injury: '2026-01-10',
      status: 'active',
    },
    mockCreate: () => api.createInjury,
    link: 'injuries',
    nameLabel: /Injury Name/,
    nameField: 'injury_name' as const,
    absentTabs: [] as string[],
    extraFields: [{ label: /Body Part/, value: 'ankle' }],
    submit: 'Create',
    expectedLabel: 'Sprained ankle (2026-01-10, active)',
    payload: {
      injury_name: 'Sprained ankle',
      body_part: 'ankle',
      patient_id: PATIENT_ID,
    },
  },
  {
    name: 'Symptom',
    tab: 'shared:categories.symptoms',
    addButton: 'common:inlineCreate.add.symptom',
    dialog: 'Add Symptom',
    created: {
      id: 701,
      symptom_name: 'Headache',
      first_occurrence_date: '2026-01-20',
      status: 'active',
    },
    mockCreate: () => api.createSymptom,
    link: 'symptoms',
    nameLabel: /shared:labels.symptomName/,
    nameField: 'symptom_name' as const,
    absentTabs: [] as string[],
    extraFields: [] as Array<{ label: RegExp; value: string }>,
    submit: /common:buttons.create/,
    expectedLabel: 'Headache (2026-01-20, active)',
    payload: { symptom_name: 'Headache', patient_id: PATIENT_ID },
  },
  {
    name: 'Condition',
    tab: 'shared:categories.conditions',
    addButton: 'common:inlineCreate.add.condition',
    dialog: 'Add Condition',
    created: {
      id: 801,
      diagnosis: 'Hypertension',
      onset_date: '2025-06-01',
      status: 'active',
    },
    mockCreate: () => api.createCondition,
    link: 'conditions',
    nameLabel: /Diagnosis/,
    nameField: 'diagnosis' as const,
    extraFields: [] as Array<{ label: RegExp; value: string }>,
    submit: 'Create Condition',
    expectedLabel: 'Hypertension (2025-06-01, active)',
    payload: { diagnosis: 'Hypertension', patient_id: PATIENT_ID },
    // The condition's own link tabs are hidden in the sub-dialog too
    absentTabs: ['Medications', 'Lab Results'],
  },
  {
    name: 'Medication',
    tab: 'shared:categories.medications',
    addButton: 'common:inlineCreate.add.medication',
    dialog: 'Add Medication',
    created: {
      id: 901,
      medication_name: 'Ibuprofen',
      dosage: '200mg',
      status: 'active',
    },
    mockCreate: () => api.createMedication,
    link: 'medications',
    nameLabel: /shared:labels.medicationName/,
    nameField: 'medication_name' as const,
    extraFields: [] as Array<{ label: RegExp; value: string }>,
    submit: /medications\.form\.addMedication/,
    expectedLabel: 'Ibuprofen (200mg, active)',
    payload: { medication_name: 'Ibuprofen', patient_id: PATIENT_ID },
    // The medication's own link tab (conditions) is hidden in the sub-dialog too
    absentTabs: ['shared:categories.conditions'],
  },
  {
    name: 'Treatment',
    tab: 'shared:categories.treatments',
    addButton: 'common:inlineCreate.add.treatment',
    dialog: 'Add Treatment',
    created: {
      id: 1001,
      treatment_name: 'Physio',
      start_date: '2026-03-01',
      status: 'planned',
    },
    mockCreate: () => api.createTreatment,
    link: 'treatments',
    nameLabel: /Treatment Name/,
    nameField: 'treatment_name' as const,
    extraFields: [] as Array<{ label: RegExp; value: string }>,
    submit: /Create Treatment|treatments\.form\.createTreatment/,
    expectedLabel: 'Physio (2026-03-01, planned)',
    payload: { treatment_name: 'Physio', patient_id: PATIENT_ID },
    // The treatment's own Visits tab is hidden in the sub-dialog too
    absentTabs: ['Visits'],
  },
])('Add $name from an open Visit', c => {
  it("creates it for the Visit's patient, links it, and leaves the Visit untouched", async () => {
    c.mockCreate().mockResolvedValue(c.created);
    renderWithHost(true);
    const user = userEvent.setup();
    await user.type(screen.getByDisplayValue('Annual checkup'), ' - follow up');
    await openTab(c.tab);
    await user.click(await screen.findByRole('button', { name: c.addButton }));

    const sub = await screen.findByRole('dialog', { name: c.dialog });
    // One level deep: no link tabs in the sub-dialog
    for (const linkTab of [
      'shared:categories.procedures',
      'shared:categories.injuries',
      'shared:categories.symptoms',
      'Visits',
      ...c.absentTabs,
    ]) {
      expect(
        within(sub).queryByRole('tab', { name: withCount(linkTab) })
      ).toBeNull();
    }
    await user.type(
      within(sub).getByLabelText(c.nameLabel),
      c.created[c.nameField] as string
    );
    for (const field of c.extraFields) {
      await user.type(within(sub).getByLabelText(field.label), field.value);
    }
    await user.click(within(sub).getByRole('button', { name: c.submit }));

    await waitFor(() =>
      expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(55, c.link, {
        entity_ids: [c.created.id],
        relevance_note: null,
      })
    );
    expect(c.mockCreate().mock.calls[0][0]).toMatchObject(c.payload);
    expect(c.mockCreate().mock.calls[0][0]).not.toHaveProperty(
      'pending_visit_links'
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: c.dialog })).toBeNull()
    );
    expect(screen.getByRole('tab', { name: withCount(c.tab) })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(parentSubmit).not.toHaveBeenCalled();
    expect(parentClose).not.toHaveBeenCalled();
    expect(
      screen.getByDisplayValue('Annual checkup - follow up')
    ).toBeInTheDocument();
  });

  it('labels the new record in the pending list when the Visit is not saved yet', async () => {
    c.mockCreate().mockResolvedValue(c.created);
    renderWithHost(false);
    const user = await openTab(c.tab);
    await user.click(await screen.findByRole('button', { name: c.addButton }));
    const sub = await screen.findByRole('dialog', { name: c.dialog });
    await user.type(
      within(sub).getByLabelText(c.nameLabel),
      c.created[c.nameField] as string
    );
    for (const field of c.extraFields) {
      await user.type(within(sub).getByLabelText(field.label), field.value);
    }
    await user.click(within(sub).getByRole('button', { name: c.submit }));

    expect(await screen.findByText(c.expectedLabel)).toBeInTheDocument();
    expect(api.createEncounterLinksBulk).not.toHaveBeenCalled();
  });
});

/** A Procedure dialog (edit mode) whose form state lives in the parent. */
const ParentProcedure = () => {
  const [formData, setFormData] = useState({
    ...INITIAL_PROCEDURE_FORM_DATA,
    procedure_name: 'Knee arthroscopy',
    procedure_date: '2026-01-10',
    pending_visit_links: [],
  });
  const Form = ProcedureFormWrapper as unknown as ComponentType<
    Record<string, unknown>
  >;
  return (
    <Form
      isOpen
      onClose={parentClose}
      title="Procedure"
      formData={formData}
      onInputChange={(e: { target: { name: string; value: unknown } }) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
      }
      onSubmit={parentSubmit}
      editingItem={{ id: 88 }}
      practitioners={[]}
      patientId={PATIENT_ID}
      navigate={vi.fn()}
      onDocumentManagerRef={vi.fn()}
    />
  );
};

describe('Add Visit from an open Procedure (the other direction)', () => {
  it("creates the visit for the Procedure's patient and links it, leaving the Procedure untouched", async () => {
    api.createEncounter.mockResolvedValue({
      id: 901,
      reason: 'Follow-up',
      date: '2026-04-02',
      visit_type: null,
    });
    render(
      <InlineCreateProvider>
        <ParentProcedure />
      </InlineCreateProvider>
    );
    const user = userEvent.setup();
    await user.type(screen.getByDisplayValue('Knee arthroscopy'), ' (left)');
    await openTab('Visits');
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.visit',
      })
    );

    const sub = await screen.findByRole('dialog', { name: 'Add Visit' });
    // None of the visit's seven link tabs in the sub-dialog
    for (const linkTab of [
      'shared:categories.procedures',
      'shared:categories.treatments',
      'shared:categories.injuries',
      'shared:categories.symptoms',
      'shared:categories.conditions',
      'shared:categories.medications',
      'shared:categories.lab_results',
    ]) {
      expect(
        within(sub).queryByRole('tab', { name: withCount(linkTab) })
      ).toBeNull();
    }
    await user.type(within(sub).getAllByRole('textbox')[0], 'Follow-up');
    await user.type(within(sub).getByLabelText(/date/i), '2026-04-02');
    await user.click(within(sub).getByRole('button', { name: 'Add Visit' }));

    await waitFor(() =>
      expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledWith(
        'procedures',
        88,
        { encounter_ids: [901], relevance_note: null }
      )
    );
    expect(api.createEncounter.mock.calls[0][0]).toMatchObject({
      reason: 'Follow-up',
      date: '2026-04-02',
      patient_id: PATIENT_ID,
    });
    expect(api.createEncounter.mock.calls[0][0]).not.toHaveProperty(
      'pending_links'
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add Visit' })).toBeNull()
    );
    expect(
      screen.getByRole('tab', { name: withCount('Visits') })
    ).toHaveAttribute('aria-selected', 'true');
    expect(parentSubmit).not.toHaveBeenCalled();
    expect(parentClose).not.toHaveBeenCalled();
    expect(
      screen.getByDisplayValue('Knee arthroscopy (left)')
    ).toBeInTheDocument();
  });
});

describe('Add Lab Result from an open Visit', () => {
  const NEW_LAB = {
    id: 321,
    test_name: 'Metabolic panel',
    ordered_date: '2026-03-02',
    status: 'ordered',
  };

  const openPanel = async (editing: boolean) => {
    api.createLabResult.mockResolvedValue(NEW_LAB);
    renderWithHost(editing);
    const user = await openTab('shared:categories.lab_results');
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.labResult',
      })
    );
    const dialog = await screen.findByRole('dialog', {
      name: /labResults\.addPanel\.title|Add Lab Results Panel/i,
    });
    return { user, dialog };
  };

  const fillAndCreate = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement
  ) => {
    await user.type(
      within(dialog).getAllByLabelText(
        /Lab Results Panel or Type|panelName/i
      )[0],
      'Metabolic panel'
    );
    await user.click(
      within(dialog).getByRole('button', { name: /createButton|Create/i })
    );
  };

  it('offers the quick panel above the Visit, without the Simple/Advanced switch or link tabs', async () => {
    const { dialog } = await openPanel(true);
    expect(within(dialog).queryByRole('switch')).toBeNull();
    expect(within(dialog).queryByRole('tab')).toBeNull();
    // The Visit dialog is still open underneath
    expect(screen.getByDisplayValue('Annual checkup')).toBeInTheDocument();
  });

  it('creates the panel, links it to the saved Visit with no purpose, and leaves the Visit untouched', async () => {
    const { user, dialog } = await openPanel(true);
    await fillAndCreate(user, dialog);

    await waitFor(() =>
      expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
        55,
        'lab-results',
        { lab_result_ids: [321], relevance_note: null, purpose: null }
      )
    );
    expect(api.createLabResult.mock.calls[0][0]).toMatchObject({
      test_name: 'Metabolic panel',
      patient_id: PATIENT_ID,
      is_panel: true,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /addPanel\.title|Add Lab/i })
      ).toBeNull()
    );
    expect(parentClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Annual checkup')).toBeInTheDocument();
  });

  it('labels the new panel in the pending list when the Visit is not saved yet', async () => {
    const { user, dialog } = await openPanel(false);
    await fillAndCreate(user, dialog);

    expect(
      await screen.findByText('Metabolic panel (2026-03-02, ordered)')
    ).toBeInTheDocument();
    expect(api.createEncounterLinksBulk).not.toHaveBeenCalled();
  });

  it('Escape closes only the panel, creating nothing and keeping the Visit edits', async () => {
    const user = userEvent.setup();
    api.createLabResult.mockResolvedValue(NEW_LAB);
    renderWithHost(true);
    await user.type(screen.getByDisplayValue('Annual checkup'), '!');
    await openTab('shared:categories.lab_results');
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.labResult',
      })
    );
    await screen.findByRole('dialog', {
      name: /addPanel\.title|Add Lab Results Panel/i,
    });

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /addPanel\.title|Add Lab/i })
      ).toBeNull()
    );
    expect(parentClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Annual checkup!')).toBeInTheDocument();
    expect(api.createLabResult).not.toHaveBeenCalled();
  });
});

describe('Add Treatment from an open Visit', () => {
  it('offers no Treatment Plan mode, keeps the schedule, and creates a simple treatment', async () => {
    api.createTreatment.mockResolvedValue({
      id: 1001,
      treatment_name: 'Physio',
      status: 'planned',
    });
    renderWithHost(true);
    const user = await openTab('shared:categories.treatments');
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.treatment',
      })
    );
    const sub = await screen.findByRole('dialog', { name: 'Add Treatment' });

    // The plan tabs are not available here, so the mode toggle is not offered
    expect(within(sub).queryByText('treatments.mode.label')).toBeNull();
    expect(
      within(sub).queryByText(/Treatment Plan|treatments\.mode\.advanced/)
    ).toBeNull();
    // ...and the schedule tab stays
    expect(
      within(sub).getByRole('tab', { name: /Schedule|scheduleDosage/ })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('treatment-plan-setup')).toBeNull();

    await user.type(within(sub).getByLabelText(/Treatment Name/), 'Physio');
    await user.click(
      within(sub).getByRole('button', { name: /Create Treatment/ })
    );
    await waitFor(() => expect(api.createTreatment).toHaveBeenCalledTimes(1));
    expect(api.createTreatment.mock.calls[0][0]).toMatchObject({
      treatment_name: 'Physio',
      mode: 'simple',
      patient_id: PATIENT_ID,
    });
    await waitFor(() =>
      expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
        55,
        'treatments',
        { entity_ids: [1001], relevance_note: null }
      )
    );
  });
});
