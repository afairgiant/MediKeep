import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render from '../../../../test-utils/render';
import { apiService } from '../../../../services/api';
import MantineMedicationForm from '../../MantineMedicationForm';
import MedicationViewModal from '../MedicationViewModal';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: vi.fn(),
    formatDate: date => date,
  }),
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
vi.mock('../MedicationTreatmentsList', () => ({ default: () => null }));
vi.mock('../../MedicationRelationships', () => ({ default: () => null }));
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

const formProps = (extra = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  title: 'Medication',
  formData: {
    medication_name: '',
    tags: [],
    condition_ids: [],
    reminder_times: [],
    pending_visit_links: pending,
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

const openVisitsTab = async () => {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('tab', { name: /^Visits( \(\d+\))?$/ })
  );
  return user;
};

describe('MantineMedicationForm - Visits tab', () => {
  it('has a Visits tab that loads only when opened', () => {
    render(<MantineMedicationForm {...formProps()} />);
    expect(
      screen.getByRole('tab', { name: /^Visits( \(\d+\))?$/ })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('record-visits')).toBeNull();
  });

  it('add mode: no record id, patient id and pending visits from form data', async () => {
    render(<MantineMedicationForm {...formProps()} />);
    await openVisitsTab();
    const tab = await screen.findByTestId('record-visits');
    expect(tab).toHaveAttribute('data-record-type', 'medications');
    expect(tab).toHaveAttribute('data-record-id', '');
    expect(tab).toHaveAttribute('data-patient-id', '7');
    expect(tab).toHaveAttribute('data-view-mode', 'false');
    expect(JSON.parse(tab.getAttribute('data-pending'))).toEqual(pending);
  });

  it('edit mode passes the saved medication id', async () => {
    render(
      <MantineMedicationForm
        {...formProps({ editingMedication: { id: 42 } })}
      />
    );
    await openVisitsTab();
    expect(await screen.findByTestId('record-visits')).toHaveAttribute(
      'data-record-id',
      '42'
    );
  });

  it('stores pending visits in the form data under pending_visit_links', async () => {
    const onInputChange = vi.fn();
    render(<MantineMedicationForm {...formProps({ onInputChange })} />);
    const user = await openVisitsTab();
    await user.click(await screen.findByText('add-pending'));
    expect(onInputChange).toHaveBeenCalledWith({
      target: {
        name: 'pending_visit_links',
        value: [{ entityId: 5, relevanceNote: null, purpose: null }],
      },
    });
  });

  it('keeps the existing Conditions tab', () => {
    render(<MantineMedicationForm {...formProps()} />);
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(5);
  });
});

describe('MedicationViewModal - Visits tab', () => {
  // The View dialog only shows link tabs that have links
  let visitLinks;
  let spies;
  beforeEach(() => {
    visitLinks = [{ id: 1 }];
    spies = [
      vi
        .spyOn(apiService, 'getRecordEncounterLinks')
        .mockImplementation(() => Promise.resolve(visitLinks)),
      vi.spyOn(apiService, 'getRecordLabResultLinks').mockResolvedValue([]),
      vi.spyOn(apiService, 'getMedicationConditions').mockResolvedValue([]),
    ];
  });
  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
  });

  const renderModal = () =>
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

  it('has a Visits tab that loads only when opened', async () => {
    renderModal();
    expect(
      await screen.findByRole('tab', { name: /^Visits( \(\d+\))?$/ })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('record-visits')).toBeNull();
  });

  it('has no Visits, Lab Results or Conditions tab for a medication without links', async () => {
    visitLinks = [];
    renderModal();
    await waitFor(() => expect(spies[0]).toHaveBeenCalled());
    expect(
      screen.queryByRole('tab', {
        name: /^(Visits|shared:tabs\.labResults|shared:categories\.conditions)/,
      })
    ).toBeNull();
  });

  it('shows a read-only Visits card for the viewed medication', async () => {
    renderModal();
    await openVisitsTab();
    const tab = await screen.findByTestId('record-visits');
    expect(tab).toHaveAttribute('data-record-type', 'medications');
    expect(tab).toHaveAttribute('data-record-id', '42');
    expect(tab).toHaveAttribute('data-view-mode', 'true');
  });
});
