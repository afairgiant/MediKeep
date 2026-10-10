import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

import userEvent from '@testing-library/user-event';

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

  it('View, Treatment Plan mode: each linked type shows its count; a type without links has no tab', async () => {
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
    expect(
      screen.getByRole('tab', { name: /Equipment \(1\)/ })
    ).toBeInTheDocument();
    // No lab results are linked
    expect(screen.queryByRole('tab', { name: /Labs/ })).toBeNull();
  });

  it('View: a count that cannot be loaded gives no tab for that type', async () => {
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
    expect(screen.queryByRole('tab', { name: /Visits/ })).toBeNull();
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

  it('Add: no link tabs until something is linked, and no saved links are loaded', async () => {
    render(
      <FormWrapper {...editProps('advanced', { editingTreatment: null })} />
    );
    expect(
      screen.queryByRole('tab', { name: /shared:categories\.medications/ })
    ).toBeNull();
    expect(
      screen.queryByRole('tab', { name: /shared:tabs\.visits/ })
    ).toBeNull();
    expect(api.getTreatmentMedications).not.toHaveBeenCalled();

    // The Link menu offers every type for this mode
    await userEvent.click(
      screen
        .getAllByRole('button', { name: 'common:buttons.link' })
        .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement
    );
    expect(
      (await screen.findAllByRole('menuitem', { hidden: true })).map(
        item => item.textContent
      )
    ).toEqual([
      'shared:categories.medications',
      'shared:tabs.visits',
      'shared:categories.lab_results',
      'shared:categories.medical_equipment',
    ]);
  });
});
