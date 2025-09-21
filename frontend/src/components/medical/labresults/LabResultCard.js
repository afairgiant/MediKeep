import React from 'react';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import StatusBadge from '../StatusBadge';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const LabResultCard = ({
  labResult,
  onEdit,
  onDelete,
  onView,
  fileCount,
  fileCountLoading,
  practitioners,
  navigate,
  onError
}) => {
  const handleError = (error) => {
    logger.error('lab_result_card_error', {
      message: 'Error in LabResultCard',
      labResultId: labResult?.id,
      error: error.message,
      component: 'LabResultCard',
    });
    
    if (onError) {
      onError(error);
    }
  };

  try {
    // Find practitioner for this lab result
    const practitioner = practitioners.find(p => p.id === labResult.practitioner_id);

    // Generate badges
    const badges = [];
    if (labResult.test_category) {
      badges.push({ label: labResult.test_category, color: 'blue' });
    }
    
    // Add tags as badges
    if (labResult.tags && labResult.tags.length > 0) {
      badges.push({
        label: `🏷️ ${labResult.tags[0]}${labResult.tags.length > 1 ? ` +${labResult.tags.length - 1}` : ''}`,
        color: 'gray',
        variant: 'outline'
      });
    }

    // Generate dynamic fields
    const fields = [
      {
        label: 'Test Code',
        value: labResult.test_code
      },
      {
        label: 'Type',
        value: labResult.test_type,
        render: (value) => value ? (
          <Badge variant="light" color="cyan" size="sm">
            {value}
          </Badge>
        ) : 'Not specified'
      },
      {
        label: 'Facility',
        value: labResult.facility
      },
      {
        label: 'Ordered',
        value: labResult.ordered_date,
        render: (value) => value ? formatDate(value) : 'Not specified'
      },
      {
        label: 'Completed',
        value: labResult.completed_date,
        render: (value) => value ? formatDate(value) : 'Not completed'
      },
      {
        label: 'Result',
        value: labResult.labs_result,
        render: (value) => value ? (
          <StatusBadge status={value} />
        ) : 'Pending'
      },
      {
        label: 'Doctor',
        value: labResult.practitioner_id,
        render: (value) => {
          if (!value) return 'Not specified';
          
          const practitionerName = practitioner?.name || `Practitioner ID: ${value}`;
          return (
            <Text 
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigateToEntity('practitioner', value, navigate)}
              title="View practitioner details"
            >
              {practitionerName}
            </Text>
          );
        }
      }
    ];

    return (
      <BaseMedicalCard
        title={labResult.test_name}
        status={labResult.status}
        badges={badges}
        fields={fields}
        notes={labResult.notes}
        fileCount={fileCount}
        fileCountLoading={fileCountLoading}
        onView={() => onView(labResult)}
        onEdit={() => onEdit(labResult)}
        onDelete={() => onDelete(labResult)}
        entityType="lab-result"
        onError={handleError}
      />
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default LabResultCard;