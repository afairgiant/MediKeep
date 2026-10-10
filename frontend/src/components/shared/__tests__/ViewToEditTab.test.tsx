import type { ComponentType, ReactElement } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import ProcedureFormWrapper from '../../medical/procedures/ProcedureFormWrapper';
import ProcedureViewModal from '../../medical/procedures/ProcedureViewModal';
import InjuryFormWrapper from '../../medical/injuries/InjuryFormWrapper';
import InjuryViewModal from '../../medical/injuries/InjuryViewModal';
import ConditionFormWrapper from '../../medical/conditions/ConditionFormWrapper';
import ConditionViewModal from '../../medical/conditions/ConditionViewModal';
import MantineSymptomForm from '../../medical/MantineSymptomForm';
import SymptomViewModal from '../../medical/symptoms/SymptomViewModal';
import MantineVisitForm from '../../medical/MantineVisitForm';
import VisitViewModal from '../../medical/visits/VisitViewModal';
import { apiService } from '../../../services/api';

vi.mock('../../medical/practitioners/PractitionerSelectWithCreate', () => ({
  default: () => <div data-testid="practitioner-select" />,
}));
vi.mock('../../medical/injuries/InjuryTypeSelect', () => ({
  default: () => <div data-testid="injury-type-select" />,
}));
vi.mock('../DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));
vi.mock('../../medical/MedicationRelationships', () => ({
  default: () => <div />,
}));
vi.mock('../../medical/LabResultRelationships', () => ({
  default: () => <div />,
}));
// The tab contents are not under test; only which tab is selected
vi.mock('../RecordVisitsTab', () => ({ default: () => <div /> }));
vi.mock('../../medical/visits/VisitLinkTabs', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../../medical/visits/VisitLinkTabs')
  >()),
  VisitLinkTabPanels: () => <div />,
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// These JS components infer every destructured prop as required; tests pass a subset.
type Loose = ComponentType<Record<string, unknown>>;
const loose = (component: unknown) => component as Loose;
const ProcedureForm = loose(ProcedureFormWrapper);
const ProcedureView = loose(ProcedureViewModal);
const InjuryForm = loose(InjuryFormWrapper);
const InjuryView = loose(InjuryViewModal);
const ConditionForm = loose(ConditionFormWrapper);
const ConditionView = loose(ConditionViewModal);
const SymptomForm = loose(MantineSymptomForm);
const SymptomView = loose(SymptomViewModal);
const VisitForm = loose(MantineVisitForm);
const VisitView = loose(VisitViewModal);

const formBase = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Edit',
  onSubmit: vi.fn().mockResolvedValue({}),
  onInputChange: vi.fn(),
  isLoading: false,
  patientId: 7,
  navigate: vi.fn(),
  formData: { tags: [], typical_triggers: [], reason: '', date: '' },
};
const viewBase = { isOpen: true, onClose: vi.fn(), navigate: vi.fn() };

interface Case {
  name: string;
  /** View tab to open, and the Edit form tab it should map to */
  viewTab: string;
  editTab: string;
  view: (_onEdit: () => void) => ReactElement;
  form: () => ReactElement;
}

const cases: Case[] = [
  {
    name: 'procedures',
    viewTab: 'clinical',
    editTab: 'clinical',
    view: onEdit => (
      <ProcedureView
        {...viewBase}
        onEdit={onEdit}
        procedure={{ id: 1, tags: [] }}
      />
    ),
    form: () => <ProcedureForm {...formBase} editingItem={{ id: 1 }} />,
  },
  {
    name: 'injuries',
    viewTab: 'treatment',
    editTab: 'treatment',
    view: onEdit => (
      <InjuryView {...viewBase} onEdit={onEdit} injury={{ id: 1, tags: [] }} />
    ),
    form: () => (
      <InjuryForm
        {...formBase}
        editingInjury={{ id: 1 }}
        practitionersOptions={[]}
        injuryTypes={[]}
      />
    ),
  },
  {
    name: 'conditions',
    viewTab: 'labResults',
    editTab: 'labResults',
    view: onEdit => (
      <ConditionView
        {...viewBase}
        onEdit={onEdit}
        condition={{ id: 1, tags: [] }}
      />
    ),
    form: () => <ConditionForm {...formBase} editingCondition={{ id: 1 }} />,
  },
  {
    name: 'symptoms',
    viewTab: 'visits',
    editTab: 'visits',
    view: onEdit => (
      <SymptomView
        {...viewBase}
        onEdit={onEdit}
        symptom={{ id: 1, tags: [] }}
      />
    ),
    form: () => <SymptomForm {...formBase} editingSymptom={{ id: 1 }} />,
  },
  {
    name: 'visits (a linked-record tab)',
    viewTab: 'link-labResults',
    editTab: 'link-labResults',
    view: onEdit => (
      <VisitView
        {...viewBase}
        onEdit={onEdit}
        visit={{ id: 1, reason: 'Checkup', tags: [] }}
        practitioners={[]}
        conditions={[]}
      />
    ),
    form: () => <VisitForm {...formBase} editingVisit={{ id: 1 }} />,
  },
];

const tabByValue = (value: string) =>
  screen
    .getAllByRole('tab')
    .find(tab => tab.id.endsWith(`-tab-${value}`)) as HTMLElement;

const clickEdit = async () => {
  const edit = screen
    .getAllByRole('button')
    .find(button => /^\s*Edit\b/.test(button.textContent ?? ''));
  expect(edit).toBeDefined();
  await userEvent.click(edit as HTMLElement);
};

// View mode only shows link tabs that have links: the visit under test has lab results,
// and every record under test has a visit and a lab result
let spies: Array<ReturnType<typeof vi.spyOn>>;
beforeEach(() => {
  spies = [
    vi
      .spyOn(apiService, 'getEncounterLinks')
      .mockImplementation((_visitId: number, linkType: string) =>
        Promise.resolve(linkType === 'lab-results' ? [{ id: 1 }] : [])
      ),
    vi
      .spyOn(apiService, 'getRecordEncounterLinks')
      .mockResolvedValue([{ id: 1 }]),
    vi
      .spyOn(apiService, 'getRecordLabResultLinks')
      .mockResolvedValue([{ id: 1 }]),
  ];
});
afterEach(() => {
  spies.forEach(spy => spy.mockRestore());
});

describe.each(cases)('View to Edit keeps the tab - $name', c => {
  it('opens the Edit form on the tab that was open in View mode', async () => {
    const onEdit = vi.fn();
    const { unmount } = render(c.view(onEdit));

    await waitFor(() => expect(tabByValue(c.viewTab)).toBeTruthy());
    await userEvent.click(tabByValue(c.viewTab));
    expect(tabByValue(c.viewTab)).toHaveAttribute('aria-selected', 'true');
    await clickEdit();
    // Some View modals hand over after a short timer
    await waitFor(() => expect(onEdit).toHaveBeenCalled());
    unmount();

    render(c.form());
    expect(tabByValue(c.editTab)).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on the first tab when Edit is opened without a View dialog', () => {
    // Nothing remembered for this entity within the window
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);
    try {
      render(c.form());
      const selected = screen
        .getAllByRole('tab')
        .filter(tab => tab.getAttribute('aria-selected') === 'true');
      expect(selected).toHaveLength(1);
      expect(selected[0]).toBe(screen.getAllByRole('tab')[0]);
    } finally {
      vi.useRealTimers();
    }
  });
});
