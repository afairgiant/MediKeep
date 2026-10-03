import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../../test-utils/render';
import RawTreatmentViewModal from '../TreatmentViewModal';
import { apiService } from '../../../../services/api';

// The JS component infers every destructured prop as required; the test passes a subset.
const TreatmentViewModal = RawTreatmentViewModal as unknown as ComponentType<
  Record<string, unknown>
>;

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

// What the treatment is linked to; the tab numbers (and which tabs exist) come from these
let linked: Record<
  'medications' | 'encounters' | 'labResults' | 'equipment',
  unknown[]
>;
let spies: Array<{ mockRestore: () => void }> = [];
beforeEach(() => {
  linked = { medications: [], encounters: [], labResults: [], equipment: [] };
  spies = [
    vi
      .spyOn(apiService, 'getTreatmentMedications')
      .mockImplementation(() => Promise.resolve(linked.medications)),
    vi
      .spyOn(apiService, 'getTreatmentEncounters')
      .mockImplementation(() => Promise.resolve(linked.encounters)),
    vi
      .spyOn(apiService, 'getTreatmentLabResults')
      .mockImplementation(() => Promise.resolve(linked.labResults)),
    vi
      .spyOn(apiService, 'getTreatmentEquipment')
      .mockImplementation(() => Promise.resolve(linked.equipment)),
  ];
});
afterEach(() => {
  spies.forEach(spy => spy.mockRestore());
});

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
  it('Simple mode shows a read-only Visits tab when the treatment has visits', async () => {
    linked.encounters = [{ id: 1 }];
    renderModal('simple');
    await userEvent.click(await screen.findByRole('tab', { name: /Visits/ }));
    const section = await screen.findByTestId('visits-section');
    expect(section).toHaveAttribute('data-treatment-id', '42');
    expect(section).toHaveAttribute('data-view-mode', 'true');
  });

  it('Simple mode shows no Visits tab for a treatment without visits', async () => {
    renderModal('simple');
    await waitFor(() =>
      expect(apiService.getTreatmentEncounters).toHaveBeenCalled()
    );
    expect(screen.queryByRole('tab', { name: /Visits/ })).toBeNull();
  });

  it('Simple mode does not show the other relationship tabs', async () => {
    linked.encounters = [{ id: 1 }];
    renderModal('simple');
    await screen.findByRole('tab', { name: /Visits/ });
    expect(screen.queryByRole('tab', { name: /Labs/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Equipment/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Medications/ })).toBeNull();
  });

  it('Treatment Plan mode shows exactly one Visits tab alongside the other linked types', async () => {
    linked = {
      medications: [{ id: 1 }],
      encounters: [{ id: 1 }],
      labResults: [{ id: 1 }],
      equipment: [{ id: 1 }],
    };
    renderModal('advanced');
    expect(await screen.findAllByRole('tab', { name: /Visits/ })).toHaveLength(
      1
    );
    expect(
      await screen.findByRole('tab', { name: /Labs/ })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: /Equipment/ })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Visits/ }));
    expect(await screen.findByTestId('visits-section')).toHaveAttribute(
      'data-view-mode',
      'true'
    );
  });

  it('Treatment Plan mode shows only the linked types, with no Link menu', async () => {
    linked.labResults = [{ id: 1 }];
    renderModal('advanced');
    await screen.findByRole('tab', { name: /Labs/ });
    expect(screen.queryByRole('tab', { name: /Visits/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Equipment/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Medications/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });
});
