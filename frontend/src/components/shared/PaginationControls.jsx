import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Group, Pagination, Select, Text } from '@mantine/core';

/**
 * Shared pagination controls for medical record pages.
 * Shows page navigation, "Showing X-Y of Z" text, and page size selector.
 * Always renders when totalRecords > 0, including single-page results.
 */
const PaginationControls = ({
  page,
  totalPages,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}) => {
  const { t } = useTranslation('common');

  if (!totalRecords || totalRecords <= 0) return null;

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);

  return (
    <Group justify="space-between" align="center" mt="md">
      <Text size="sm" c="dimmed">
        {t(
          'pagination.showingRange',
          'Showing {{start}} to {{end}} of {{total}} results',
          {
            start: startIndex + 1,
            end: endIndex,
            total: totalRecords,
          }
        )}
      </Text>

      <Pagination
        total={totalPages}
        value={page}
        onChange={onPageChange}
        size="sm"
        withEdges
        siblings={1}
        boundaries={1}
      />

      <Group gap="xs">
        <Text size="sm" c="dimmed">
          {t('pagination.itemsPerPage', 'Items per page')}:
        </Text>
        <Select
          value={String(pageSize)}
          onChange={onPageSizeChange}
          data={pageSizeOptions}
          size="xs"
          w={70}
          allowDeselect={false}
          aria-label={t('pagination.itemsPerPage', 'Items per page')}
        />
      </Group>
    </Group>
  );
};

PaginationControls.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  totalRecords: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  pageSizeOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default PaginationControls;
