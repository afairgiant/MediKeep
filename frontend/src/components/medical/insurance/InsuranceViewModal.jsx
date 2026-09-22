import logger from '../../../services/logger';

import React, { useState } from 'react';
import {
  Modal,
  Title,
  Text,
  Group,
  Badge,
  Button,
  Stack,
  Tabs,
  Box,
  SimpleGrid,
  Paper,
  Divider,
  Tooltip,
  Anchor,
} from '@mantine/core';
import {
  IconEdit,
  IconInfoCircle,
  IconUser,
  IconShield,
  IconPhone,
  IconFileText,
} from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { resolveInsurancePcpDisplay } from '../../../utils/insurancePcpUtils';
import { translateField } from '../../../utils/translateField';
import { isFieldType } from '../../../utils/fieldTypeConfig';
import { formatCurrencyDisplay } from '../../../utils/currency';
import {
  getInsuranceFieldsBySection,
  INSURANCE_COVERAGE_PERIOD_FIELD_NAMES,
} from '../../../utils/insuranceFieldSections';

import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { useTranslation } from 'react-i18next';

const InsuranceViewModal = ({
  isOpen,
  onClose,
  insurance,
  onEdit,
  onSetPrimary: _onSetPrimary,
  onFileUploadComplete,
  disableEdit = false,
  disableEditTooltip,
  practitioners = [],
}) => {
  const { t, i18n } = useTranslation(['common', 'shared', 'medical']);
  const { formatDate } = useDateFormat();

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');

  // Reset tab when modal opens with new insurance
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
  }, [isOpen, insurance?.id]);

  if (!insurance) return null;

  const pcpDisplay = resolveInsurancePcpDisplay(insurance, practitioners);

  // Flatten coverage_details/contact_info into the same flat shape the
  // Add/Edit form works with, so field lookups below match field.name.
  // A plain spread (not flattenNestedObject, which does `value || ''`)
  // preserves falsy-but-real values like a $0 copay or is_primary: false.
  const flatData = {
    ...insurance,
    ...(insurance.coverage_details || {}),
    ...(insurance.contact_info || {}),
  };

  const {
    basicFields,
    memberFields,
    coverageFields,
    contactFields,
    notesField,
  } = getInsuranceFieldsBySection(insurance.insurance_type);

  const coveragePeriodFields = coverageFields.filter(f =>
    INSURANCE_COVERAGE_PERIOD_FIELD_NAMES.includes(f.name)
  );
  const coverageDetailFields = coverageFields.filter(
    f => !INSURANCE_COVERAGE_PERIOD_FIELD_NAMES.includes(f.name)
  );

  const notSpecifiedText = t('shared:labels.notSpecified', 'Not specified');

  // Renders a single field as a read-only label/value pair, mirroring the
  // field types the Add/Edit form supports for this same field config.
  const renderFieldDisplay = field => {
    if (field.type === 'divider') return null;

    const translatedField = translateField(field, t);
    const rawValue = flatData[field.name];
    const hasValue =
      rawValue !== undefined && rawValue !== null && rawValue !== '';

    let valueNode;

    switch (field.type) {
      case 'select': {
        const option = (translatedField.options || []).find(
          o => o.value === rawValue
        );
        valueNode = (
          <Text size="sm" c={hasValue ? 'inherit' : 'dimmed'}>
            {hasValue ? option?.label || rawValue : notSpecifiedText}
          </Text>
        );
        break;
      }

      case 'date': {
        valueNode = (
          <Text size="sm" c={rawValue ? 'inherit' : 'dimmed'}>
            {rawValue
              ? formatDate(rawValue)
              : field.name === 'expiration_date'
                ? t('shared:labels.ongoing', 'Ongoing')
                : notSpecifiedText}
          </Text>
        );
        break;
      }

      case 'checkbox': {
        valueNode = (
          <Text size="sm">
            {rawValue
              ? t('common:labels.yes', 'Yes')
              : t('common:labels.no', 'No')}
          </Text>
        );
        break;
      }

      case 'practitionerSelect': {
        valueNode = (
          <Text size="sm" c={pcpDisplay ? 'inherit' : 'dimmed'}>
            {pcpDisplay || notSpecifiedText}
          </Text>
        );
        break;
      }

      case 'textarea': {
        valueNode = hasValue ? (
          <Paper withBorder p="sm" bg="var(--color-bg-secondary)">
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {rawValue}
            </Text>
          </Paper>
        ) : (
          <Text size="sm" c="dimmed">
            {notSpecifiedText}
          </Text>
        );
        break;
      }

      case 'url': {
        const normalizedUrl = hasValue ? String(rawValue) : '';
        valueNode = hasValue ? (
          <Anchor
            href={normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            {normalizedUrl.replace(/^https?:\/\//, '')}
          </Anchor>
        ) : (
          <Text size="sm" c="dimmed">
            {notSpecifiedText}
          </Text>
        );
        break;
      }

      case 'number': {
        const isCurrency = isFieldType(field.name, 'currency');
        valueNode = (
          <Text size="sm" c={hasValue ? 'inherit' : 'dimmed'}>
            {hasValue
              ? isCurrency
                ? formatCurrencyDisplay(rawValue, i18n.language)
                : rawValue
              : notSpecifiedText}
          </Text>
        );
        break;
      }

      case 'custom': {
        if (field.component !== 'TagInput') return null;

        const tags = Array.isArray(rawValue) ? rawValue : [];
        valueNode =
          tags.length > 0 ? (
            <Group gap="xs">
              {tags.map(tag => (
                <Badge key={tag} variant="light" size="sm">
                  {tag}
                </Badge>
              ))}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              {notSpecifiedText}
            </Text>
          );
        break;
      }

      default: {
        valueNode = (
          <Text size="sm" c={hasValue ? 'inherit' : 'dimmed'}>
            {hasValue ? rawValue : notSpecifiedText}
          </Text>
        );
      }
    }

    return (
      <Stack
        gap="xs"
        key={field.name}
        style={field.gridColumn === 12 ? { gridColumn: '1 / -1' } : undefined}
      >
        <Text fw={500} size="sm" c="dimmed">
          {translatedField.label}
        </Text>
        {valueNode}
      </Stack>
    );
  };

  const renderFieldGrid = fields => (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {fields.map(renderFieldDisplay)}
    </SimpleGrid>
  );

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={`${insurance.company_name} - ${t('insurance.viewModal.title', 'Insurance Details')}`}
      size="xl"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
        },
      }}
    >
      <Stack gap="lg">
        {/* Tabbed Content - mirrors InsuranceFormWrapper's tab structure */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
              {t('shared:tabs.basicInfo', 'Basic Info')}
            </Tabs.Tab>
            <Tabs.Tab value="member" leftSection={<IconUser size={16} />}>
              {t('insurance.form.tabs.member', 'Member')}
            </Tabs.Tab>
            <Tabs.Tab value="coverage" leftSection={<IconShield size={16} />}>
              {t('insurance.form.tabs.coverage', 'Coverage')}
            </Tabs.Tab>
            {contactFields.length > 0 && (
              <Tabs.Tab value="contact" leftSection={<IconPhone size={16} />}>
                {t('insurance.form.tabs.contact', 'Contact')}
              </Tabs.Tab>
            )}
            <Tabs.Tab
              value="documents"
              leftSection={<IconFileText size={16} />}
            >
              {t('shared:tabs.documents', 'Documents')}
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconFileText size={16} />}>
              {t('shared:tabs.notes', 'Notes')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Basic Info Tab */}
          <Tabs.Panel value="basic">
            <Box mt="md">{renderFieldGrid(basicFields)}</Box>
          </Tabs.Panel>

          {/* Member Info Tab */}
          <Tabs.Panel value="member">
            <Box mt="md">{renderFieldGrid(memberFields)}</Box>
          </Tabs.Panel>

          {/* Coverage Tab */}
          <Tabs.Panel value="coverage">
            <Box mt="md">
              <Stack gap="md">
                <div>
                  <Text fw={600} size="sm" mb="sm">
                    {t(
                      'insurance.form.coveragePeriodStatus',
                      'Coverage Period & Status'
                    )}
                  </Text>
                  {renderFieldGrid(coveragePeriodFields)}
                </div>

                {coverageDetailFields.length > 0 && (
                  <div>
                    <Divider mt="md" mb="md" />
                    <Text fw={600} size="sm" mb="sm">
                      {t(
                        'insurance.viewModal.coverageDetails',
                        'Coverage Details'
                      )}
                    </Text>
                    {renderFieldGrid(coverageDetailFields)}
                  </div>
                )}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Contact Tab */}
          {contactFields.length > 0 && (
            <Tabs.Panel value="contact">
              <Box mt="md">{renderFieldGrid(contactFields)}</Box>
            </Tabs.Panel>
          )}

          {/* Documents Tab */}
          <Tabs.Panel value="documents">
            <Box mt="md">
              <Stack gap="md">
                <Title order={4}>
                  {t(
                    'insurance.viewModal.attachedDocuments',
                    'Attached Documents'
                  )}
                </Title>
                <DocumentManagerWithProgress
                  entityType="insurance"
                  entityId={insurance.id}
                  mode="view"
                  onUploadComplete={(success, _completedCount, _failedCount) => {
                    if (onFileUploadComplete) {
                      onFileUploadComplete(success);
                    }
                  }}
                  onError={error => {
                    logger.error(
                      'Document manager error in insurance view:',
                      error
                    );
                  }}
                  showProgressModal={true}
                />
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Notes Tab */}
          <Tabs.Panel value="notes">
            <Box mt="md">
              <Stack gap="md">{notesField.map(renderFieldDisplay)}</Stack>
            </Box>
          </Tabs.Panel>
        </Tabs>

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            {t('shared:labels.close', 'Close')}
          </Button>
          <Tooltip
            label={disableEditTooltip}
            disabled={!disableEdit || !disableEditTooltip}
          >
            <span>
              <Button
                leftSection={<IconEdit size={16} />}
                onClick={() => {
                  onClose();
                  onEdit && onEdit(insurance);
                }}
                disabled={disableEdit}
              >
                {t('shared:labels.edit', 'Edit')}
              </Button>
            </span>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
};

export default InsuranceViewModal;
