import { vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render from '../../../../test-utils/render';
import TreatmentPlanSetup from '../TreatmentPlanSetup';
import { InlineCreateProvider } from '../../../../contexts/InlineCreateContext';

// The full section renders slowly when the whole suite runs in parallel
vi.setConfig({ testTimeout: 20000 });

const api = vi.hoisted(() => ({
  getMedications: vi.fn(),
  getEncounters: vi.fn(),
  getLabResults: vi.fn(),
  getMedicalEquipment: vi.fn(),
  getPractitioners: vi.fn(),
  getPharmacies: vi.fn(),
}));
vi.mock('../../../../services/api', () => ({ apiService: api }));
vi.mock('../../../../hooks/useLinkPanelDescription', () => ({
  useLinkPanelDescription: () => (items, record) =>
    `description:${items}:${record}`,
}));
vi.mock('../../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({ canCreate: true, isViewOnly: false }),
}));
vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: vi.fn(),
    formatDate: date => date,
  }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const EMPTY = {
  medications: [],
  encounters: [],
  labResults: [],
  equipment: [],
};

// activeSection value -> what the section lists, and what its buttons are called
const SECTIONS = [
  {
    section: 'medications',
    items: 'medications',
    pendingKey: 'medications',
    add: 'common:inlineCreate.add.medication',
    option: 'Aspirin (100mg) - active',
  },
  {
    section: 'encounters',
    items: 'visits',
    pendingKey: 'encounters',
    add: 'common:inlineCreate.add.visit',
    option: /Checkup/,
  },
  {
    section: 'labs',
    items: 'labResults',
    pendingKey: 'labResults',
    add: 'common:inlineCreate.add.labResult',
    option: /Liver Panel/,
  },
  {
    section: 'equipment',
    items: 'equipment',
    pendingKey: 'equipment',
    add: 'common:inlineCreate.add.equipment',
    option: 'CPAP (respiratory) - active',
  },
];

beforeEach(() => {
  api.getMedications
    .mockReset()
    .mockResolvedValue([
      { id: 1, medication_name: 'Aspirin', dosage: '100mg', status: 'active' },
    ]);
  api.getEncounters
    .mockReset()
    .mockResolvedValue([
      { id: 2, date: '2026-03-01', visit_type: 'Office', reason: 'Checkup' },
    ]);
  api.getLabResults
    .mockReset()
    .mockResolvedValue([
      { id: 3, test_name: 'Liver Panel', completed_date: '2026-02-01' },
    ]);
  api.getMedicalEquipment.mockReset().mockResolvedValue([
    {
      id: 4,
      equipment_name: 'CPAP',
      equipment_type: 'respiratory',
      status: 'active',
    },
  ]);
  api.getPractitioners.mockReset().mockResolvedValue([]);
  api.getPharmacies.mockReset().mockResolvedValue([]);
});

const renderSetup = (props = {}) => {
  const onRelationshipsChange = vi.fn();
  render(
    <InlineCreateProvider>
      <TreatmentPlanSetup
        activeSection="encounters"
        pendingRelationships={EMPTY}
        onRelationshipsChange={onRelationshipsChange}
        patientId={7}
        {...props}
      />
    </InlineCreateProvider>
  );
  return onRelationshipsChange;
};

describe.each(SECTIONS)(
  'Add Treatment - $items link section (#1128)',
  ({ section, items, pendingKey, add, option }) => {
    it('says what the section is for and has "+ Add" and "+ Link" buttons', async () => {
      renderSetup({ activeSection: section });
      expect(
        await screen.findByRole('button', { name: add })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'common:buttons.link' })
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(`description:${items}:treatment`)
      ).toHaveLength(1);
      // The older select-in-the-form is gone
      expect(screen.queryByText(/to Link$/)).toBeNull();
    });

    it('shows the "None linked yet." panel until a record is chosen', async () => {
      const { unmount } = render(
        <InlineCreateProvider>
          <TreatmentPlanSetup
            activeSection={section}
            pendingRelationships={EMPTY}
            onRelationshipsChange={vi.fn()}
            patientId={7}
          />
        </InlineCreateProvider>
      );
      expect(
        await screen.findAllByText('common:visits.relationships.none')
      ).toHaveLength(4);
      unmount();

      renderSetup({
        activeSection: section,
        pendingRelationships: {
          ...EMPTY,
          [pendingKey]: [
            {
              id: String(
                { medications: 1, encounters: 2, labResults: 3, equipment: 4 }[
                  pendingKey
                ]
              ),
            },
          ],
        },
      });
      // The other three sections are still empty; the chosen one no longer is
      await screen.findByRole('button', {
        name: 'common:visits.relationships.removeLink',
      });
      expect(
        screen.getAllByText('common:visits.relationships.none')
      ).toHaveLength(3);
    });

    it('links the records picked in the Link dialog', async () => {
      const onChange = renderSetup({ activeSection: section });
      const user = userEvent.setup();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'common:buttons.link' })
        ).toBeEnabled()
      );
      await user.click(
        screen.getByRole('button', { name: 'common:buttons.link' })
      );
      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText(`common:visits.relationships.modalTitle`)
      ).toBeInTheDocument();
      await user.click(
        within(dialog).getByPlaceholderText(
          'common:visits.relationships.selectPlaceholder'
        )
      );
      await user.click(
        await screen.findByRole('option', { name: option, hidden: true })
      );
      await user.click(
        within(dialog).getByRole('button', {
          name: 'common:visits.relationships.linkSelected',
        })
      );

      expect(onChange).toHaveBeenCalledWith({
        ...EMPTY,
        [pendingKey]: [{ id: expect.stringMatching(/^\d+$/) }],
      });
    });

    it('can unlink a chosen record', async () => {
      const onChange = renderSetup({
        activeSection: section,
        pendingRelationships: {
          ...EMPTY,
          [pendingKey]: [
            {
              id: String(
                { medications: 1, encounters: 2, labResults: 3, equipment: 4 }[
                  pendingKey
                ]
              ),
            },
          ],
        },
      });
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'common:visits.relationships.removeLink',
        })
      );
      expect(onChange).toHaveBeenCalledWith({ ...EMPTY, [pendingKey]: [] });
    });
  }
);

describe('Add Treatment - Link dialog', () => {
  it('does not offer a record that is already chosen', async () => {
    renderSetup({
      activeSection: 'encounters',
      pendingRelationships: { ...EMPTY, encounters: [{ id: '2' }] },
    });
    await screen.findByRole('button', {
      name: 'common:visits.relationships.removeLink',
    });
    // Nothing is left to link, so the Link button is disabled
    expect(
      screen.getByRole('button', { name: 'common:buttons.link' })
    ).toBeDisabled();
  });
});
