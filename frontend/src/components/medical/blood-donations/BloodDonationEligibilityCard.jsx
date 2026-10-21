import PropTypes from 'prop-types';
import { Card, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconDroplet, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { getDonationTypeLabel } from '../../../constants/bloodDonationConstants';

const BloodDonationEligibilityCard = ({ eligibility, error = false }) => {
  const { t } = useTranslation(['medical', 'shared']);
  const { formatLongDate } = useDateFormat();

  if (error) {
    return (
      <Card withBorder padding="md" radius="md">
        <Group gap="sm">
          <ThemeIcon color="gray" variant="light">
            <IconAlertCircle size={18} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {t(
              'bloodDonations.eligibility.loadError',
              'Could not calculate the next donation date'
            )}
          </Text>
        </Group>
      </Card>
    );
  }

  if (!eligibility) return null;

  const hasDonation = Boolean(eligibility.limiting_donation_date);

  return (
    <Card withBorder padding="md" radius="md">
      <Group gap="md" align="flex-start" wrap="nowrap">
        <ThemeIcon
          size="lg"
          color={eligibility.is_eligible ? 'green' : 'red'}
          variant="light"
        >
          <IconDroplet size={20} />
        </ThemeIcon>
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {t('bloodDonations.eligibility.title', 'Next Donation')}
          </Text>
          {eligibility.is_eligible ? (
            <Text fw={600}>
              {t(
                'bloodDonations.eligibility.eligibleNow',
                'Eligible to donate now'
              )}
            </Text>
          ) : (
            <>
              <Text fw={600}>
                {t(
                  'bloodDonations.eligibility.nextDate',
                  'Eligible again on {{date}}',
                  { date: formatLongDate(eligibility.next_eligible_date) }
                )}
              </Text>
              <Text size="sm">
                {t(
                  'bloodDonations.eligibility.daysRemaining',
                  '{{count}} days remaining',
                  { count: eligibility.days_remaining }
                )}
              </Text>
            </>
          )}
          <Text size="xs" c="dimmed">
            {hasDonation
              ? t(
                  'bloodDonations.eligibility.basedOn',
                  'Based on the {{type}} donation on {{date}} and a {{days}}-day interval',
                  {
                    type: getDonationTypeLabel(
                      eligibility.limiting_donation_type,
                      t
                    ),
                    date: formatLongDate(eligibility.limiting_donation_date),
                    days: eligibility.interval_days,
                  }
                )
              : t(
                  'bloodDonations.eligibility.noDonations',
                  'No donations logged yet'
                )}
          </Text>
          <Text size="xs" c="dimmed">
            {t(
              'bloodDonations.eligibility.estimateNote',
              'This is only an estimate. The rules of the donation service take precedence.'
            )}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
};

BloodDonationEligibilityCard.propTypes = {
  eligibility: PropTypes.shape({
    is_eligible: PropTypes.bool,
    limiting_donation_date: PropTypes.string,
    limiting_donation_type: PropTypes.string,
    interval_days: PropTypes.number,
    next_eligible_date: PropTypes.string,
    days_remaining: PropTypes.number,
  }),
  error: PropTypes.bool,
};

export default BloodDonationEligibilityCard;
