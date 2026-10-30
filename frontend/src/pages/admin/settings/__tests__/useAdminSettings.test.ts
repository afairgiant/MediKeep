import { vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { adminApiService } from '../../../../services/api/adminApi';
import { authService } from '../../../../services/auth/simpleAuthService';
import { useAdminSettings } from '../useAdminSettings';
import { makeResponse, makeSchedule, makeSettings } from './fixtures';

const api = adminApiService as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApiService, 'getAdminSettings').mockResolvedValue(
    makeResponse()
  );
  vi.spyOn(adminApiService, 'getAutoBackupSchedule').mockResolvedValue(
    makeSchedule()
  );
  vi.spyOn(adminApiService, 'updateAdminSettings');
  vi.spyOn(adminApiService, 'updateAutoBackupSchedule');
  vi.spyOn(authService, 'getSSOConfig').mockResolvedValue({ enabled: false });
});

const loaded = async () => {
  const hook = renderHook(() => useAdminSettings());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

test('starts with nothing unsaved', async () => {
  const { result } = await loaded();

  expect(result.current.unsavedCount).toBe(0);
  expect(result.current.dirtyKeys).toEqual([]);
});

test('an edit is tracked and editing it back clears it', async () => {
  const { result } = await loaded();

  act(() => result.current.setValue('trash_retention_days', 14));
  expect(result.current.dirtyKeys).toEqual(['trash_retention_days']);

  act(() => result.current.setValue('trash_retention_days', 30));
  expect(result.current.dirtyKeys).toEqual([]);
});

test('discard returns every field to the saved value', async () => {
  const { result } = await loaded();

  act(() => {
    result.current.setValue('trash_retention_days', 14);
    result.current.updateSchedule({ preset: 'weekly' });
  });
  expect(result.current.unsavedCount).toBe(2);

  act(() => result.current.discard());
  expect(result.current.unsavedCount).toBe(0);
  expect(result.current.draft?.trash_retention_days).toBe(30);
});

test('save sends only the changed keys', async () => {
  api.updateAdminSettings.mockResolvedValue({
    settings: makeSettings({
      trash_retention_days: { value: 14, source: 'saved' },
    }),
    updated: ['trash_retention_days'],
    warnings: [],
  });
  const { result } = await loaded();

  act(() => result.current.setValue('trash_retention_days', 14));
  let ok = false;
  await act(async () => {
    ok = await result.current.save();
  });

  expect(ok).toBe(true);
  expect(api.updateAdminSettings).toHaveBeenCalledWith({
    trash_retention_days: 14,
  });
  expect(api.updateAutoBackupSchedule).not.toHaveBeenCalled();
  expect(result.current.settings?.trash_retention_days.source).toBe('saved');
  expect(result.current.unsavedCount).toBe(0);
});

test('a staged reset is sent as null', async () => {
  api.getAdminSettings.mockResolvedValue(
    makeResponse({
      trash_retention_days: { value: 9, source: 'saved', fallback: 30 },
    })
  );
  api.updateAdminSettings.mockResolvedValue({
    settings: makeSettings(),
    updated: ['trash_retention_days'],
    warnings: [],
  });
  const { result } = await loaded();

  act(() => result.current.reset('trash_retention_days'));
  expect(result.current.draft?.trash_retention_days).toBe(30);
  expect(result.current.dirtyKeys).toEqual(['trash_retention_days']);

  await act(async () => {
    await result.current.save();
  });
  expect(api.updateAdminSettings).toHaveBeenCalledWith({
    trash_retention_days: null,
  });
});

test('editing after a reset sends the edited value instead', async () => {
  api.getAdminSettings.mockResolvedValue(
    makeResponse({
      trash_retention_days: { value: 9, source: 'saved', fallback: 30 },
    })
  );
  api.updateAdminSettings.mockResolvedValue({
    settings: makeSettings(),
    updated: [],
    warnings: [],
  });
  const { result } = await loaded();

  act(() => result.current.reset('trash_retention_days'));
  act(() => result.current.setValue('trash_retention_days', 12));
  await act(async () => {
    await result.current.save();
  });

  expect(api.updateAdminSettings).toHaveBeenCalledWith({
    trash_retention_days: 12,
  });
});

test('a failed settings save keeps every edit and skips the schedule', async () => {
  api.updateAdminSettings.mockRejectedValue(new Error('Request failed'));
  const { result } = await loaded();

  act(() => {
    result.current.setValue('trash_retention_days', 14);
    result.current.updateSchedule({ preset: 'weekly' });
  });
  let ok = true;
  await act(async () => {
    ok = await result.current.save();
  });

  expect(ok).toBe(false);
  expect(result.current.saveError?.scope).toBe('settings');
  expect(api.updateAutoBackupSchedule).not.toHaveBeenCalled();
  expect(result.current.unsavedCount).toBe(2);
});

test('a failed schedule save keeps only the schedule unsaved', async () => {
  api.updateAdminSettings.mockResolvedValue({
    settings: makeSettings({
      trash_retention_days: { value: 14, source: 'saved' },
    }),
    updated: ['trash_retention_days'],
    warnings: [],
  });
  api.updateAutoBackupSchedule.mockRejectedValue(new Error('Request failed'));
  const { result } = await loaded();

  act(() => {
    result.current.setValue('trash_retention_days', 14);
    result.current.updateSchedule({ preset: 'weekly' });
  });
  await act(async () => {
    await result.current.save();
  });

  expect(result.current.saveError?.scope).toBe('schedule');
  expect(result.current.dirtyKeys).toEqual([]);
  expect(result.current.scheduleDirty).toBe(true);
});

test('a failed schedule-only save does not claim other changes were saved', async () => {
  api.updateAutoBackupSchedule.mockRejectedValue(new Error('Request failed'));
  const { result } = await loaded();

  act(() => result.current.updateSchedule({ preset: 'weekly' }));
  await act(async () => {
    await result.current.save();
  });

  expect(api.updateAdminSettings).not.toHaveBeenCalled();
  expect(result.current.saveError?.scope).toBe('scheduleOnly');
});

test.each([
  [{ preset: 'interval' as const, interval_hours: 3 }, { interval_hours: 3 }],
  [
    {
      preset: 'weekly' as const,
      days_of_week: ['mon' as const, 'fri' as const],
    },
    { days_of_week: ['mon', 'fri'] },
  ],
  [{ preset: 'monthly' as const, day_of_month: 15 }, { day_of_month: 15 }],
  [{ preset: 'disabled' as const }, {}],
])(
  'the schedule payload carries only the field the preset uses (%o)',
  async (patch, expected) => {
    api.updateAutoBackupSchedule.mockResolvedValue({ schedule: {} });
    const { result } = await loaded();

    act(() => result.current.updateSchedule(patch));
    await act(async () => {
      await result.current.save();
    });

    expect(api.updateAutoBackupSchedule).toHaveBeenCalledWith({
      preset: patch.preset,
      time_of_day: '02:00',
      ...expected,
    });
  }
);

test('time changes do not count for presets that ignore the time', async () => {
  api.getAutoBackupSchedule.mockResolvedValue(
    makeSchedule({ preset: 'interval' })
  );
  const { result } = await loaded();

  act(() => result.current.updateSchedule({ time_of_day: '05:00' }));

  expect(result.current.scheduleDirty).toBe(false);
});

test('fields another preset uses do not count as changes', async () => {
  const { result } = await loaded();

  act(() =>
    result.current.updateSchedule({ interval_hours: 4, day_of_month: 9 })
  );

  expect(result.current.scheduleDirty).toBe(false);
});

test.each([
  [{ preset: 'interval' as const, interval_hours: 0 }, 'range'],
  [{ preset: 'interval' as const, interval_hours: '' as const }, 'range'],
  [{ preset: 'interval' as const, interval_hours: 169 }, 'range'],
  [{ preset: 'weekly' as const, days_of_week: [] }, 'noDays'],
  [{ preset: 'monthly' as const, day_of_month: 29 }, 'range'],
])('an invalid schedule draft blocks saving (%o)', async (patch, code) => {
  const { result } = await loaded();

  act(() => result.current.updateSchedule(patch));
  expect(result.current.scheduleError?.code).toBe(code);
  expect(result.current.canSave).toBe(false);

  let ok = true;
  await act(async () => {
    ok = await result.current.save();
  });
  expect(ok).toBe(false);
  expect(api.updateAutoBackupSchedule).not.toHaveBeenCalled();
});

test('an empty field of another preset does not block saving', async () => {
  api.updateAutoBackupSchedule.mockResolvedValue({ schedule: {} });
  const { result } = await loaded();

  act(() => result.current.updateSchedule({ preset: 'interval' }));
  act(() => result.current.updateSchedule({ interval_hours: '' }));
  act(() => result.current.updateSchedule({ preset: 'weekly' }));

  expect(result.current.scheduleError).toBeNull();
  await act(async () => {
    await result.current.save();
  });
  expect(result.current.schedule?.interval_hours).toBe(12);
  expect(result.current.scheduleDirty).toBe(false);
});

test('out-of-range and min above max are reported and block saving', async () => {
  const { result } = await loaded();

  act(() => result.current.setValue('trash_retention_days', 400));
  expect(result.current.errors.trash_retention_days).toEqual({
    code: 'range',
  });

  act(() => {
    result.current.setValue('trash_retention_days', 30);
    result.current.setValue('backup_min_count', 60);
  });
  expect(result.current.errors.backup_min_count).toEqual({
    code: 'minAboveMax',
  });

  let ok = true;
  await act(async () => {
    ok = await result.current.save();
  });
  expect(ok).toBe(false);
  expect(api.updateAdminSettings).not.toHaveBeenCalled();
});

test('an empty number field is an error', async () => {
  const { result } = await loaded();

  act(() => result.current.setValue('backup_retention_days', ''));

  expect(result.current.errors.backup_retention_days?.code).toBe('range');
});

test('a failed settings load reports an error', async () => {
  api.getAdminSettings.mockRejectedValue(new Error('Request failed'));

  const { result } = await loaded();

  expect(result.current.loadError).toBeTruthy();
  expect(result.current.settings).toBeNull();
});

test('a failed schedule load still loads the settings', async () => {
  api.getAutoBackupSchedule.mockRejectedValue(new Error('Request failed'));

  const { result } = await loaded();

  expect(result.current.loadError).toBeNull();
  expect(result.current.settings).not.toBeNull();
  expect(result.current.schedule).toBeNull();
});
