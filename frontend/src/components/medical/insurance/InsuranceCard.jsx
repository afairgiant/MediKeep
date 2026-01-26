import React from 'react';
import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  Button,
  Divider,
} from '@mantine/core';
import {
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { notifications } from '@mantine/notifications';
import logger from '../../../services/logger';
import StatusBadge from '../StatusBadge';
import FileCountBadge from '../../shared/FileCountBadge';
import { useTranslation } from 'react-i18next';

const InsuranceCard = ({
  insurance,
  onEdit,
  onDelete,
  onSetPrimary,
  onView,
  fileCount = 0,
  fileCountLoading = false
}) => {
  const { t } = useTranslation('common');
  const { formatLongDate } = useDateFormat();

  // Get type-specific styling
  const getTypeColor = (type) => {
    switch (type) {
      case 'medical': return 'blue';
      case 'dental': return 'green';
      case 'vision': return 'purple';
      case 'prescription': return 'orange';
      default: return 'gray';
    }
  };

  // Get relevant coverage details to display (limit to most important ones)
  const getDisplayCoverageDetails = () => {
    const coverageDetails = insurance.coverage_details || {};
    const entries = Object.entries(coverageDetails);
    
    if (entries.length === 0) return [];
    
    // Prioritize fields based on insurance type
    let priorityFields = [];
    switch (insurance.insurance_type) {
      case 'medical':
        priorityFields = ['deductible_individual', 'copay_primary_care', 'copay_specialist'];
        break;
      case 'dental':
        priorityFields = ['annual_maximum', 'preventive_coverage', 'basic_coverage'];
        break;
      case 'vision':
        priorityFields = ['exam_copay', 'frame_allowance'];
        break;
      case 'prescription':
        priorityFields = ['bin_number', 'pcn_number'];
        break;
      default:
        return entries.slice(0, 2);
    }
    
    return entries.filter(([key]) => priorityFields.includes(key)).slice(0, 2);
  };

  // Format field values for display
  const formatFieldValue = (fieldName, value) => {
    if (!value) return 'N/A';
    
    // Currency fields
    if (fieldName.includes('deductible') || fieldName.includes('copay') || 
        fieldName.includes('allowance') || fieldName.includes('maximum')) {
      return `$${value}`;
    }
    
    // Percentage fields
    if (fieldName.includes('coverage') && fieldName !== 'lens_coverage') {
      return `${value}%`;
    }
    
    return value;
  };

  // Format field labels for display
  const formatFieldLabel = (fieldName) => {
    const labelMap = {
      'deductible_individual': t('insurance.card.deductible', 'Deductible'),
      'copay_primary_care': t('insurance.card.pcpCopay', 'PCP Copay'),
      'copay_specialist': t('insurance.card.specialistCopay', 'Specialist Copay'),
      'annual_maximum': t('insurance.card.annualMax', 'Annual Max'),
      'preventive_coverage': t('insurance.card.preventive', 'Preventive'),
      'basic_coverage': t('insurance.card.basic', 'Basic'),
      'exam_copay': t('insurance.card.examCopay', 'Exam Copay'),
      'frame_allowance': t('insurance.card.frameAllowance', 'Frame Allowance'),
      'bin_number': t('insurance.card.bin', 'BIN'),
      'pcn_number': t('insurance.card.pcn', 'PCN'),
    };

    return labelMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const typeColor = getTypeColor(insurance.insurance_type);
  const displayCoverageDetails = getDisplayCoverageDetails();

  const handleCardClick = (e) => {
    // Don't trigger if clicking on a button or link
    const target = e.target;
    if (target.closest('button') || target.closest('a')) return;
    if (onView) onView(insurance);
  };

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      h="100%"
      onClick={handleCardClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text fw={600} size="lg">
              {insurance.company_name}
            </Text>
            <Group gap="xs">
              <Badge 
                variant="light" 
                color={typeColor} 
                size="md"
                style={{ textTransform: 'capitalize' }}
              >
                {insurance.insurance_type}
              </Badge>
              {insurance.insurance_type === 'medical' && insurance.is_primary && (
                <Badge
                  variant="filled"
                  color="yellow"
                  size="sm"
                  leftSection={<IconStarFilled size={12} />}
                >
                  {t('insurance.card.primary', 'Primary')}
                </Badge>
              )}
              <FileCountBadge
                count={fileCount}
                entityType="insurance"
                variant="badge"
                size="sm"
                loading={fileCountLoading}
                onClick={() => onView(insurance)}
              />
            </Group>
          </Stack>
          <StatusBadge status={insurance.status} />
        </Group>

        {/* Main Content */}
        <Stack gap="xs">
          {/* Member Information */}
          <Group>
            <Text size="sm" fw={500} c="dimmed" w={100}>
              {t('insurance.card.member', 'Member')}:
            </Text>
            <Text size="sm">{insurance.member_name}</Text>
          </Group>

          <Group>
            <Text size="sm" fw={500} c="dimmed" w={100}>
              {t('insurance.card.memberId', 'Member ID')}:
            </Text>
            <Text size="sm">{insurance.member_id}</Text>
          </Group>

          {insurance.group_number && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={100}>
                {t('insurance.card.group', 'Group')}:
              </Text>
              <Text size="sm">{insurance.group_number}</Text>
            </Group>
          )}

          {insurance.plan_name && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={100}>
                {t('insurance.card.plan', 'Plan')}:
              </Text>
              <Text size="sm">{insurance.plan_name}</Text>
            </Group>
          )}

          {/* Coverage Period */}
          <Group>
            <Text size="sm" fw={500} c="dimmed" w={100}>
              {t('insurance.card.effective', 'Effective')}:
            </Text>
            <Text size="sm">{formatLongDate(insurance.effective_date)}</Text>
          </Group>

          {insurance.expiration_date && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={100}>
                {t('insurance.card.expires', 'Expires')}:
              </Text>
              <Text size="sm">{formatLongDate(insurance.expiration_date)}</Text>
            </Group>
          )}

          {/* Key Coverage Details */}
          {displayCoverageDetails.length > 0 && (
            displayCoverageDetails.map(([key, value]) => (
              <Group key={key}>
                <Text size="sm" fw={500} c="dimmed" w={100}>
                  {formatFieldLabel(key)}:
                </Text>
                <Text size="sm">{formatFieldValue(key, value)}</Text>
              </Group>
            ))
          )}

          {/* Policy Holder if different from member */}
          {insurance.policy_holder_name && insurance.policy_holder_name !== insurance.member_name && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={100}>
                {t('insurance.card.holder', 'Holder')}:
              </Text>
              <Text size="sm">
                {insurance.policy_holder_name} ({insurance.relationship_to_holder || 'Self'})
              </Text>
            </Group>
          )}
        </Stack>
      </Stack>

      {/* Action Buttons */}
      <Stack gap={0} mt="auto">
        <Divider />
        <Group justify="flex-end" gap="xs" pt="sm">
          <Button
            variant="filled"
            size="xs"
            onClick={() => onView(insurance)}
          >
            {t('buttons.view', 'View')}
          </Button>
          <Button
            variant="filled"
            size="xs"
            onClick={() => onEdit(insurance)}
          >
            {t('buttons.edit', 'Edit')}
          </Button>
          <Button
            variant="filled"
            color="red"
            size="xs"
            onClick={() => onDelete(insurance)}
          >
            {t('buttons.delete', 'Delete')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default InsuranceCard;