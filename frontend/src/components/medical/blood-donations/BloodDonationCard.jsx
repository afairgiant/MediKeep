import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import BaseMedicalCard from '../base/BaseMedicalCard';
import { useDateFormat } from '../../../hooks/useDateFormat';
import logger from '../../../services/logger';
import {
  convertForDisplay,
  formatMeasurement,
} from '../../../utils/unitConversion';
import {
  getDonationTypeLabel,
  getDonationTypeColor,
  convertHemoglobinForDisplay,
  getHemoglobinUnitLabel,
  DEFAULT_HEMOGLOBIN_UNIT,
  HEMOGLOBIN_UNITS,
} from '../../../constants/bloodDonationConstants';

export const formatBloodPressure = donation =>
  donation.systolic_bp != null || donation.diastolic_bp != null
    ? `${donation.systolic_bp ?? '—'}/${donation.diastolic_bp ?? '—'} mmHg`
    : null;

export const formatTemperature = (temperature, unitSystem) =>
  temperature === null || temperature === undefined
    ? null
    : formatMeasurement(
        convertForDisplay(temperature, 'temperature', unitSystem),
        'temperature',
        unitSystem
      );

export const formatHemoglobin = (hemoglobin, hemoglobinUnit) =>
  hemoglobin === null || hemoglobin === undefined
    ? null
    : `${convertHemoglobinForDisplay(hemoglobin, hemoglobinUnit)} ${getHemoglobinUnitLabel(hemoglobinUnit)}`;

const BloodDonationCard = ({
  donation,
  onEdit,
  onDelete,
  onView,
  unitSystem = 'imperial',
  hemoglobinUnit = DEFAULT_HEMOGLOBIN_UNIT,
  disableActions = false,
  disableActionsTooltip,
  onError,
}) => {
  const { t } = useTranslation(['medical', 'shared']);
  const { formatLongDate } = useDateFormat();

  const handleError = error => {
    logger.error('blood_donation_card_error', {
      message: 'Error in BloodDonationCard',
      donationId: donation?.id,
      error: error.message,
      component: 'BloodDonationCard',
    });
    if (onError) {
      onError(error);
    }
  };

  try {
    const typeLabel = getDonationTypeLabel(donation.donation_type, t);

    const fields = [
      {
        label: t('bloodDonations.fields.bloodPressure', 'Blood Pressure'),
        value: formatBloodPressure(donation),
      },
      {
        label: t('bloodDonations.fields.temperature', 'Temperature'),
        value: formatTemperature(donation.temperature, unitSystem),
      },
      {
        label: t('bloodDonations.fields.hemoglobin', 'Hemoglobin'),
        value: formatHemoglobin(donation.hemoglobin, hemoglobinUnit),
      },
    ].filter(field => field.value);

    return (
      <BaseMedicalCard
        title={formatLongDate(donation.donation_date)}
        subtitle={donation.location || null}
        badges={[
          {
            label: typeLabel,
            color: getDonationTypeColor(donation.donation_type),
          },
        ]}
        fields={fields}
        notes={donation.notes}
        tags={donation.tags}
        onView={() => onView(donation)}
        onEdit={() => onEdit(donation)}
        onDelete={() => onDelete(donation.id)}
        disableActions={disableActions}
        disableActionsTooltip={disableActionsTooltip}
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

BloodDonationCard.propTypes = {
  donation: PropTypes.shape({
    id: PropTypes.number,
    donation_date: PropTypes.string,
    donation_type: PropTypes.string,
    location: PropTypes.string,
    systolic_bp: PropTypes.number,
    diastolic_bp: PropTypes.number,
    temperature: PropTypes.number,
    hemoglobin: PropTypes.number,
    notes: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onView: PropTypes.func.isRequired,
  unitSystem: PropTypes.oneOf(['imperial', 'metric']),
  hemoglobinUnit: PropTypes.oneOf(HEMOGLOBIN_UNITS),
  disableActions: PropTypes.bool,
  disableActionsTooltip: PropTypes.string,
  onError: PropTypes.func,
};

export default BloodDonationCard;
