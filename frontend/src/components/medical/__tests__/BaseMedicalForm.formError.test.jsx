import { vi } from 'vitest';
import '@testing-library/jest-dom';
import render, { screen } from '../../../test-utils/render';
import BaseMedicalForm from '../BaseMedicalForm';

vi.mock('../../adapters', () => ({
  ResponsiveModal: ({ opened, children }) =>
    opened ? <div data-testid="modal">{children}</div> : null,
  DateInput: () => null,
}));

// BaseMedicalForm is memoized with its own prop comparison. A failed save
// changes only formError, so the comparison must count it or the error never
// shows (#1317).
describe('BaseMedicalForm formError', () => {
  it('shows a save error that arrives after the form rendered', async () => {
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      title: 'Add',
      formData: { name: 'X' },
      onInputChange: vi.fn(),
      onSubmit: vi.fn(),
      fields: [{ name: 'name', type: 'text', label: 'Name' }],
    };
    const { rerender } = render(
      <BaseMedicalForm {...props} formError={null} />
    );
    expect(screen.queryByText('Cannot save')).not.toBeInTheDocument();

    rerender(
      <BaseMedicalForm
        {...props}
        formError="Name: Must be at least 2 characters (Error: VAL-422)"
      />
    );

    expect(
      await screen.findByText(
        'Name: Must be at least 2 characters (Error: VAL-422)'
      )
    ).toBeInTheDocument();
  });
});
