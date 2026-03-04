/**
 * SearchResultCard
 * Compact card for displaying a single search result in card view.
 * Used by the SearchResults page when the user switches to card layout.
 *
 * Usage example:
 *   <SearchResultCard
 *     row={mergedResultRow}
 *     query="aspirin"
 *     selectedTags={['chronic', 'cardio']}
 *     getTagColor={(tag) => tagColorMap[tag] ?? null}
 *     onTagClick={(tag) => handleTagClick(tag)}
 *     onClick={(row) => navigate(row.route)}
 *     isSelected={false}
 *     formatDate={(date) => format(new Date(date), 'MMM d, yyyy')}
 *   />
 */

import React from 'react';
import { Card, Group, Stack, Text, ThemeIcon, Highlight } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ClickableTagBadge } from '../common/ClickableTagBadge';
import type { SearchResultRow } from './searchResultHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResultCardProps {
  row: SearchResultRow;
  query?: string;
  selectedTags?: string[];
  getTagColor: (tag: string) => string | null;
  onTagClick: (tag: string) => void;
  onClick: (row: SearchResultRow) => void;
  isSelected?: boolean;
  formatDate: (date: string) => string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of tag badges rendered inline before showing an overflow count. */
const MAX_VISIBLE_TAGS = 3;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchResultCard({
  row,
  query,
  selectedTags = [],
  getTagColor,
  onTagClick,
  onClick,
  isSelected = false,
  formatDate,
}: SearchResultCardProps) {
  const { t } = useTranslation('common');
  const EntityIcon = row.icon;
  const hasQuery = typeof query === 'string' && query.trim().length > 0;
  const visibleTags = Array.isArray(row.tags) ? row.tags.slice(0, MAX_VISIBLE_TAGS) : [];
  const overflowCount =
    Array.isArray(row.tags) && row.tags.length > MAX_VISIBLE_TAGS
      ? row.tags.length - MAX_VISIBLE_TAGS
      : 0;

  const handleCardClick = () => {
    onClick(row);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(row);
    }
  };

  const handleTagBadgeClick = (tag: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onTagClick(tag);
  };

  return (
    <Card
      withBorder
      radius="md"
      shadow="xs"
      role="button"
      tabIndex={0}
      aria-label={t('search.previewRecord')}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      style={{
        cursor: 'pointer',
        borderLeft: `4px solid var(--mantine-color-${row.color}-6, ${row.color})`,
        outline: isSelected
          ? '2px solid var(--mantine-color-blue-5)'
          : undefined,
        outlineOffset: isSelected ? '2px' : undefined,
        transition: 'box-shadow 0.15s ease',
        height: '100%',
      }}
    >
      <Stack gap="xs">
        {/* Top row: icon + type label */}
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon
            size="sm"
            color={row.color}
            variant="light"
            aria-hidden="true"
          >
            <EntityIcon size="0.8rem" />
          </ThemeIcon>
          <Text size="xs" c="dimmed" truncate>
            {row.typeLabel}
          </Text>
        </Group>

        {/* Title with optional query highlight */}
        {hasQuery ? (
          <Highlight
            highlight={query as string}
            fw={500}
            size="sm"
            highlightStyles={{
              backgroundColor: 'var(--mantine-color-yellow-2)',
              fontWeight: 600,
              borderRadius: '2px',
            }}
          >
            {row.title || ''}
          </Highlight>
        ) : (
          <Text fw={500} size="sm" lineClamp={2}>
            {row.title}
          </Text>
        )}

        {/* Subtitle */}
        {row.subtitle && (
          <Text size="xs" c="dimmed" truncate>
            {row.subtitle}
          </Text>
        )}

        {/* Date row */}
        {row.date && (
          <Group gap={4} wrap="nowrap">
            {row.dateLabel && (
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                {row.dateLabel}:
              </Text>
            )}
            <Text size="xs" truncate>
              {formatDate(row.date)}
            </Text>
          </Group>
        )}

        {/* Tags row */}
        {visibleTags.length > 0 && (
          <Group gap={4} wrap="wrap">
            {visibleTags.map((tag) => (
              <ClickableTagBadge
                key={tag}
                tag={tag}
                color={getTagColor(tag)}
                size="xs"
                compact
                highlighted={selectedTags.includes(tag)}
                onClick={handleTagBadgeClick(tag)}
              />
            ))}
            {overflowCount > 0 && (
              <Text size="xs" c="dimmed" aria-label={t('labels.other')}>
                +{overflowCount}
              </Text>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
