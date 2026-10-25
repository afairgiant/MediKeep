import PropTypes from 'prop-types';
import { SegmentedControl } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import {
  DEFAULT_HEMOGLOBIN_UNIT,
  HEMOGLOBIN_UNITS,
  HEMOGLOBIN_UNIT_LABELS,
} from '../../constants/bloodDonationConstants';

const HemoglobinUnitCard = ({ unit, onChange, disabled = false }) => {
  const { t } = useTranslation('settings');

  return (
    <Card>
      <div className="settings-section">
        <h3 className="settings-section-title">
          {t('preferences.hemoglobinUnit.title', 'Hemoglobin Unit')}
        </h3>
        <div className="settings-option-description">
          {t(
            'preferences.hemoglobinUnit.description',
            'Unit used to enter and display hemoglobin values of blood donations. Stored values are not changed.'
          )}
        </div>
        <SegmentedControl
          mt="md"
          value={unit || DEFAULT_HEMOGLOBIN_UNIT}
          onChange={value =>
            onChange(value === DEFAULT_HEMOGLOBIN_UNIT ? null : value)
          }
          data={HEMOGLOBIN_UNITS.map(value => ({
            value,
            label: HEMOGLOBIN_UNIT_LABELS[value],
          }))}
          disabled={disabled}
        />
      </div>
    </Card>
  );
};

HemoglobinUnitCard.propTypes = {
  unit: PropTypes.oneOf(HEMOGLOBIN_UNITS),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default HemoglobinUnitCard;
