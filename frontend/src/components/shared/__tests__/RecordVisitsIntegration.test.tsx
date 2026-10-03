import type { ComponentType, ReactElement } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen } from '../../../test-utils/render';
import RawProcedureFormWrapper from '../../medical/procedures/ProcedureFormWrapper';
import RawProcedureViewModal from '../../medical/procedures/ProcedureViewModal';
import RawInjuryFormWrapper from '../../medical/injuries/InjuryFormWrapper';
import RawInjuryViewModal from '../../medical/injuries/InjuryViewModal';
import RawConditionFormWrapper from '../../medical/conditions/ConditionFormWrapper';
import RawConditionViewModal from '../../medical/conditions/ConditionViewModal';
import RawMantineSymptomForm from '../../medical/MantineSymptomForm';
import RawSymptomViewModal from '../../medical/symptoms/SymptomViewModal';

// These JS components infer every destructured prop as required; tests pass a subset.
type Loose = ComponentType<Record<string, unknown>>;
const ProcedureFormWrapper = RawProcedureFormWrapper as unknown as Loose;
const ProcedureViewModal = RawProcedureViewModal as unknown as Loose;
const InjuryFormWrapper = RawInjuryFormWrapper as unknown as Loose;
const InjuryViewModal = RawInjuryViewModal as unknown as Loose;
const ConditionFormWrapper = RawConditionFormWrapper as unknown as Loose;
const ConditionViewModal = RawConditionViewModal as unknown as Loose;
const MantineSymptomForm = RawMantineSymptomForm as unknown as Loose;
const SymptomViewModal = RawSymptomViewModal as unknown as Loose;

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
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../RecordVisitsTab', () => ({
  default: (props: {
    recordType: string;
    recordId?: number | null;
    patientId?: number;
    isViewMode?: boolean;
    pendingLinks?: unknown;
    onPendingChange?: (_next: unknown) => void;
  }) => (
    <div
      data-testid="record-visits"
      data-record-type={props.recordType}
      data-record-id={props.recordId ?? ''}
      data-patient-id={props.patientId ?? ''}
      data-view-mode={String(Boolean(props.isViewMode))}
      data-pending={JSON.stringify(props.pendingLinks ?? null)}
    >
      <button
        type="button"
        onClick={() =>
          props.onPendingChange?.([
            { entityId: 5, relevanceNote: null, purpose: null },
          ])
        }
      >
        add-pending
      </button>
    </div>
  ),
}));

const pending = [{ entityId: 3, relevanceNote: 'n', purpose: null }];

interface Case {
  name: string;
  recordType: string;
  mode: 'form' | 'view';
  /** Renders the component for a new record (form) or a saved one (view). */
  renderIt: (_extra?: Record<string, unknown>) => ReactElement;
  /** Renders a form in edit mode with record id 42. */
  renderEdit?: () => ReactElement;
}

const formBase = (extra: Record<string, unknown> = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  title: 'Form',
  onSubmit: vi.fn().mockResolvedValue({}),
  onInputChange: vi.fn(),
  isLoading: false,
  patientId: 7,
  navigate: vi.fn(),
  ...extra,
});

const viewBase = () => ({
  isOpen: true,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  navigate: vi.fn(),
});

