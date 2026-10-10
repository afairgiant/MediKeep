import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render from '../../../test-utils/render';
import MantineMedicationForm from '../MantineMedicationForm';
import { InlineCreateProvider } from '../../../contexts/InlineCreateContext';

/**
 * Add Medication -> Link -> Lab Results -> "+ Add lab result" opens the same Add Lab
 * Result dialog as the Lab Results page. A lab result needs at least one test result
 * (a test name; the value may be left empty for a test that is ordered but not resulted
 * yet), so Save Results stays inactive, and nothing is created, while the lower section is
 * empty (#1128).
 */
vi.setConfig({ testTimeout: 30000 });

const api = vi.hoisted(() => {
  const base = {
    createLabResult: vi.fn(),
    getPatientLabResults: vi.fn(() => Promise.resolve([])),
  };
  // Any other API call the form makes answers with an empty list
  return new Proxy(base, {
    get: (target, prop) =>
      prop in target ? target[prop] : vi.fn(() => Promise.resolve([])),
  });
});
const components = vi.hoisted(() => ({ createBulkForLabResult: vi.fn() }));

vi.mock('../../../services/api', () => ({ apiService: api }));
vi.mock('../../../services/api/labTestComponentApi', () => ({
  labTestComponentApi: components,
}));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({ canCreate: true, isViewOnly: false }),
}));
vi.mock('../../../hooks/useGlobalData', async importOriginal => ({
  ...(await importOriginal()),
  usePractitioners: () => ({ practitioners: [] }),
}));
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: vi.fn(),
    formatDate: date => date,
  }),
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));
vi.mock('../practitioners/PractitionerSelectWithCreate', () => ({
  default: () => null,
}));
vi.mock('../../common/TagInput', () => ({ TagInput: () => null }));

const CREATE = 'medical:labResults.addPanel.createButton';
const REQUIRED = 'At least one test result is required';

const openAddLabResultDialog = async user => {
  render(
    <InlineCreateProvider>
      <MantineMedicationForm
        isOpen
        onClose={vi.fn()}
        title="Medication"
        formData={{
          medication_name: 'Aspirin',
          tags: [],
          reminder_times: [],
          pending_lab_result_links: [],
        }}
        onInputChange={vi.fn()}
        onSubmit={vi.fn()}
        practitioners={[]}
        pharmacies={[]}
        patientId={7}
        navigate={vi.fn()}
      />
    </InlineCreateProvider>
  );
  await user.click(screen.getByRole('button', { name: 'common:buttons.link' }));
  await user.click(
    await screen.findByRole('menuitem', { name: 'shared:tabs.labResults' })
  );
  await user.click(
    await screen.findByRole('button', {
      name: 'common:inlineCreate.add.labResult',
    })
  );
  await user.type(
    await screen.findByPlaceholderText(
      'medical:labResults.addPanel.panelNamePlaceholder'
    ),
    'Test 1LB'
  );
};

beforeEach(() => {
  api.createLabResult.mockReset().mockResolvedValue({
    id: 5,
    test_name: 'Test 1LB',
  });
  components.createBulkForLabResult
    .mockReset()
    .mockResolvedValue({ created_count: 1, errors: [] });
});

describe('Add Medication - Link - Lab Results - Add lab result', () => {
  it('keeps Save Results inactive, and says why, while no test result has been entered', async () => {
    const user = userEvent.setup();
    await openAddLabResultDialog(user);
    const save = screen.getByRole('button', { name: CREATE });

    expect(save).toBeDisabled();
    expect(await screen.findByText(REQUIRED)).toBeInTheDocument();
    await user.click(save);
    expect(api.createLabResult).not.toHaveBeenCalled();
    expect(components.createBulkForLabResult).not.toHaveBeenCalled();
  });

  it('creates the lab result with its test result once one is entered', async () => {
    const user = userEvent.setup();
    await openAddLabResultDialog(user);
    await user.type(
      screen.getByPlaceholderText('Type to search tests...'),
      'Hemoglobin'
    );
    await user.click(screen.getByRole('button', { name: CREATE }));

    await waitFor(() => expect(api.createLabResult).toHaveBeenCalledTimes(1));
    expect(api.createLabResult.mock.calls[0][0]).toMatchObject({
      test_name: 'Test 1LB',
      patient_id: 7,
      is_panel: true,
    });
    await waitFor(() =>
      expect(components.createBulkForLabResult).toHaveBeenCalledTimes(1)
    );
    const [labResultId, rows] = components.createBulkForLabResult.mock.calls[0];
    expect(labResultId).toBe(5);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ test_name: 'Hemoglobin', value: null });
  });
});
