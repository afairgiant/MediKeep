import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  Button,
  Divider,
  Tooltip,
} from '@mantine/core';
import { IconStarFilled, IconPrinter } from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { createCardClickHandler } from '../../../utils/helpers';
import { resolveInsurancePcpDisplay } from '../../../utils/insurancePcpUtils';
import { formatCurrencyDisplay } from '../../../utils/currency';
import StatusBadge from '../StatusBadge';
import FileCountBadge from '../../shared/FileCountBadge';
import { useTranslation } from 'react-i18next';
import '../../../styles/shared/MedicalPageShared.css';

const InsuranceCard = ({
  insurance,
  onEdit,
  onDelete,
  onSetPrimary: _onSetPrimary,
  onView,
  onPrint,
  fileCount = 0,
  fileCountLoading = false,
  disableActions = false,
  disableActionsTooltip,
  practitioners = [],
}) => {
  const { t, i18n } = useTranslation(['common', 'shared', 'medical']);
  const { formatLongDate } = useDateFormat();

  const pcpDisplay = resolveInsurancePcpDisplay(insurance, practitioners);

  // Get type-specific styling
  const getTypeColor = type => {
    switch (type) {
      case 'medical':
        return 'blue';
      case 'dental':
        return 'green';
      case 'vision':
        return 'purple';
      case 'prescription':
        return 'orange';
      default:
        return 'gray';
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
      case 'dental':
      case 'vision':
        return [];
      case 'prescription':
        priorityFields = ['bin_number', 'pcn_number', 'rxgroup'];
        break;
      default:
        return entries.slice(0, 2);
    }

    // Preserve priorityFields' own order (BIN, then PCN, then RX Group)
    // rather than whatever order the keys happen to sit in coverage_details.
    return priorityFields
      .filter(
        field =>
          coverageDetails[field] !== undefined &&
          coverageDetails[field] !== null &&
          coverageDetails[field] !== ''
      )
      .map(field => [field, coverageDetails[field]]);
  };

  // Format field values for display
  // Note: no currently-displayed card field matches the currency patterns
  // below (Deductible/Copay/Allowance/Maximum were removed from the card
  // summary elsewhere), so this branch is dead in practice today - kept
  // correct/consistent with Print/Edit/View in case a currency field is
  // ever added back to the card's priority list.
  const formatFieldValue = (fieldName, value) => {
    if (!value) return 'N/A';

    // Currency fields
    if (
      fieldName.includes('deductible') ||
      fieldName.includes('copay') ||
      fieldName.includes('allowance') ||
      fieldName.includes('maximum')
    ) {
      return formatCurrencyDisplay(value, i18n.language);
    }

    // Percentage fields
    if (fieldName.includes('coverage') && fieldName !== 'lens_coverage') {
      return `${value}%`;
    }

    return value;
  };

  // Format field labels for display
  const formatFieldLabel = fieldName => {
    const labelMap = {
      bin_number: t('insurance.card.bin', 'BIN'),
      pcn_number: t('insurance.card.pcn', 'PCN'),
      rxgroup: t('insurance.card.rxgroup', 'RX Group'),
    };

    return (
      labelMap[fieldName] ||
      fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
  };

  const typeColor = getTypeColor(insurance.insurance_type);
  const displayCoverageDetails = getDisplayCoverageDetails();

  const handlePrint = () => {
    if (!onPrint) return;
    // Bake the resolved PCP name into coverage_details for the print
    // template, which only knows how to render that raw dict - it has no
    // access to the practitioners list to resolve the id itself.
    const printableInsurance = pcpDisplay
      ? {
          ...insurance,
          coverage_details: {
            ...(insurance.coverage_details || {}),
            primary_care_physician: pcpDisplay,
          },
        }
      : insurance;
    onPrint(printableInsurance);
  };

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      h="100%"
      className="clickable-card"
      onClick={createCardClickHandler(onView, insurance)}
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
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
              {insurance.insurance_type === 'medical' &&
                insurance.is_primary && (
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
          {displayCoverageDetails.length > 0 &&
            displayCoverageDetails.map(([key, value]) => (
              <Group key={key}>
                <Text size="sm" fw={500} c="dimmed" w={100}>
                  {formatFieldLabel(key)}:
                </Text>
                <Text size="sm">{formatFieldValue(key, value)}</Text>
              </Group>
            ))}
        </Stack>
      </Stack>

      {/* Action Buttons */}
      <Stack gap={0} mt="auto">
        <Divider />
        <Group justify="space-between" gap="xs" pt="sm">
          <Button
            variant="outline"
            size="xs"
            leftSection={<IconPrinter size={14} />}
            onClick={e => {
              e.stopPropagation();
              handlePrint();
            }}
          >
            {t('insurance.viewModal.printCard', 'Print Card')}
          </Button>
          <Group gap="xs">
            <Button
              variant="filled"
              size="xs"
              onClick={() => onView(insurance)}
            >
              {t('buttons.view', 'View')}
            </Button>
            <Tooltip
              label={disableActionsTooltip}
              disabled={!disableActions || !disableActionsTooltip}
            >
              <span onClick={e => e.stopPropagation()}>
                <Button
                  variant="filled"
                  size="xs"
                  disabled={disableActions}
                  onClick={() => onEdit(insurance)}
                >
                  {t('shared:labels.edit', 'Edit')}
                </Button>
              </span>
            </Tooltip>
            <Tooltip
              label={disableActionsTooltip}
              disabled={!disableActions || !disableActionsTooltip}
            >
              <span onClick={e => e.stopPropagation()}>
                <Button
                  variant="filled"
                  color="red"
                  size="xs"
                  disabled={disableActions}
                  onClick={() => onDelete(insurance)}
                >
                  {t('buttons.delete', 'Delete')}
                </Button>
              </span>
            </Tooltip>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
};

export default InsuranceCard;
