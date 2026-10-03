import { vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useInlineCreateFlow } from '../useInlineCreateFlow';

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const baseOptions = () => ({
  entity: 'test',
  initialData: { name: 'x' },
  validate: () => null,
  buildPayload: () => ({ name: 'x' }),
  create: vi.fn().mockResolvedValue({ id: 9 }),
  patientId: 1,
  onCreated: vi.fn().mockResolvedValue('linked'),
  onClose: vi.fn(),
});

describe('useInlineCreateFlow', () => {
  it('stays usable when building the payload throws', async () => {
    const options = baseOptions();
    let shouldThrow = true;
    options.buildPayload = () => {
      if (shouldThrow) throw new Error('bad form value');
      return { name: 'x' };
    };
    const { result } = renderHook(() => useInlineCreateFlow(options));

    await act(async () => {
      await result.current.handleSubmit();
    });

    // Nothing was created, the dialog is not stuck busy, and the user sees an error
    expect(options.create).not.toHaveBeenCalled();
    expect(options.onClose).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeTruthy();

    // A later submit works and the Escape guard (close) is not locked out
    shouldThrow = false;
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(options.create).toHaveBeenCalledTimes(1);
    expect(options.onClose).toHaveBeenCalledTimes(1);
  });
});
