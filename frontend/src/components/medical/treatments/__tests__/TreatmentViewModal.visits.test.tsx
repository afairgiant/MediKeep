import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen } from '../../../../test-utils/render';
import RawTreatmentViewModal from '../TreatmentViewModal';

// The JS component infers every destructured prop as required; the test passes a subset.
const TreatmentViewModal = RawTreatmentViewModal as unknown as ComponentType<Record<string, unknown>>;

vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));
vi.mock('../../StatusBadge', () => ({
  default: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock('../../../common/ClickableTagBadge', () => ({
  ClickableTagBadge: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));
vi.mock('../TreatmentMedicationsViewTab', () => ({
  default: () => <div data-testid="medications-view-tab" />,
}));
vi.mock('../TreatmentLabResultRelationships', () => ({
  default: () => <div data-testid="labs-section" />,
}));
vi.mock('../TreatmentEquipmentRelationships', () => ({
  default: () => <div data-testid="equipment-section" />,
}));
vi.mock('../TreatmentEncounterRelationships', () => ({
  default: (props: { treatmentId?: number; isViewMode?: boolean }) => (
    <div
      data-testid="visits-section"
      data-treatment-id={props.treatmentId}
      data-view-mode={String(Boolean(props.isViewMode))}
    />
  ),
}));

const renderModal = (mode: 'simple' | 'advanced') =>
  render(
    <TreatmentViewModal
      isOpen
      onClose={vi.fn()}
      onEdit={vi.fn()}
      treatment={{
        id: 42,
        treatment_name: 'Physio plan',
        mode,
        status: 'active',
        tags: [],
      }}
    />
  );

describe('TreatmentViewModal - Visits tab', () => {
  it('Simple mode shows a read-only Visits tab', async () => {
    renderModal('simple');
    await userEvent.click(screen.getByRole('tab', { name: /Visits/ }));
    const section = await screen.findByTestId('visits-section');
    expect(section).toHaveAttribute('data-treatment-id', '42');
    expect(section).toHaveAttribute('data-view-mode', 'true');
  });

  it('Simple mode does not show the other relationship tabs', () => {
    renderModal('simple');
    expect(screen.queryByRole('tab', { name: /Labs/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Equipment/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Medications/ })).toBeNull();
  });

  it('Treatment Plan mode shows exactly one Visits tab alongside the others', async () => {
    renderModal('advanced');
    expect(screen.getAllByRole('tab', { name: /Visits/ })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: /Labs/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Equipment/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Visits/ }));
    expect(await screen.findByTestId('visits-section')).toHaveAttribute(
      'data-view-mode',
      'true'
    );
  });
});
