import type { ComponentType } from 'react';
import { vi } from 'vitest';
import render, { screen } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import RawLabResultViewModal from '../LabResultViewModal';

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
  it('has a tab per linked record type and no Relationships tab', () => {
    renderModal('overview');
    [
      'shared:categories.conditions',
      'Visits',
      'shared:categories.medications',
      'shared:categories.procedures',
      'shared:categories.treatments',
    ].forEach(name =>
      expect(
        screen.getByRole('tab', { name: withCount(name) })
      ).toBeInTheDocument()
    );
    expect(screen.queryByRole('tab', { name: /elationships/ })).toBeNull();
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
    expect(
      screen.getByRole('tab', { name: 'shared:categories.procedures (0)' })
    ).toBeInTheDocument();
    Object.values(fetchers).forEach(fetcher =>
      expect(fetcher).toHaveBeenCalledWith(5)
    );
  });
});
