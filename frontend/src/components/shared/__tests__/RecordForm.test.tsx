import { useState } from 'react';
import type { FormEventHandler } from 'react';
import { createPortal } from 'react-dom';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Button, Select, Tabs, TextInput } from '@mantine/core';
import render from '../../../test-utils/render';
import RecordForm from '../RecordForm';
import FormErrorPopup from '../FormErrorPopup';

interface TestFormProps {
  onSubmit: FormEventHandler<HTMLFormElement>;
  injuryName?: string;
  status?: string | null;
  withDialogForm?: boolean;
  serverError?: string | null;
}

// Shaped like the record forms: required fields on Basic Info, the user on Files
const TestForm = ({
  onSubmit,
  injuryName = '',
  status = null,
  withDialogForm = false,
  serverError = null,
}: TestFormProps) => {
  const [tab, setTab] = useState<string | null>('files');
  return (
    <RecordForm
      onSubmit={event => {
        event.preventDefault();
        onSubmit(event);
      }}
    >
      <FormErrorPopup error={serverError} />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="basic">Basic Info</Tabs.Tab>
          <Tabs.Tab value="files">Files</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="basic">
          <TextInput label="Injury Name" required defaultValue={injuryName} />
          <Select
            label="Status"
            required
            data={['active', 'resolved']}
            defaultValue={status}
          />
        </Tabs.Panel>
        <Tabs.Panel value="files">
          {/* Like the New practitioner dialog: its own form, in a portal */}
          {withDialogForm &&
            createPortal(
              <form onSubmit={event => event.preventDefault()}>
                <button type="submit">Save practitioner</button>
              </form>,
              document.body
            )}
        </Tabs.Panel>
      </Tabs>
      <Button type="submit">Save</Button>
    </RecordForm>
  );
};

const clickOk = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'OK' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument()
  );
};

describe('RecordForm', () => {
  it('opens the tab of an empty required field and says which field', async () => {
    const onSubmit = vi.fn();
    render(<TestForm onSubmit={onSubmit} status="active" />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Injury Name on the Basic Info tab is required.')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /Injury Name/ })).toBeVisible();
  });

  it('checks a required Select, which the browser skips', async () => {
    const onSubmit = vi.fn();
    render(<TestForm onSubmit={onSubmit} injuryName="Sprain" />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Status on the Basic Info tab is required.')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("says what is wrong with a badly filled field in the app's words, not the browser's", async () => {
    render(
      <RecordForm onSubmit={vi.fn()}>
        <FormErrorPopup />
        <TextInput label="Email" type="email" defaultValue="not-an-email" />
        <Button type="submit">Save</Button>
      </RecordForm>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Email: Please enter a valid email address.')
    ).toBeInTheDocument();
  });

  it('submits when every required field is filled in', () => {
    const onSubmit = vi.fn();
    render(
      <TestForm onSubmit={onSubmit} injuryName="Sprain" status="active" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Cannot save')).not.toBeInTheDocument();
  });

  it('keeps a refused submit from reaching a form it is nested in', async () => {
    const outerSubmit = vi.fn();
    const innerSubmit = vi.fn();
    render(
      <RecordForm onSubmit={outerSubmit}>
        <TextInput label="Treatment Name" required defaultValue="Physio" />
        {createPortal(
          <RecordForm onSubmit={innerSubmit}>
            <FormErrorPopup />
            <TextInput label="Medication Name" required />
            <Button type="submit">Save medication</Button>
          </RecordForm>,
          document.body
        )}
      </RecordForm>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save medication' }));

    expect(
      await screen.findByText('Medication Name is required.')
    ).toBeInTheDocument();
    expect(innerSubmit).not.toHaveBeenCalled();
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  it('lets the submit of a dialog opened from the form through unchecked', async () => {
    const serverError = 'Status: Status must be one of: active, resolved';
    const onSubmit = vi.fn();
    render(
      <TestForm onSubmit={onSubmit} serverError={serverError} withDialogForm />
    );
    await screen.findByText(serverError);
    await clickOk();

    fireEvent.click(screen.getByRole('button', { name: 'Save practitioner' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Not a Save of this form, so its earlier error does not come back
    await expect(
      screen.findByText(serverError, {}, { timeout: 300 })
    ).rejects.toThrow();
  });
});
