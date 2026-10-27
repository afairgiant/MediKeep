import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import render from '../../test-utils/render';

vi.mock('../adapters/ResponsiveModal', () => ({
  ResponsiveModal: ({
    opened,
    title,
    onClose,
    children,
  }: {
    opened: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }) =>
    opened ? (
      <div role="dialog" aria-label={title}>
        <button onClick={onClose}>escape</button>
        {children}
      </div>
    ) : null,
}));

import BackupCodesModal from './BackupCodesModal';

const CODES = ['AAAA-BBBB', 'CCCC-DDDD', 'EEEE-FFFF'];
const onClose = vi.fn();

const renderModal = () =>
  render(<BackupCodesModal opened codes={CODES} onClose={onClose} />);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BackupCodesModal', () => {
  test('lists every code', () => {
    renderModal();

    expect(screen.getAllByRole('listitem').map(el => el.textContent)).toEqual(
      CODES
    );
  });

  test('cannot be closed until the user confirms they saved the codes', async () => {
    renderModal();
    const done = screen.getByRole('button', {
      name: 'security.twoFactor.backupCodes.done',
    });

    expect(done).toBeDisabled();
    await userEvent.click(screen.getByText('escape'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByLabelText('security.twoFactor.backupCodes.acknowledge')
    );
    await userEvent.click(done);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('downloads the codes as a text file', async () => {
    const createObjectURL = vi.fn(() => 'blob:codes');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    renderModal();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'security.twoFactor.backupCodes.download',
      })
    );

    const blob = createObjectURL.mock.calls[0][0] as unknown as Blob;
    const text = await blob.text();
    expect(text).toContain('AAAA-BBBB\nCCCC-DDDD\nEEEE-FFFF');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
