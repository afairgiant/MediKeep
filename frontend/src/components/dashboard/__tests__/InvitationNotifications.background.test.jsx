import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import render from '../../../test-utils/render';
import InvitationNotifications from '../InvitationNotifications';
import invitationApi from '../../../services/api/invitationApi';

vi.mock('../../../services/api/invitationApi', () => ({
  __esModule: true,
  default: {
    getPendingInvitations: vi.fn(() => Promise.resolve([])),
    respondToInvitation: vi.fn(),
  },
}));

vi.mock('../../invitations', () => ({
  InvitationManager: () => null,
}));

vi.mock('../../medical', () => ({
  PatientSharingModal: () => null,
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  useCacheManager: () => ({ invalidatePatientList: vi.fn() }),
  useCurrentPatient: () => ({ patient: null, isLoading: false }),
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * The mount load and the 2-minute refresh share one loadPendingInvitations, so
 * a URL-matched exemption could not tell them apart and exempted both. Only the
 * timer is unattended; the mount load must still eject on a 401.
 */
describe('InvitationNotifications background declaration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invitationApi.getPendingInvitations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const lastBackground = () => {
    const [, options] = invitationApi.getPendingInvitations.mock.calls.at(-1);
    return options?.background;
  };

  test('the mount load is not background', async () => {
    render(<InvitationNotifications />);

    await waitFor(() =>
      expect(invitationApi.getPendingInvitations).toHaveBeenCalled()
    );

    expect(lastBackground()).toBeFalsy();
  });

  test('the 2-minute refresh is background', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<InvitationNotifications />);

    await waitFor(() =>
      expect(invitationApi.getPendingInvitations).toHaveBeenCalled()
    );
    invitationApi.getPendingInvitations.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(120000);
    });

    expect(invitationApi.getPendingInvitations).toHaveBeenCalled();
    expect(lastBackground()).toBe(true);
  });
});
