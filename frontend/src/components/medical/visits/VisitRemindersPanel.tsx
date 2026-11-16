import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Chip,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconPlus, IconSend } from '@tabler/icons-react';
import { apiService } from '../../../services/api';
import { useReminderChannelStatus } from '../../../hooks/useReminderChannelStatus';
import logger from '../../../services/logger';
import { timezoneService } from '../../../services/timezoneService';
import { notifyError, notifySuccess } from '../../../utils/notifyTranslated';
import {
  DAY_REMINDER_TIME,
  DEFAULT_REMINDER_OFFSETS,
  MAX_REMINDER_OFFSETS,
  REMINDER_PRESETS,
  UNIT_MINUTES,
  formatReminderOffset,
  getOffsetProblem,
  isDayOffset,
  type OffsetProblem,
  type OffsetUnit,
  usableOffsets,
} from '../../../utils/visitReminders';

const EVENT_TYPE = 'visit_reminder_due';

const PROBLEM_DEFAULTS: Record<OffsetProblem, string> = {
  duplicate: 'That reminder is already set.',
  tooFar: 'Reminders can be at most 30 days before the visit.',
  tooMany: 'You can set up to {{max}} reminders.',
  needsTime: 'Reminders in hours or minutes need a start time.',
};

interface ReminderFormData {
  date?: string;
  visit_time?: string;
  reminder_enabled?: boolean;
  reminder_offsets?: number[];
  reminder_include_details?: boolean;
}

interface VisitRemindersPanelProps {
  formData: ReminderFormData;
  onInputChange: (_event: { target: { name: string; value: unknown } }) => void;
  /** Saved visit id; the test reminder needs one. */
  visitId?: number | null;
}

