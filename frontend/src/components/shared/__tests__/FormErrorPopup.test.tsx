import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Button, Modal, Tabs, TextInput } from '@mantine/core';
import render from '../../../test-utils/render';
import RecordForm from '../RecordForm';
import FormErrorPopup from '../FormErrorPopup';

const FIELD_MESSAGE = 'Injury Name on the Basic Info tab is required.';
const SERVER_MESSAGE =
  'Injury Name: Must be at least 2 characters (Error: VAL-422)';
const PAGE_CHECK_MESSAGE = 'Systolic must be greater than diastolic';

interface RecordDialogProps {
  onClose?: () => void;
  error?: string | null;
  injuryName?: string;
}

// Shaped like the Injury dialog: the required field on Basic Info, the user on Files
const RecordDialog = ({
  onClose = vi.fn(),
  error = null,
  injuryName = '',
}: RecordDialogProps) => {
  const [tab, setTab] = useState<string | null>('files');
  return (
    <Modal opened onClose={onClose} title="Add New Injury">
      <RecordForm onSubmit={event => event.preventDefault()}>
        <FormErrorPopup error={error} />
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="basic">Basic Info</Tabs.Tab>
            <Tabs.Tab value="files">Files</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="basic">
            <TextInput label="Injury Name" required defaultValue={injuryName} />
          </Tabs.Panel>
          <Tabs.Panel value="files">No files yet</Tabs.Panel>
        </Tabs>
        <Button type="submit">Save</Button>
      </RecordForm>
    </Modal>
  );
};

const clickSave = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

const clickOk = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'OK' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument()
  );
};

// Like a page whose own form check fails, setting the same message each time
const PageCheckDialog = () => {
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal opened onClose={vi.fn()} title="Add Vitals">
      <RecordForm
        onSubmit={event => {
          event.preventDefault();
          setError(PAGE_CHECK_MESSAGE);
        }}
      >
        <FormErrorPopup error={error} />
        <Button type="submit">Save</Button>
      </RecordForm>
    </Modal>
  );
};

describe('FormErrorPopup', () => {
  it('says which field in a popup, and puts the cursor in it on OK', async () => {
    render(<RecordDialog />);

    clickSave();

    expect(await screen.findByText(FIELD_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText('Cannot save')).toBeInTheDocument();

    await clickOk();

    const injuryName = screen.getByRole('textbox', { name: /Injury Name/ });
    expect(injuryName).toBeVisible();
    await waitFor(() => expect(injuryName).toHaveFocus());
  });

  it('opens again when the next Save fails the same way', async () => {
    render(<RecordDialog />);

    clickSave();
    await clickOk();
    clickSave();

    expect(await screen.findByText(FIELD_MESSAGE)).toBeInTheDocument();
  });

  it('closes on Escape without closing the form underneath', async () => {
    const onClose = vi.fn();
    render(<RecordDialog onClose={onClose} />);

    clickSave();
    await screen.findByText(FIELD_MESSAGE);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    await waitFor(() =>
      expect(screen.queryByText(FIELD_MESSAGE)).not.toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Add New Injury')).toBeInTheDocument();
  });

  it("opens again when the page's own check fails the same way on the next Save", async () => {
    render(<PageCheckDialog />);

    clickSave();
    expect(await screen.findByText(PAGE_CHECK_MESSAGE)).toBeInTheDocument();
    await clickOk();
    clickSave();

    expect(await screen.findByText(PAGE_CHECK_MESSAGE)).toBeInTheDocument();
  });

  it('shows a save error from the server, and again when it repeats', async () => {
    const { rerender } = render(<RecordDialog error={SERVER_MESSAGE} />);

    expect(await screen.findByText(SERVER_MESSAGE)).toBeInTheDocument();
    await clickOk();

    // A new save clears the error, then fails with the same message
    rerender(<RecordDialog error={null} />);
    rerender(<RecordDialog error={SERVER_MESSAGE} />);

    expect(await screen.findByText(SERVER_MESSAGE)).toBeInTheDocument();
  });
});
