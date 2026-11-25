import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Modal } from '@mantine/core';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import render from '../../../test-utils/render';
import { DateInput } from '../DateInput';

const CALENDAR_BUTTON = 'buttons.openCalendar';

const mockPointer = (coarse: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const inputDropdown = () => document.querySelector('[data-dates-dropdown]');

const openPicker = async () => {
  fireEvent.click(screen.getByRole('button', { name: CALENDAR_BUTTON }));
  return screen.findByRole('dialog');
};

// Popover dropdowns are briefly inaccessible while transitioning, so role queries miss them
const pickerClosed = () =>
  waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

const dayButton = (picker: HTMLElement, day: number): HTMLButtonElement => {
  const match = Array.from(picker.querySelectorAll('button')).find(
    button =>
      button.textContent === String(day) && !button.hasAttribute('data-outside')
  );
  if (!match) throw new Error(`Day ${day} not rendered in the picker`);
  return match;
};

describe('DateInput adapter', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders a labelled calendar button', () => {
    render(<DateInput label="Start" value={null} onChange={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: CALENDAR_BUTTON })
    ).toBeInTheDocument();
  });

  it('opens the picker from the button without focusing the text field', async () => {
    render(<DateInput label="Start" value={null} onChange={vi.fn()} />);

    await openPicker();

    expect(screen.getByLabelText('Start')).not.toHaveFocus();
  });

  it('passes the picked day to onChange and closes the picker', async () => {
    const onChange = vi.fn();
    render(<DateInput label="Start" value="2024-03-10" onChange={onChange} />);

    const picker = await openPicker();
    fireEvent.click(dayButton(picker, 15));

    expect(onChange).toHaveBeenCalledWith('2024-03-15');
    await pickerClosed();
  });

  it('shows the picked day in the field when uncontrolled', async () => {
    render(<DateInput label="Start" defaultValue="2024-03-10" />);

    const picker = await openPicker();
    fireEvent.click(dayButton(picker, 15));

    await waitFor(() =>
      expect(screen.getByLabelText('Start')).toHaveValue('03/15/2024')
    );
  });

  it('keeps a controlled parent in sync with the picked day', async () => {
    const Controlled = () => {
      const [value, setValue] = useState<string | null>('2024-03-10');
      return <DateInput label="Start" value={value} onChange={setValue} />;
    };
    render(<Controlled />);

    const picker = await openPicker();
    fireEvent.click(dayButton(picker, 20));

    await waitFor(() =>
      expect(screen.getByLabelText('Start')).toHaveValue('03/20/2024')
    );
  });

  it('disables days outside minDate and maxDate in the picker', async () => {
    render(
      <DateInput
        label="Start"
        value="2024-03-10"
        onChange={vi.fn()}
        minDate="2024-03-05"
        maxDate="2024-03-20"
      />
    );

    const picker = await openPicker();

    expect(dayButton(picker, 4)).toBeDisabled();
    expect(dayButton(picker, 21)).toBeDisabled();
    expect(dayButton(picker, 12)).not.toBeDisabled();
  });

  it('clears a clearable field when the selected day is picked again', async () => {
    const onChange = vi.fn();
    render(
      <DateInput
        label="Start"
        value="2024-03-10"
        onChange={onChange}
        clearable
      />
    );

    const picker = await openPicker();
    fireEvent.click(dayButton(picker, 10));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does not close an enclosing modal when Escape is pressed in the picker', async () => {
    const onClose = vi.fn();
    render(
      <Modal opened onClose={onClose} title="Form">
        <DateInput label="Start" value="2024-03-10" onChange={vi.fn()} />
      </Modal>
    );

    fireEvent.click(
      await screen.findByRole('button', { name: CALENDAR_BUTTON })
    );
    const picker = await waitFor(() => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      expect(dialogs).toHaveLength(2);
      return dialogs[1];
    });
    fireEvent.keyDown(dayButton(picker, 15), { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes an open picker when the field becomes disabled', async () => {
    const { rerender } = render(
      <DateInput label="Start" value="2024-03-10" onChange={vi.fn()} />
    );
    await openPicker();

    rerender(
      <DateInput label="Start" value="2024-03-10" onChange={vi.fn()} disabled />
    );

    await pickerClosed();
  });

  it.each(['disabled', 'readOnly'])(
    'disables the calendar button when the field is %s',
    flag => {
      render(
        <DateInput
          label="Start"
          value={null}
          onChange={vi.fn()}
          {...{ [flag]: true }}
        />
      );

      expect(
        screen.getByRole('button', { name: CALENDAR_BUTTON })
      ).toBeDisabled();
    }
  );

  it('opens the inline calendar on focus with a fine pointer', async () => {
    render(<DateInput label="Start" value={null} onChange={vi.fn()} />);

    fireEvent.focus(screen.getByLabelText('Start'));

    await waitFor(() => expect(inputDropdown()).toBeInTheDocument());
  });

  it('does not open the inline calendar on focus with a coarse pointer', async () => {
    mockPointer(true);
    render(<DateInput label="Start" value={null} onChange={vi.fn()} />);

    fireEvent.focus(screen.getByLabelText('Start'));
    fireEvent.click(screen.getByLabelText('Start'));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(inputDropdown()).not.toBeInTheDocument();
  });

  it('still opens the picker from the button with a coarse pointer', async () => {
    mockPointer(true);
    render(<DateInput label="Start" value={null} onChange={vi.fn()} />);

    expect(await openPicker()).toBeInTheDocument();
  });
});
