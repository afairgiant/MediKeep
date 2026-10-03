import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Modal } from '@mantine/core';
import '@testing-library/jest-dom';
import render, { screen, waitFor } from '../../../test-utils/render';

import ConditionRelationships from '../ConditionRelationships';
import LabResultRelationships from '../LabResultRelationships';
import MedicationRelationships from '../MedicationRelationships';
import LabResultEncounterRelationships from '../labresults/LabResultEncounterRelationships';
import LabResultMedicationRelationships from '../labresults/LabResultMedicationRelationships';
import LabResultProcedureRelationships from '../labresults/LabResultProcedureRelationships';
import LabResultTreatmentRelationships from '../labresults/LabResultTreatmentRelationships';
import TreatmentEquipmentRelationships from '../treatments/TreatmentEquipmentRelationships';

// Any API method resolves to an empty list
vi.mock('../../../services/api', () => ({
  apiService: new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }),
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../utils/linkNavigation', () => ({ navigateToEntity: vi.fn() }));

Element.prototype.scrollIntoView = vi.fn();

const noop = vi.fn().mockResolvedValue([]);
// Pages pass stable maps; a fresh default {} per render would re-fire these components' effects
const EMPTY = {};

const cases = [
  {
    name: 'ConditionRelationships',
    render: () => (
      <ConditionRelationships
        labResultId={1}
        labResultConditions={EMPTY}
        conditions={[{ id: 1, diagnosis: 'Hypertension', status: 'active' }]}
        fetchLabResultConditions={noop}
      />
    ),
  },
  {
    name: 'LabResultRelationships',
    render: () => (
      <LabResultRelationships
        conditionId={1}
        isViewMode={false}
        labResults={[{ id: 1, test_name: 'CBC', status: 'completed' }]}
      />
    ),
  },
  {
    name: 'MedicationRelationships',
    render: () => (
      <MedicationRelationships
        direction="condition"
        conditionId={1}
        conditionMedications={EMPTY}
        medications={[{ id: 1, medication_name: 'Ibuprofen' }]}
        fetchConditionMedications={noop}
      />
    ),
  },
  {
    name: 'LabResultEncounterRelationships',
    render: () => (
      <LabResultEncounterRelationships
        labResultId={1}
        labResultEncounters={EMPTY}
        encounters={[{ id: 1, reason: 'Checkup', date: '2026-01-01' }]}
        fetchLabResultEncounters={noop}
      />
    ),
  },
  {
    name: 'LabResultMedicationRelationships',
    render: () => (
      <LabResultMedicationRelationships
        labResultId={1}
        labResultMedications={EMPTY}
        medications={[{ id: 1, medication_name: 'Ibuprofen' }]}
        fetchLabResultMedications={noop}
      />
    ),
  },
  {
    name: 'LabResultProcedureRelationships',
    render: () => (
      <LabResultProcedureRelationships
        labResultId={1}
        labResultProcedures={EMPTY}
        procedures={[{ id: 1, procedure_name: 'Appendectomy' }]}
        fetchLabResultProcedures={noop}
      />
    ),
  },
  {
    name: 'LabResultTreatmentRelationships',
    render: () => (
      <LabResultTreatmentRelationships
        labResultId={1}
        labResultTreatments={EMPTY}
        treatments={[{ id: 1, treatment_name: 'Physio plan' }]}
        fetchLabResultTreatments={noop}
      />
    ),
  },
  {
    name: 'TreatmentEquipmentRelationships',
    render: () => (
      <TreatmentEquipmentRelationships
        treatmentId={1}
        patientId={1}
        equipment={[
          { id: 1, equipment_name: 'CPAP', equipment_type: 'respiratory' },
        ]}
      />
    ),
  },
];

describe.each(cases)(
  '$name - Escape in its add modal',
  ({ render: element }) => {
    it('closes the add modal only, not the dialog it sits in', async () => {
      const onCloseParent = vi.fn();
      render(
        <Modal
          opened
          onClose={onCloseParent}
          title="parent dialog"
          zIndex={2000}
        >
          {element()}
        </Modal>
      );
      const user = userEvent.setup();

      // The component's own "add / link" button (the only enabled one that opens a modal)
      const open = await waitFor(() => {
        const button = screen
          .getAllByRole('button')
          .find(
            b =>
              !b.disabled &&
              /link|add/i.test(b.textContent ?? '') &&
              !/close/i.test(b.getAttribute('aria-label') ?? '')
          );
        expect(button).toBeDefined();
        return button;
      });
      await user.click(open);
      await waitFor(() =>
        expect(screen.getAllByRole('dialog')).toHaveLength(2)
      );

      await user.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.getAllByRole('dialog')).toHaveLength(1)
      );
      expect(onCloseParent).not.toHaveBeenCalled();
      expect(screen.getByText('parent dialog')).toBeInTheDocument();

      // With the add modal closed, Escape closes the dialog as before
      await user.keyboard('{Escape}');
      expect(onCloseParent).toHaveBeenCalledTimes(1);
    });
  }
);
