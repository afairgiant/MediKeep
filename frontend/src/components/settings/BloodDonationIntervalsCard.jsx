import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Group, NumberInput, SimpleGrid } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import {
  DONATION_TYPES,
  DEFAULT_DONATION_INTERVALS,
  INTERVAL_DAYS_RANGE,
  getDonationTypeLabel,
} from '../../constants/bloodDonationConstants';

/**
 * BloodDonationIntervalsCard Component
 *
 * Lets the user configure the minimum number of days that must pass after a
 * donation of a given type before they are eligible to donate again. Values
 * are merged over DEFAULT_DONATION_INTERVALS so the inputs always show a
 * number, and the full interval map is emitted on every change so the
 * parent never has to merge partial updates.
 */
const BloodDonationIntervalsCard = ({
  intervals,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation(['settings', 'medical', 'shared']);
  const effective = { ...DEFAULT_DONATION_INTERVALS, ...(intervals || {}) };
  // Per-field draft so an input can sit empty while the user is editing it,
  // without snapping back to the last valid value on every keystroke.
  const [drafts, setDrafts] = useState({});

  const handleChange = (type, value) => {
    setDrafts(prev => ({ ...prev, [type]: value }));
    if (value === '' || value === null || value === undefined) return;
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return;
    const updated = { ...effective, [type]: numeric };
    const isAllDefault = DONATION_TYPES.every(
      key => updated[key] === DEFAULT_DONATION_INTERVALS[key]
    );
    // Collapse back to null (use defaults) once every type matches the
    // default again, instead of persisting a map equal to the defaults.
    onChange(isAllDefault ? null : updated);
  };

  const handleBlur = type => {
    setDrafts(prev => {
      if (!(type in prev)) return prev;
      const { [type]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleReset = () => {
    setDrafts({});
    onChange(null);
  };

  return (
    <Card>
      <div className="settings-section">
        <h3 className="settings-section-title">
          {t(
            'preferences.bloodDonationIntervals.title',
            'Blood Donation Intervals'
          )}
        </h3>
        <div className="settings-option-description">
          {t(
            'preferences.bloodDonationIntervals.description',
            'Minimum number of days after a donation before you may donate again. Adjust these to the guidelines of your blood donation service.'
          )}
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
          {DONATION_TYPES.map(type => (
            <NumberInput
              key={type}
              label={getDonationTypeLabel(type, t)}
              value={type in drafts ? drafts[type] : effective[type]}
              onChange={value => handleChange(type, value)}
              onBlur={() => handleBlur(type)}
              min={INTERVAL_DAYS_RANGE.min}
              max={INTERVAL_DAYS_RANGE.max}
              allowDecimal={false}
              suffix={` ${t('preferences.bloodDonationIntervals.days', 'days')}`}
              disabled={disabled}
            />
          ))}
        </SimpleGrid>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            size="xs"
            onClick={handleReset}
            disabled={disabled || intervals === null || intervals === undefined}
          >
            {t('preferences.bloodDonationIntervals.reset', 'Reset to defaults')}
          </Button>
        </Group>
      </div>
    </Card>
  );
};

BloodDonationIntervalsCard.propTypes = {
  intervals: PropTypes.objectOf(PropTypes.number),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default BloodDonationIntervalsCard;
