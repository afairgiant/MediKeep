import React, { useState, useEffect } from 'react';
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
import { formatDate } from '../../../utils/helpers';
import { notifications } from '@mantine/notifications';
import logger from '../../../services/logger';
import StatusBadge from '../StatusBadge';
import FileCountBadge from '../../shared/FileCountBadge';
import { apiService } from '../../../services/api';

const InsuranceCard = ({ insurance, onEdit, onDelete, onSetPrimary, onView }) => {
  const [fileCount, setFileCount] = useState(0);
  const [fileCountLoading, setFileCountLoading] = useState(false);

  // Load file count for this insurance
  useEffect(() => {
    const loadFileCount = async () => {
      if (!insurance?.id) return;
      
      setFileCountLoading(true);
      try {
        const files = await apiService.getEntityFiles('insurance', insurance.id);
        setFileCount(Array.isArray(files) ? files.length : 0);
      } catch (error) {
        console.error('Error loading file count:', error);
        setFileCount(0);
      } finally {
        setFileCountLoading(false);
      }
    };

    loadFileCount();
  }, [insurance?.id]);

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
      'deductible_individual': 'Deductible',
      'copay_primary_care': 'PCP Copay',
      'copay_specialist': 'Specialist Copay',
      'annual_maximum': 'Annual Max',
      'preventive_coverage': 'Preventive',
      'basic_coverage': 'Basic',
      'exam_copay': 'Exam Copay',
      'frame_allowance': 'Frame Allowance',
      'bin_number': 'BIN',
      'pcn_number': 'PCN',
    };
    
    return labelMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const typeColor = getTypeColor(insurance.insurance_type);
  const displayCoverageDetails = getDisplayCoverageDetails();

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      h="100%"
      style={{ display: 'flex', flexDirection: 'column' }}
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
                  Primary
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
              Member:
            </Text>
            <Text size="sm">{insurance.member_name}</Text>
          </Group>
          
          <Group>
            <Text size="sm" fw={500} c="dimmed" w={100}>
              Member ID:
            </Text>
            <Text size="sm">{insurance.member_id}</Text>
          </Group>

          {insurance.group_number && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={100}>
                Group:
              </Text>
              <Text size="sm">{insurance.group_number}</Text>
            </Group>
          )}

          {insurance.plan_name && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={100}>
                Plan:
              </Text>
              <Text size="sm">{insurance.plan_name}</Text>
            </Group>
          )}

          {/* Coverage Period */}
          <Group>
            <Text size="sm" fw={500} c="dimmed" w={100}>
              Effective:
            </Text>
            <Text size="sm">{formatDate(insurance.effective_date)}</Text>
          </Group>

          {insurance.expiration_date && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={100}>
                Expires:
              </Text>
              <Text size="sm">{formatDate(insurance.expiration_date)}</Text>
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
                Holder:
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
            View
          </Button>
          <Button
            variant="filled"
            size="xs"
            onClick={() => onEdit(insurance)}
          >
            Edit
          </Button>
          <Button
            variant="filled"
            color="red"
            size="xs"
            onClick={() => onDelete(insurance)}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default InsuranceCard;