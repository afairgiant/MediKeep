import React from 'react';
import PropTypes from 'prop-types';
import { Text, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import BaseMedicalCard from '../base/BaseMedicalCard';
import StatusBadge from '../StatusBadge';
import { useDateFormat } from '../../../hooks/useDateFormat';
import logger from '../../../services/logger';
import {
  getEquipmentTypeLabel,
  getEquipmentStatusColor,
} from '../../../constants/equipmentConstants';

const EquipmentCard = ({
  equipment,
  onEdit,
  onDelete,
  onView,
  fileCount = 0,
  fileCountLoading = false,
  onError
}) => {
  const { t } = useTranslation('common');
  const { formatLongDate } = useDateFormat();

  const handleError = (error) => {
    logger.error('equipment_card_error', {
      message: 'Error in EquipmentCard',
      equipmentId: equipment?.id,
      error: error.message,
      component: 'EquipmentCard',
    });

    if (onError) {
      onError(error);
    }
  };

  try {
    const badges = [];

    if (equipment.equipment_type) {
      badges.push({
        label: getEquipmentTypeLabel(equipment.equipment_type),
        color: 'blue'
      });
    }

    if (equipment.manufacturer) {
      badges.push({
        label: equipment.manufacturer,
        color: 'gray',
        variant: 'outline'
      });
    }

    const fields = [
      {
        label: t('equipment.fields.modelNumber', 'Model'),
        value: equipment.model_number,
        render: (value) => value || t('labels.notSpecified', 'Not specified')
      },
      {
        label: t('equipment.fields.serialNumber', 'Serial #'),
        value: equipment.serial_number,
        render: (value) => value || t('labels.notSpecified', 'Not specified')
      },
      {
        label: t('equipment.fields.prescribedDate', 'Prescribed'),
        value: equipment.prescribed_date,
        render: (value) => value ? formatLongDate(value) : t('labels.notSpecified', 'Not specified')
      },
      {
        label: t('equipment.fields.nextService', 'Next Service'),
        value: equipment.next_service_date,
        render: (value) => value ? formatLongDate(value) : t('labels.notSpecified', 'Not specified')
      },
      {
        label: t('equipment.fields.supplier', 'Supplier'),
        value: equipment.supplier,
        render: (value) => value || t('labels.notSpecified', 'Not specified')
      },
    ].filter(field => field.value);

    const titleContent = (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
        <Text fw={600} size="lg" style={{ flex: 1 }}>
          {equipment.equipment_name}
        </Text>
        <StatusBadge
          status={equipment.status}
          color={getEquipmentStatusColor(equipment.status)}
        />
      </div>
    );

    return (
      <BaseMedicalCard
        title={titleContent}
        subtitle={equipment.equipment_type ? getEquipmentTypeLabel(equipment.equipment_type) : null}
        badges={badges}
        fields={fields}
        notes={equipment.notes}
        entityType="medical_equipment"
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(equipment)}
        onEdit={() => onEdit(equipment)}
        onDelete={() => onDelete(equipment.id)}
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

EquipmentCard.propTypes = {
  equipment: PropTypes.shape({
    id: PropTypes.number,
    equipment_name: PropTypes.string,
    equipment_type: PropTypes.string,
    manufacturer: PropTypes.string,
    model_number: PropTypes.string,
    serial_number: PropTypes.string,
    prescribed_date: PropTypes.string,
    next_service_date: PropTypes.string,
    supplier: PropTypes.string,
    status: PropTypes.string,
    notes: PropTypes.string,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onView: PropTypes.func.isRequired,
  fileCount: PropTypes.number,
  fileCountLoading: PropTypes.bool,
  onError: PropTypes.func,
};

export default EquipmentCard;
