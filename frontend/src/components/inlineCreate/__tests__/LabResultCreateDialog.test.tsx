import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import '../../../utils/nestedDialogStack';
import { SubDialogContext } from '../../../contexts/SubDialogContext';
import LabResultCreateDialog from '../LabResultCreateDialog';

const mocks = vi.hoisted(() => ({
  createLabResult: vi.fn(),
  submitComponents: vi.fn(),
  warn: vi.fn(),
  success: vi.fn(),
  // The test results the user has entered in the component rows
  pendingRows: [] as Array<{ test_name: string; value: number | '' }>,
}));

vi.mock('../../../services/api', () => ({
  apiService: { createLabResult: mocks.createLabResult },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hooks/useGlobalData', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../hooks/useGlobalData')>()),
  usePractitioners: () => ({ practitioners: [] }),
}));
vi.mock('../../../hooks/useTestNameAutocomplete', () => ({
  useTestNameAutocomplete: ({
    onFieldsChange,
  }: {
    onFieldsChange: (_f: { test_name: string }) => void;
  }) => ({
    nameOptions: [],
    handleChange: (value: string) => onFieldsChange({ test_name: value }),
    handleOptionSubmit: vi.fn(),
    handleClear: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock('../../../utils/labTestComponentUtils', () => ({
  submitPendingTestComponents: mocks.submitComponents,
}));
vi.mock('../../../utils/notifyTranslated', () => ({
  notifyWarning: mocks.warn,
  notifySuccess: mocks.success,
}));
// Stands in for the component rows: reports the pending results like the real rows do
vi.mock('../../medical/labresults/InlineTestComponentEntry', async () => {
  const { useEffect } = await import('react');
  const InlineTestComponentEntryMock = ({
    onRef,
  }: {
    onRef: (_m: unknown) => void;
  }) => {
    useEffect(() => {
      onRef({
        hasPendingComponents: () => mocks.pendingRows.length > 0,
        getPendingComponents: () => mocks.pendingRows,
        clearComponents: vi.fn(),
      });
      return () => onRef(null);
    }, [onRef]);
    return <div />;
  };
  return { default: InlineTestComponentEntryMock };
});

const renderDialog = (onCreated = vi.fn().mockResolvedValue('linked')) => {
  const onClose = vi.fn();
  render(
    <SubDialogContext.Provider value={{ zIndex: 2050 }}>
      <LabResultCreateDialog
        patientId={7}
        onCreated={onCreated}
        onClose={onClose}
      />
    </SubDialogContext.Provider>
  );
  return { onCreated, onClose };
};

const fillName = async () =>
  userEvent.type(
    screen.getAllByLabelText(/Lab Results Panel or Type|panelName/i)[0],
    'Metabolic panel'
  );

beforeEach(() => {
  vi.clearAllMocks();
  // One pending test result, as if the user had entered it
  mocks.pendingRows = [{ test_name: 'Glucose', value: 5 }];
  mocks.createLabResult.mockResolvedValue({
    id: 321,
    test_name: 'Metabolic panel',
  });
  mocks.submitComponents.mockResolvedValue(undefined);
});

describe('LabResultCreateDialog', () => {
  it('has no Simple/Advanced switch', () => {
    renderDialog();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('creates the panel for the patient, saves its components, links it and closes', async () => {
    const { onCreated, onClose } = renderDialog();
    await fillName();
    await userEvent.click(
      screen.getByRole('button', { name: /createButton|Create/i })
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.createLabResult).toHaveBeenCalledTimes(1);
    expect(mocks.createLabResult.mock.calls[0][0]).toMatchObject({
      test_name: 'Metabolic panel',
      patient_id: 7,
      is_panel: true,
    });
    expect(mocks.submitComponents).toHaveBeenCalledWith(
      321,
      [{ test_name: 'Glucose', value: 5 }],
      7,
      'TestPanelCreateDialog',
      expect.any(Function)
    );
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 321 })
    );
    expect(mocks.success).toHaveBeenCalledWith(
      'common:inlineCreate.createdLinked'
    );
  });

  it('keeps the lab result and closes when linking fails, so it cannot be created twice', async () => {
    const { onClose } = renderDialog(
      vi.fn().mockRejectedValue(new Error('boom'))
    );
    await fillName();
    await userEvent.click(
      screen.getByRole('button', { name: /createButton|Create/i })
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.createLabResult).toHaveBeenCalledTimes(1);
    expect(mocks.warn).toHaveBeenCalledWith('common:inlineCreate.linkFailed');
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('keeps Save Results inactive without a name, and creates nothing', async () => {
    const { onClose } = renderDialog();
    const save = screen.getByRole('button', { name: /createButton|Create/i });
    expect(save).toBeDisabled();
    await userEvent.click(save);
    expect(mocks.createLabResult).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps Save Results inactive until a test result is entered (#1128)', async () => {
    mocks.pendingRows = [];
    const { onClose } = renderDialog();
    await fillName();
    const save = screen.getByRole('button', { name: /createButton|Create/i });

    expect(save).toBeDisabled();
    expect(
      screen.getByText(/testResultRequired|At least one/)
    ).toBeInTheDocument();
    await userEvent.click(save);
    expect(mocks.createLabResult).not.toHaveBeenCalled();
    expect(mocks.submitComponents).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('activates Save Results with a name and a test result, even without a value', async () => {
    mocks.pendingRows = [{ test_name: 'Glucose', value: '' }];
    renderDialog();
    await fillName();
    expect(
      screen.getByRole('button', { name: /createButton|Create/i })
    ).toBeEnabled();
  });

  it('ignores Escape while the save is running, so it cannot be created twice', async () => {
    let finish: (_r: unknown) => void = () => {};
    mocks.createLabResult.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const { onClose } = renderDialog();
    await fillName();
    await userEvent.click(
      screen.getByRole('button', { name: /createButton|Create/i })
    );
    await waitFor(() => expect(mocks.createLabResult).toHaveBeenCalledTimes(1));

    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    finish({ id: 321, test_name: 'Metabolic panel' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.createLabResult).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape when idle', async () => {
    const { onClose } = renderDialog();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.createLabResult).not.toHaveBeenCalled();
  });
});
