/**
 * SearchPreviewPanel
 * Slide-out drawer showing details of a selected search result without
 * navigating away from the search page. Opens from the right side.
 *
 * Usage example:
 *   <SearchPreviewPanel
 *     opened={previewOpen}
 *     onClose={() => setPreviewOpen(false)}
 *     item={selectedRow}
 *     query="aspirin"
 *     selectedTags={['chronic']}
 *     getTagColor={(tag) => tagColors[tag] ?? null}
 *     onTagClick={(tag) => addTagFilter(tag)}
 *     formatDate={(date) => format(new Date(date), 'MMM d, yyyy')}
 *     onOpenFullRecord={(route) => navigate(route)}
 *   />
 */

import React from 'react';
import {
  Drawer,
  Stack,
  Group,
  Text,
  Divider,
  Badge,
  Button,
  ThemeIcon,
  Box,
  Highlight,
  Paper,
} from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ClickableTagBadge } from '../common/ClickableTagBadge';
import type { SearchResultRow } from './searchResultHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchPreviewPanelProps {
  opened: boolean;
  onClose: () => void;
  item: SearchResultRow | null;
  query?: string;
  selectedTags?: string[];
  getTagColor: (tag: string) => string | null;
  onTagClick: (tag: string) => void;
  formatDate: (date: string) => string;
  onOpenFullRecord: (route: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SearchPreviewPanel: React.FC<SearchPreviewPanelProps> = ({
  opened,
  onClose,
  item,
  query,
  selectedTags = [],
  getTagColor,
  onTagClick,
  formatDate,
  onOpenFullRecord,
}) => {
  const { t } = useTranslation('common');

  const hasQuery = typeof query === 'string' && query.trim().length > 0;

  const handleTagBadgeClick = (tag: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onTagClick(tag);
  };

  const handleOpenFullRecord = () => {
    if (item?.route) {
      onOpenFullRecord(item.route);
    }
  };

  const EntityIcon = item?.icon ?? null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group gap="sm">
          {EntityIcon && item && (
            <ThemeIcon size="md" color={item.color} variant="light" aria-hidden="true">
              <EntityIcon size={16} />
            </ThemeIcon>
          )}
          <Text fw={600} size="lg">
            {t('search.previewRecord')}
          </Text>
        </Group>
      }
      overlayProps={{ opacity: 0.5, blur: 4 }}
      zIndex={2500}
    >
      {item ? (
        <Stack gap="md" style={{ height: '100%' }}>
          {/* Type badge */}
          <Group gap="xs">
            <Badge
              color={item.color}
              variant="light"
              size="md"
              leftSection={
                EntityIcon ? (
                  <EntityIcon size={12} aria-hidden="true" />
                ) : undefined
              }
            >
              {item.typeLabel}
            </Badge>
          </Group>

          <Divider />

          {/* Title */}
          <Box>
            <Text size="xs" c="dimmed" fw={500} mb={4}>
              {t('search.columnName', 'Name')}
            </Text>
            {hasQuery ? (
              <Highlight
                highlight={query as string}
                fw={600}
                size="lg"
                highlightStyles={{
                  backgroundColor: 'var(--mantine-color-yellow-2)',
                  fontWeight: 700,
                  borderRadius: '2px',
                }}
              >
                {item.title || ''}
              </Highlight>
            ) : (
              <Text fw={600} size="lg">
                {item.title}
              </Text>
            )}
          </Box>

          {/* Subtitle / status */}
          {item.subtitle && (
            <Box>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                {t('search.columnDetails', 'Details')}
              </Text>
              <Text size="sm">{item.subtitle}</Text>
            </Box>
          )}

          {/* Date */}
          {item.date && (
            <Box>
              {item.dateLabel && (
                <Text size="xs" c="dimmed" fw={500} mb={4}>
                  {item.dateLabel}
                </Text>
              )}
              <Text size="sm">{formatDate(item.date)}</Text>
            </Box>
          )}

          <Divider />

          {/* Tags */}
          <Box>
            <Text size="xs" c="dimmed" fw={500} mb={6}>
              {t('search.tags', 'Tags')}
            </Text>
            {Array.isArray(item.tags) && item.tags.length > 0 ? (
              <Group gap={6} wrap="wrap">
                {item.tags.map((tag) => (
                  <ClickableTagBadge
                    key={tag}
                    tag={tag}
                    color={getTagColor(tag)}
                    size="sm"
                    highlighted={selectedTags.includes(tag)}
                    onClick={handleTagBadgeClick(tag)}
                  />
                ))}
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                {t('labels.none', '\u2014')}
              </Text>
            )}
          </Box>

          {/* Spacer pushes button to bottom */}
          <Box style={{ flex: 1 }} />

          {/* Open Full Record button */}
          <Paper withBorder p="md" radius="md">
            <Button
              fullWidth
              leftSection={<IconExternalLink size={16} />}
              onClick={handleOpenFullRecord}
              variant="filled"
            >
              {t('search.openFullRecord')}
            </Button>
          </Paper>
        </Stack>
      ) : (
        <Stack align="center" justify="center" style={{ height: '100%', minHeight: 200 }}>
          <Text size="sm" c="dimmed">
            {t('search.previewRecord')}
          </Text>
        </Stack>
      )}
    </Drawer>
  );
};

export default SearchPreviewPanel;
