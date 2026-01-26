import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import StatusBadge from '../StatusBadge';
import TestComponentSummary from './TestComponentSummary';
import { navigateToEntity } from '../../../utils/linkNavigation';
import { useDateFormat } from '../../../hooks/useDateFormat';
import logger from '../../../services/logger';

const LabResultCard = React.memo(({
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
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');
  const { formatLongDate } = useDateFormat();

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
        label: t('labResults.testCode.label'),
        value: labResult.test_code
      },
      {
        label: t('labResults.testTypeField.label'),
        value: labResult.test_type,
        render: (value) => value ? (
          <Badge variant="light" color="cyan" size="sm">
            {value}
          </Badge>
        ) : tCommon('labels.notSpecified')
      },
      {
        label: t('labResults.testingFacility.label'),
        value: labResult.facility
      },
      {
        label: t('labResults.orderedDate.label'),
        value: labResult.ordered_date,
        render: (value) => value ? formatLongDate(value) : tCommon('labels.notSpecified')
      },
      {
        label: t('labResults.completedDate.label'),
        value: labResult.completed_date,
        render: (value) => value ? formatLongDate(value) : tCommon('labels.notCompleted', 'Not completed')
      },
      {
        label: t('labResults.labResult.label'),
        value: labResult.labs_result,
        render: (value) => value ? (
          <StatusBadge status={value} />
        ) : tCommon('labels.pending', 'Pending')
      },
      {
        label: t('labResults.orderingPractitioner.label'),
        value: labResult.practitioner_id,
        render: (value) => {
          if (!value) return tCommon('labels.notSpecified');

          const practitionerName = practitioner?.name || `Practitioner ID: ${value}`;
          return (
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigateToEntity('practitioner', value, navigate)}
              title={tCommon('labels.viewPractitionerDetails', 'View practitioner details')}
            >
              {practitionerName}
            </Text>
          );
        }
      },
      // NOTE: TestComponentSummary is NOT shown in the card to prevent infinite API calls
      // Test components are only displayed in the LabResultViewModal's "Test Components" tab
      // This design decision improves performance and user experience
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
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these specific props change
  return (
    prevProps.labResult.id === nextProps.labResult.id &&
    prevProps.labResult.test_name === nextProps.labResult.test_name &&
    prevProps.labResult.status === nextProps.labResult.status &&
    prevProps.labResult.labs_result === nextProps.labResult.labs_result &&
    prevProps.labResult.ordered_date === nextProps.labResult.ordered_date &&
    prevProps.labResult.completed_date === nextProps.labResult.completed_date &&
    prevProps.fileCount === nextProps.fileCount &&
    prevProps.fileCountLoading === nextProps.fileCountLoading &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onView === nextProps.onView
  );
});

LabResultCard.displayName = 'LabResultCard';

export default LabResultCard;