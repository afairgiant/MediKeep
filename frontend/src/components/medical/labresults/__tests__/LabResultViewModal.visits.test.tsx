import type { ComponentType } from 'react';
import { vi } from 'vitest';
import render, { screen, waitFor } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import RawLabResultViewModal from '../LabResultViewModal';
import { apiService } from '../../../../services/api';

/** A link tab's name, with or without its "(n)" count. */
const withCount = (name: string) =>
  new RegExp(`^${name.replace(/\./g, '\\.')}( \\(\\d+\\))?$`);

// The JS component infers every destructured prop as required; the test passes a subset.
const LabResultViewModal = RawLabResultViewModal as unknown as ComponentType<
  Record<string, unknown>
>;

vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));
vi.mock('../TestComponentsTab', () => ({ default: () => <div /> }));
vi.mock('../../../shared/RecordVisitsCard', () => ({
  default: (props: {
    recordType: string;
    recordId?: number;
    isViewMode?: boolean;
  }) => (
    <div
      data-testid="visits-card"
      data-record-type={props.recordType}
      data-record-id={props.recordId}
      data-view-mode={String(Boolean(props.isViewMode))}
    />
  ),
}));

// Visits the lab result is linked to (the Visits count comes from this request)
let visitRows: unknown[] = [];
let visitsSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  visitRows = [];
  visitsSpy = vi
    .spyOn(apiService, 'getLabResultEncounters')
    .mockImplementation(() => Promise.resolve(visitRows));
});
afterEach(() => {
  visitsSpy.mockRestore();
});

const renderModal = (initialTab: string) =>
  render(
    <LabResultViewModal
      isOpen
      onClose={vi.fn()}
      labResult={{
        id: 5,
        test_name: 'CBC Panel',
        status: 'completed',
        tags: [],
      }}
      practitioners={[]}
      isGroupedResult
      initialTab={initialTab}
    />
  );

describe('LabResultViewModal - linked-record tabs', () => {
  it('shows a tab only for the linked record types that have links, and no Relationships tab', async () => {
    visitRows = [{ id: 1 }];
    render(
      <LabResultViewModal
        isOpen
        onClose={vi.fn()}
        labResult={{ id: 5, test_name: 'CBC', status: 'completed', tags: [] }}
        practitioners={[]}
        isGroupedResult
        initialTab="overview"
        labResultConditions={{ 5: [{ id: 1 }] }}
        labResultMedications={{ 5: [] }}
      />
    );
    expect(
      await screen.findByRole('tab', {
        name: 'shared:categories.conditions (1)',
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: 'Visits (1)' })
    ).toBeInTheDocument();
    ['medications', 'procedures', 'treatments'].forEach(name =>
      expect(
        screen.queryByRole('tab', {
          name: withCount(`shared:categories.${name}`),
        })
      ).toBeNull()
    );
    expect(screen.queryByRole('tab', { name: /elationships/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });

  it('shows no linked-record tabs for a lab result without links', async () => {
    renderModal('overview');
    await waitFor(() => expect(visitsSpy).toHaveBeenCalled());
    ['conditions', 'medications', 'procedures', 'treatments'].forEach(name =>
      expect(
        screen.queryByRole('tab', {
          name: withCount(`shared:categories.${name}`),
        })
      ).toBeNull()
    );
    expect(screen.queryByRole('tab', { name: /^Visits/ })).toBeNull();
  });

  it('shows a read-only Visits card for the viewed lab result on the Visits tab', () => {
    renderModal('rel-visits');
    const card = screen.getByTestId('visits-card');
    expect(card).toHaveAttribute('data-record-type', 'labResults');
    expect(card).toHaveAttribute('data-record-id', '5');
    expect(card).toHaveAttribute('data-view-mode', 'true');
  });

  it('shows the Visits card even when the patient has no other records to link', () => {
    // No conditions, medications, procedures or treatments are passed in
    renderModal('rel-visits');
    expect(screen.getByTestId('visits-card')).toBeInTheDocument();
  });

  it('does not mount the Visits card while another tab is open', () => {
    renderModal('overview');
    expect(screen.queryByTestId('visits-card')).toBeNull();
  });
});

describe('LabResultViewModal - tab numbers', () => {
  it('shows the number of saved links on each tab and loads them when it opens', () => {
    const fetchers = {
      fetchLabResultConditions: vi.fn(),
      fetchLabResultMedications: vi.fn(),
      fetchLabResultProcedures: vi.fn(),
      fetchLabResultTreatments: vi.fn(),
    };
    render(
      <LabResultViewModal
        isOpen
        onClose={vi.fn()}
        labResult={{
          id: 5,
          test_name: 'CBC Panel',
          status: 'completed',
          tags: [],
        }}
        practitioners={[]}
        isGroupedResult
        initialTab="overview"
        labResultConditions={{ 5: [{ id: 1 }] }}
        labResultMedications={{ 5: [{ id: 1 }, { id: 2 }] }}
        labResultProcedures={{ 5: [] }}
        {...fetchers}
      />
    );
    expect(
      screen.getByRole('tab', { name: 'shared:categories.conditions (1)' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'shared:categories.medications (2)' })
    ).toBeInTheDocument();
    // A type without links has no tab
    expect(
      screen.queryByRole('tab', {
        name: withCount('shared:categories.procedures'),
      })
    ).toBeNull();
    Object.values(fetchers).forEach(fetcher =>
      expect(fetcher).toHaveBeenCalledWith(5)
    );
  });
});
