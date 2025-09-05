import React from 'react';
import { formatDate } from '../../utils/helpers';
import { Table, ScrollArea, ActionIcon, Group, Text, Title, Stack, Card } from '@mantine/core';
import { IconEye, IconEdit, IconTrash } from '@tabler/icons-react';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import MantineResponsiveAdapter from '../../adapters/MantineResponsiveAdapter';
import { useResponsive } from '../../hooks/useResponsive';

const MedicalTable = ({
  data,
  columns,
  patientData,
  tableName,
  onEdit,
  onDelete,
  onView,
  formatters = {},
}) => {
  const responsive = useResponsive();

  if (!data || data.length === 0) {
    return null;
  }

  // Get responsive table configuration
  const tableConfig = MantineResponsiveAdapter.createTableProps(responsive.breakpoint, {
    enableHorizontalScroll: true,
    priorityColumns: columns.slice(0, 2).map(col => col.accessor), // First 2 columns are priority
    compactOnMobile: true
  });

  // Create responsive components
  const ResponsiveCard = ResponsiveComponentFactory.createMantine(Card, {
    padding: { xs: 'xs', md: 'sm', lg: 'md' },
    shadow: { xs: 'xs', md: 'sm' },
    radius: { xs: 'xs', md: 'sm' }
  });

  const ResponsiveTitle = ResponsiveComponentFactory.createMantine(Title, {
    order: { xs: 4, md: 3, lg: 2 },
    size: { xs: 'h4', md: 'h3' }
  });

  const ResponsiveText = ResponsiveComponentFactory.createMantine(Text, {
    size: { xs: 'xs', md: 'sm' }
  });

  // Mobile card view for very small screens
  if (responsive.breakpoint === 'xs' && data.length > 0) {
    return (
      <Stack spacing="md">
        <Stack spacing="xs" className="print-header">
          <ResponsiveTitle>
            {tableName} - {patientData?.first_name} {patientData?.last_name}
          </ResponsiveTitle>
          <ResponsiveText color="dimmed">
            Generated on: {formatDate(new Date().toISOString())}
          </ResponsiveText>
        </Stack>

        {data.map(item => (
          <ResponsiveCard key={item.id}>
            <Stack spacing="xs">
              {columns.slice(0, 3).map((column, index) => ( // Show only first 3 columns on mobile
                <Group position="apart" noWrap>
                  <Text size="xs" weight={500} color="dimmed">
                    {column.header}:
                  </Text>
                  <Text size="sm">
                    {formatters[column.accessor]
                      ? formatters[column.accessor](item[column.accessor], item)
                      : item[column.accessor] || '-'}
                  </Text>
                </Group>
              ))}
              
              <Group spacing="xs" mt="xs" className="no-print">
                {onView && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => onView(item)}
                    aria-label="View"
                  >
                    <IconEye size={14} />
                  </ActionIcon>
                )}
                {onEdit && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => onEdit(item)}
                    aria-label="Edit"
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                )}
                {onDelete && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete"
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Stack>
          </ResponsiveCard>
        ))}
      </Stack>
    );
  }

  // Table view for larger screens
  return (
    <Stack spacing="md">
      <Stack spacing="xs" className="print-header">
        <ResponsiveTitle>
          {tableName} - {patientData?.first_name} {patientData?.last_name}
        </ResponsiveTitle>
        <ResponsiveText color="dimmed">
          Generated on: {formatDate(new Date().toISOString())}
        </ResponsiveText>
      </Stack>

      <ScrollArea>
        <Table
          {...tableConfig.props}
          striped
          highlightOnHover
          style={{ minWidth: tableConfig.config.enableScroll ? tableConfig.config.minWidth : 'auto' }}
        >
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index}>{column.header}</th>
              ))}
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id}>
                {columns.map((column, index) => (
                  <td key={index}>
                    {formatters[column.accessor]
                      ? formatters[column.accessor](item[column.accessor], item)
                      : item[column.accessor] || '-'}
                  </td>
                ))}
                <td className="no-print">
                  <Group spacing="xs" noWrap>
                    {onView && (
                      <ActionIcon
                        size={responsive.isMobile ? 'sm' : 'md'}
                        variant="subtle"
                        onClick={() => onView(item)}
                        aria-label="View"
                      >
                        <IconEye size={responsive.isMobile ? 14 : 16} />
                      </ActionIcon>
                    )}
                    {onEdit && (
                      <ActionIcon
                        size={responsive.isMobile ? 'sm' : 'md'}
                        variant="subtle"
                        onClick={() => onEdit(item)}
                        aria-label="Edit"
                      >
                        <IconEdit size={responsive.isMobile ? 14 : 16} />
                      </ActionIcon>
                    )}
                    {onDelete && (
                      <ActionIcon
                        size={responsive.isMobile ? 'sm' : 'md'}
                        variant="subtle"
                        color="red"
                        onClick={() => onDelete(item.id)}
                        aria-label="Delete"
                      >
                        <IconTrash size={responsive.isMobile ? 14 : 16} />
                      </ActionIcon>
                    )}
                  </Group>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
};

export default MedicalTable;
