import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import notificationApi from '../../services/api/notificationApi';
import { useReminderChannelStatus } from '../useReminderChannelStatus';

vi.mock('../../services/api/notificationApi', () => ({
  default: { getPreferenceMatrix: vi.fn() },
}));

const getMatrix = vi.mocked(notificationApi.getPreferenceMatrix);
const withChannel = (on: boolean) => ({
  preferences: { medication_reminder: { email: on } },
});

beforeEach(() => {
  getMatrix.mockReset();
});

describe('useReminderChannelStatus', () => {
  it('clears the warning when the user returns after turning a channel on', async () => {
    getMatrix.mockResolvedValueOnce(withChannel(false));
    const { result } = renderHook(() =>
      useReminderChannelStatus('medication_reminder', true)
    );
    await waitFor(() => expect(result.current[0]).toBe(false));

    getMatrix.mockResolvedValueOnce(withChannel(true));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(result.current[0]).toBe(true));
  });

  it('does not check on focus while inactive', () => {
    renderHook(() => useReminderChannelStatus('medication_reminder', false));
    window.dispatchEvent(new Event('focus'));
    expect(getMatrix).not.toHaveBeenCalled();
  });

  it('does not check on focus once a channel is on', async () => {
    getMatrix.mockResolvedValue(withChannel(true));
    renderHook(() => useReminderChannelStatus('medication_reminder', true));
    await waitFor(() => expect(getMatrix).toHaveBeenCalledTimes(1));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(getMatrix).toHaveBeenCalledTimes(1);
  });

  it('stops checking on focus once unmounted', async () => {
    getMatrix.mockResolvedValue(withChannel(false));
    const { unmount } = renderHook(() =>
      useReminderChannelStatus('medication_reminder', true)
    );
    await waitFor(() => expect(getMatrix).toHaveBeenCalledTimes(1));
    unmount();
    window.dispatchEvent(new Event('focus'));
    expect(getMatrix).toHaveBeenCalledTimes(1);
  });
});