const VisitRemindersPanel = ({
  formData,
  onInputChange,
  visitId,
}: VisitRemindersPanelProps) => {
  const { t } = useTranslation(['medical', 'common']);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [customAmount, setCustomAmount] = useState<number | string>('');
  const [customUnit, setCustomUnit] = useState<OffsetUnit>('days');
  const [customProblem, setCustomProblem] = useState<OffsetProblem | null>(
    null
  );

  const enabled = Boolean(formData.reminder_enabled);
  const offsets = formData.reminder_offsets ?? [];
  const hasTime = Boolean(formData.visit_time);
  const dateKey = (formData.date ?? '').slice(0, 10);
  const isPastVisit = dateKey !== '' && dateKey < timezoneService.getTodayKey();
  const [hasChannel, setHasChannel] = useReminderChannelStatus(
    EVENT_TYPE,
    enabled,
    visitId
  );

  const setField = (name: string, value: unknown) =>
    onInputChange({ target: { name, value } });

  const handleToggle = (checked: boolean) => {
    setField('reminder_enabled', checked);
    if (checked && offsets.length === 0) {
      setField('reminder_offsets', DEFAULT_REMINDER_OFFSETS);
    }
  };

  const handleChipsChange = (values: string[]) => {
    setField('reminder_offsets', values.map(Number));
  };

  const handleAddCustom = () => {
    const amount = Number(customAmount);
    if (!Number.isInteger(amount) || amount < 1) return;
    const offset = amount * UNIT_MINUTES[customUnit];
    const problem = getOffsetProblem(offset, offsets, hasTime);
    setCustomProblem(problem);
    if (problem) return;
    setField('reminder_offsets', [...offsets, offset]);
    setCustomAmount('');
  };

  const handleSendTest = async () => {
    if (!visitId) return;
    setIsSendingTest(true);
    try {
      await apiService.sendVisitTestReminder(visitId);
      notifySuccess(t('visits.reminders.testSuccess', 'Test reminder sent'));
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 422) setHasChannel(false);
      notifyError(
        status === 400
          ? t(
              'visits.reminders.saveBeforeTest',
              'Save the visit first to send a test reminder.'
            )
          : t('visits.reminders.testError', 'Failed to send test reminder')
      );
      logger.error('visit_reminder_test_failed', {
        message: 'Test reminder failed',
        visitId,
        component: 'VisitRemindersPanel',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const chipOffsets = Array.from(
    new Set([...REMINDER_PRESETS, ...offsets])
  ).sort((a, b) => b - a);
  const unitOptions = (['minutes', 'hours', 'days'] as OffsetUnit[]).map(
    unit => ({
      value: unit,
      label: t(`visits.reminders.units.${unit}`, unit),
      disabled: !hasTime && unit !== 'days',
    })
  );

  return (
    <Stack gap="md">
      {enabled && !hasChannel && (
        <Alert
          color="yellow"
          icon={<IconAlertCircle size={16} />}
          title={t(
            'visits.reminders.noChannelsTitle',
            'No notification channel enabled'
          )}
        >
          <Text size="sm">
            {t(
              'visits.reminders.noChannelsWarning',
              'No notification channel is turned on for visit reminders. Open Notification Settings to enable one.'
            )}
          </Text>
          <Anchor href="/settings/notifications" size="sm">
            {t('visits.reminders.openSettings', 'Open Notification Settings')}
          </Anchor>
        </Alert>
      )}
      {enabled && isPastVisit && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          <Text size="sm">
            {t(
              'visits.reminders.pastVisit',
              "This visit's date has passed, so its reminders won't be sent."
            )}
          </Text>
        </Alert>
      )}

      <Switch
        checked={enabled}
        onChange={event => handleToggle(event.currentTarget.checked)}
        label={t(
          'visits.reminders.enabled.label',
          'Remind me about this visit'
        )}
        description={t(
          'visits.reminders.enabled.description',
          'Sends a notification through your notification channels.'
        )}
      />

      {enabled && (
        <>
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t('visits.reminders.when', 'When')}
            </Text>
            <Chip.Group
              multiple
              value={offsets.map(String)}
              onChange={handleChipsChange}
            >
              <Group gap="xs">
                {chipOffsets.map(offset => (
                  <Chip
                    key={offset}
                    value={String(offset)}
                    size="sm"
                    disabled={
                      (!hasTime && !isDayOffset(offset)) ||
                      (!offsets.includes(offset) &&
                        offsets.length >= MAX_REMINDER_OFFSETS)
                    }
                  >
                    {formatReminderOffset(offset, t)}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
            {usableOffsets(offsets, hasTime).length === 0 && (
              <Text size="xs" c="red">
                {t(
                  'visits.reminders.noneSelected',
                  'Pick at least one reminder.'
                )}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {hasTime
                ? t('visits.reminders.timedNote', {
                    time: DAY_REMINDER_TIME,
                    defaultValue:
                      'Day reminders go out at {{time}}; reminders in hours or minutes count back from the start time.',
                  })
                : t('visits.reminders.allDayNote', {
                    time: DAY_REMINDER_TIME,
                    defaultValue:
                      'No start time, so this is an all-day visit: reminders go out at {{time}}. Add a start time on the Visit Info tab to use reminders in hours or minutes.',
                  })}
            </Text>
          </Stack>

          <Stack gap={4}>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <NumberInput
                label={t(
                  'visits.reminders.custom.label',
                  'Custom time before the visit'
                )}
                value={customAmount}
                onChange={value => {
                  setCustomAmount(value);
                  setCustomProblem(null);
                }}
                min={1}
                allowDecimal={false}
                w={140}
              />
              <Select
                aria-label={t('visits.reminders.custom.unit', 'Unit')}
                value={customUnit}
                data={unitOptions}
                onChange={value => {
                  setCustomUnit((value as OffsetUnit) || 'days');
                  setCustomProblem(null);
                }}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                w={130}
              />
              <Button
                variant="default"
                leftSection={<IconPlus size={14} />}
                onClick={handleAddCustom}
                disabled={!customAmount}
              >
                {t('visits.reminders.custom.add', 'Add')}
              </Button>
            </Group>
            {customProblem && (
              <Text size="xs" c="red" role="alert">
                {t(`visits.reminders.problems.${customProblem}`, {
                  max: MAX_REMINDER_OFFSETS,
                  defaultValue: PROBLEM_DEFAULTS[customProblem],
                })}
              </Text>
            )}
          </Stack>

          <Checkbox
            checked={Boolean(formData.reminder_include_details)}
            onChange={event =>
              setField('reminder_include_details', event.currentTarget.checked)
            }
            label={t(
              'visits.reminders.includeDetails.label',
              'Include provider and location'
            )}
            description={t(
              'visits.reminders.includeDetails.description',
              'By default a reminder shows only the visit reason and time.'
            )}
          />

          <Group>
            <Button
              variant="default"
              leftSection={<IconSend size={14} />}
              onClick={handleSendTest}
              disabled={!visitId || isSendingTest}
              loading={isSendingTest}
            >
              {t('visits.reminders.testButton', 'Send test reminder now')}
            </Button>
          </Group>
          {!visitId && (
            <Text size="xs" c="dimmed">
              {t(
                'visits.reminders.saveBeforeTest',
                'Save the visit first to send a test reminder.'
              )}
            </Text>
          )}
        </>
      )}
    </Stack>
  );
};

export default VisitRemindersPanel;
