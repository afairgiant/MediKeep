import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

import render, { screen } from '../../../../test-utils/render';
import RawViewModal from '../TreatmentViewModal';
import RawFormWrapper from '../TreatmentFormWrapper';

const ViewModal = RawViewModal as unknown as ComponentType<
  Record<string, unknown>
>;
const FormWrapper = RawFormWrapper as unknown as ComponentType<
  Record<string, unknown>
>;

const api = vi.hoisted(() => ({
  getTreatmentMedications: vi.fn(),
  getTreatmentEncounters: vi.fn(),
  getTreatmentLabResults: vi.fn(),
  getTreatmentEquipment: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({ apiService: api }));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
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
vi.mock('../../../common/TagInput', () => ({ TagInput: () => <div /> }));
vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div />,
}));
vi.mock('../../practitioners/PractitionerSelectWithCreate', () => ({
  default: () => <div />,
}));
vi.mock('../TreatmentMedicationsViewTab', () => ({ default: () => <div /> }));
vi.mock('../TreatmentLabResultRelationships', () => ({
  default: () => <div />,
}));
vi.mock('../TreatmentEquipmentRelationships', () => ({
  default: () => <div />,
}));
vi.mock('../TreatmentEncounterRelationships', () => ({
  default: () => <div />,
}));
vi.mock('../TreatmentPlanSetup', () => ({ default: () => <div /> }));
vi.mock('../TreatmentRelationshipsManager', () => ({ default: () => <div /> }));

const TREATMENT = {
  id: 42,
  treatment_name: 'Physio plan',
  status: 'active',
  tags: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getTreatmentMedications.mockResolvedValue([
    { id: 1 },
    { id: 2 },
    { id: 3 },
  ]);
  api.getTreatmentEncounters.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  api.getTreatmentLabResults.mockResolvedValue([]);
  api.getTreatmentEquipment.mockResolvedValue([{ id: 1 }]);
});

describe('Treatment tabs show how many items are linked', () => {
  it('View, Simple mode: Visits shows its count', async () => {
    render(
      <ViewModal
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        treatment={{ ...TREATMENT, mode: 'simple' }}
      />
    );
    expect(
      await screen.findByRole('tab', { name: 'Visits (2)' })
    ).toBeInTheDocument();
  });

  it('View, Treatment Plan mode: every link tab shows its count, zero included', async () => {
    render(
      <ViewModal
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        treatment={{ ...TREATMENT, mode: 'advanced' }}
      />
    );
    expect(
      await screen.findByRole('tab', { name: /Medications \(3\)/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visits (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Labs \(0\)/ })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Equipment \(1\)/ })
    ).toBeInTheDocument();
  });

  it('View: a count that cannot be loaded leaves just the label', async () => {
    api.getTreatmentEncounters.mockRejectedValue(new Error('boom'));
    render(
      <ViewModal
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        treatment={{ ...TREATMENT, mode: 'advanced' }}
      />
    );
    expect(
      await screen.findByRole('tab', { name: /Medications \(3\)/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visits' })).toBeInTheDocument();
  });

  const editProps = (mode: string, extra = {}) => ({
    isOpen: true,
    onClose: vi.fn(),
    title: 'Edit Treatment',
    editingTreatment: TREATMENT,
    formData: {
      ...TREATMENT,
      mode,
      tags: [],
      condition_id: '',
      practitioner_id: '',
    },
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    ...extra,
  });

  it('Edit, Simple mode: Visits shows its count before the tab is opened', async () => {
    render(<FormWrapper {...editProps('simple')} />);
    expect(
      await screen.findByRole('tab', { name: 'shared:tabs.visits (2)' })
    ).toBeInTheDocument();
  });

  it('Edit, Treatment Plan mode: all link tabs show their counts', async () => {
    render(<FormWrapper {...editProps('advanced')} />);
    expect(
      await screen.findByRole('tab', {
        name: 'shared:categories.medications (3)',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', {
        name: 'shared:categories.medical_equipment (1)',
      })
    ).toBeInTheDocument();
  });

  it('Add: tabs show the number of items held until the treatment is saved', () => {
    render(
      <FormWrapper {...editProps('advanced', { editingTreatment: null })} />
    );
    expect(
      screen.getByRole('tab', { name: 'shared:categories.medications (0)' })
    ).toBeInTheDocument();
    expect(api.getTreatmentMedications).not.toHaveBeenCalled();
  });
});
