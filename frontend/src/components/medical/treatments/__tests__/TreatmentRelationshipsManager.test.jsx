import { vi } from 'vitest';
import { renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import render from '../../../../test-utils/render';
import TreatmentRelationshipsManager from '../TreatmentRelationshipsManager';
import { treatmentLinkCountKey } from '../../../../hooks/useTreatmentLinkCounts';
import { useLinkCount } from '../../../../utils/linkCountStore';

vi.mock('../../../../hooks/useLinkPanelDescription', () => ({
  useLinkPanelDescription: () => (items, record) =>
    `description:${items}:${record}`,
}));
vi.mock('../../../../services/api', () => ({
  apiService: new Proxy({}, { get: () => vi.fn(() => Promise.resolve([])) }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
// Each panel loads its own links and reports them, as the real ones do
vi.mock('../TreatmentMedicationRelationships', async () =>
  (await import('./relationshipPanelMock')).mockPanel('medications-section', 2)
);
vi.mock('../TreatmentEncounterRelationships', async () =>
  (await import('./relationshipPanelMock')).mockPanel('visits-section', 1)
);
vi.mock('../TreatmentLabResultRelationships', async () =>
  (await import('./relationshipPanelMock')).mockPanel('lab-results-section', 3)
);
vi.mock('../TreatmentEquipmentRelationships', async () =>
  (await import('./relationshipPanelMock')).mockPanel('equipment-section', 0)
);

describe('TreatmentRelationshipsManager - panel descriptions (#1128)', () => {
  it('says what each link panel is for', () => {
    render(<TreatmentRelationshipsManager treatmentId={5} patientId={7} />);
    for (const items of ['medications', 'visits', 'labResults', 'equipment']) {
      expect(
        screen.getByText(`description:${items}:treatment`)
      ).toBeInTheDocument();
    }
  });

  it('does not add the descriptions to the read-only dialog', () => {
    render(
      <TreatmentRelationshipsManager treatmentId={5} patientId={7} isViewMode />
    );
    expect(screen.queryByText(/^description:/)).toBeNull();
    expect(screen.getByTestId('medications-section')).toBeInTheDocument();
  });
});

describe('TreatmentRelationshipsManager - tab counts', () => {
  it('writes what each panel loaded to the counts the form tabs read, without fetching counts itself', () => {
    render(<TreatmentRelationshipsManager treatmentId={5} patientId={7} />);

    const countOf = kind =>
      renderHook(() => useLinkCount(treatmentLinkCountKey(5, kind))).result
        .current.count;
    expect(countOf('medications')).toBe(2);
    expect(countOf('encounters')).toBe(1);
    expect(countOf('labResults')).toBe(3);
    expect(countOf('equipment')).toBe(0);
  });
});
