import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MedicationFormWrapper from '../MedicationFormWrapper';

vi.mock('../../MantineMedicationForm', () => ({
  default: ({ formError }) =>
    formError ? <p role="alert">{formError}</p> : null,
}));

vi.mock('../../../../services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// MedicationFormWrapper is memoized with its own prop comparison. A failed save
// changes only formError, so the comparison must count it or the error never
// shows (#1317).
describe('MedicationFormWrapper formError', () => {
  it('shows a save error that arrives after the form rendered', async () => {
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      onInputChange: vi.fn(),
      onSubmit: vi.fn(),
      navigate: vi.fn(),
      title: 'Add Medication',
      formData: { medication_name: 'X' },
    };
    const { rerender } = render(
      <MedicationFormWrapper {...props} formError={null} />
    );
    expect(screen.queryByText('Cannot save')).not.toBeInTheDocument();

    rerender(
      <MedicationFormWrapper
        {...props}
        formError="Medication Name: Must be at least 2 characters (Error: VAL-422)"
      />
    );

    expect(
      await screen.findByText(
        'Medication Name: Must be at least 2 characters (Error: VAL-422)'
      )
    ).toBeInTheDocument();
  });
});