const cases: Case[] = [
  {
    name: 'ProcedureFormWrapper',
    recordType: 'procedures',
    mode: 'form',
    renderIt: extra => (
      <ProcedureFormWrapper
        {...formBase()}
        formData={{ tags: [], pending_visit_links: pending }}
        {...extra}
      />
    ),
    renderEdit: () => (
      <ProcedureFormWrapper
        {...formBase()}
        formData={{ tags: [] }}
        editingItem={{ id: 42 }}
      />
    ),
  },
  {
    name: 'InjuryFormWrapper',
    recordType: 'injuries',
    mode: 'form',
    renderIt: extra => (
      <InjuryFormWrapper
        {...formBase()}
        formData={{ tags: [], pending_visit_links: pending }}
        practitionersOptions={[]}
        injuryTypes={[]}
        {...extra}
      />
    ),
    renderEdit: () => (
      <InjuryFormWrapper
        {...formBase()}
        formData={{ tags: [] }}
        editingInjury={{ id: 42 }}
        practitionersOptions={[]}
        injuryTypes={[]}
      />
    ),
  },
  {
    name: 'ConditionFormWrapper',
    recordType: 'conditions',
    mode: 'form',
    renderIt: extra => (
      <ConditionFormWrapper
        {...formBase()}
        formData={{ tags: [], pending_visit_links: pending }}
        {...extra}
      />
    ),
    renderEdit: () => (
      <ConditionFormWrapper
        {...formBase()}
        formData={{ tags: [] }}
        editingCondition={{ id: 42 }}
      />
    ),
  },
  {
    name: 'MantineSymptomForm',
    recordType: 'symptoms',
    mode: 'form',
    renderIt: extra => (
      <MantineSymptomForm
        {...formBase()}
        formData={{
          tags: [],
          typical_triggers: [],
          pending_visit_links: pending,
        }}
        {...extra}
      />
    ),
    renderEdit: () => (
      <MantineSymptomForm
        {...formBase()}
        formData={{ tags: [], typical_triggers: [] }}
        editingSymptom={{ id: 42 }}
      />
    ),
  },
  {
    name: 'ProcedureViewModal',
    recordType: 'procedures',
    mode: 'view',
    renderIt: () => (
      <ProcedureViewModal
        {...viewBase()}
        procedure={{ id: 42, procedure_name: 'Knee', tags: [] }}
      />
    ),
  },
  {
    name: 'InjuryViewModal',
    recordType: 'injuries',
    mode: 'view',
    renderIt: () => (
      <InjuryViewModal
        {...viewBase()}
        injury={{ id: 42, injury_name: 'Ankle', tags: [] }}
      />
    ),
  },
  {
    name: 'ConditionViewModal',
    recordType: 'conditions',
    mode: 'view',
    renderIt: () => (
      <ConditionViewModal
        {...viewBase()}
        condition={{ id: 42, diagnosis: 'Hypertension', tags: [] }}
      />
    ),
  },
  {
    name: 'SymptomViewModal',
    recordType: 'symptoms',
    mode: 'view',
    renderIt: () => (
      <SymptomViewModal
        {...viewBase()}
        symptom={{ id: 42, symptom_name: 'Headache', tags: [] }}
      />
    ),
  },
];

const openVisitsTab = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: /^Visits( \(\d+\))?$/ }));
  return user;
};

describe.each(cases)('$name - Visits tab', c => {
  it('has a Visits tab that loads only when opened', () => {
    render(c.renderIt());
    expect(
      screen.getByRole('tab', { name: /^Visits( \(\d+\))?$/ })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('record-visits')).toBeNull();
  });

  if (c.mode === 'form') {
    it('add mode: no record id, patient id and pending visits from form data', async () => {
      render(c.renderIt());
      await openVisitsTab();
      const tab = await screen.findByTestId('record-visits');
      expect(tab).toHaveAttribute('data-record-type', c.recordType);
      expect(tab).toHaveAttribute('data-record-id', '');
      expect(tab).toHaveAttribute('data-patient-id', '7');
      expect(tab).toHaveAttribute('data-view-mode', 'false');
      expect(JSON.parse(tab.getAttribute('data-pending') as string)).toEqual(
        pending
      );
    });

    it('edit mode: passes the saved record id', async () => {
      render((c.renderEdit as () => ReactElement)());
      await openVisitsTab();
      expect(await screen.findByTestId('record-visits')).toHaveAttribute(
        'data-record-id',
        '42'
      );
    });

    it('stores pending visits in the form data under pending_visit_links', async () => {
      const onInputChange = vi.fn();
      render(c.renderIt({ onInputChange }));
      const user = await openVisitsTab();
      await user.click(await screen.findByText('add-pending'));
      expect(onInputChange).toHaveBeenCalledWith({
        target: {
          name: 'pending_visit_links',
          value: [{ entityId: 5, relevanceNote: null, purpose: null }],
        },
      });
    });
  } else {
    it('view mode: read-only for the viewed record', async () => {
      render(c.renderIt());
      await openVisitsTab();
      const tab = await screen.findByTestId('record-visits');
      expect(tab).toHaveAttribute('data-record-type', c.recordType);
      expect(tab).toHaveAttribute('data-record-id', '42');
      expect(tab).toHaveAttribute('data-view-mode', 'true');
    });
  }
});
