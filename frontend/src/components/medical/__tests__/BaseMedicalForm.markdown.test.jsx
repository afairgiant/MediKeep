import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render, { screen } from '../../../test-utils/render';
import BaseMedicalForm from '../BaseMedicalForm';

vi.mock('../../adapters', () => ({
  ResponsiveModal: ({ opened, children }) =>
    opened ? <div data-testid="modal">{children}</div> : null,
  DateInput: () => null,
}));

Element.prototype.scrollIntoView = vi.fn();

describe('BaseMedicalForm markdown fields', () => {
  it('renders a markdown field as the notes editor and reports edits by field name', async () => {
    const onInputChange = vi.fn();
    render(
      <BaseMedicalForm
        isOpen
        onClose={vi.fn()}
        title="Add"
        formData={{ notes: 'rest' }}
        onInputChange={onInputChange}
        onSubmit={vi.fn()}
        fields={[{ name: 'notes', type: 'markdown', label: 'Notes' }]}
      />
    );

    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    textarea.setSelectionRange(0, 4);
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(onInputChange).toHaveBeenLastCalledWith({
      target: { name: 'notes', value: '**rest**' },
    });
  });
});
