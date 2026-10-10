import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import render from '../../../../test-utils/render';
import TreatmentRelationshipsManager from '../TreatmentRelationshipsManager';

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
vi.mock('../TreatmentMedicationRelationships', () => ({
  default: () => <div data-testid="medications-section" />,
}));
vi.mock('../TreatmentEncounterRelationships', () => ({
  default: () => <div data-testid="visits-section" />,
}));
vi.mock('../TreatmentLabResultRelationships', () => ({
  default: () => <div data-testid="lab-results-section" />,
}));
vi.mock('../TreatmentEquipmentRelationships', () => ({
  default: () => <div data-testid="equipment-section" />,
}));

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
