import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Group } from '@mantine/core';
import BaseMedicalCard from '../base/BaseMedicalCard';
import StatusBadge from '../StatusBadge';
import TestComponentSummary from './TestComponentSummary';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
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
  const { t } = useTranslation('common');

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
        label: t('labResults.card.testCode', 'Test Code'),
        value: labResult.test_code
      },
      {
        label: t('labResults.card.type', 'Type'),
        value: labResult.test_type,
        render: (value) => value ? (
          <Badge variant="light" color="cyan" size="sm">
            {value}
          </Badge>
        ) : t('labResults.card.notSpecified', 'Not specified')
      },
      {
        label: t('labResults.card.facility', 'Facility'),
        value: labResult.facility
      },
      {
        label: t('labResults.card.ordered', 'Ordered'),
        value: labResult.ordered_date,
        render: (value) => value ? formatDate(value) : t('labResults.card.notSpecified', 'Not specified')
      },
      {
        label: t('labResults.card.completed', 'Completed'),
        value: labResult.completed_date,
        render: (value) => value ? formatDate(value) : t('labResults.card.notCompleted', 'Not completed')
      },
      {
        label: t('labResults.card.result', 'Result'),
        value: labResult.labs_result,
        render: (value) => value ? (
          <StatusBadge status={value} />
        ) : t('labResults.card.pending', 'Pending')
      },
      {
        label: t('labResults.card.doctor', 'Doctor'),
        value: labResult.practitioner_id,
        render: (value) => {
          if (!value) return t('labResults.card.notSpecified', 'Not specified');

          const practitionerName = practitioner?.name || `Practitioner ID: ${value}`;
          return (
            <Text
              size="sm"
              c="blue"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigateToEntity('practitioner', value, navigate)}
              title={t('labResults.card.viewPractitioner', 'View practitioner details')}
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