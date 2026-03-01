/**
 * SearchResultsHeader
 * Contains the search bar, active filter chips, result count, and view toggle.
 * Extracted from SearchResults to keep the orchestrator lean.
 */

import React from 'react';
import {
  Paper,
  Group,
  Text,
  TextInput,
  Button,
  Badge,
  SegmentedControl,
  CloseButton,
  Flex,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import {
  IconSearch,
  IconTag,
  IconLayoutGrid,
  IconTable,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { RECORD_TYPES } from './SearchFilterSidebar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResultsHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
  loading: boolean;
  selectedTypes: string[];
  onTypeToggle: (type: string) => void;
  selectedTags: string[];
  onTagRemove: (tag: string) => void;
  matchMode: string;
  hasActiveFilters: boolean;
  getTagColor: (tag: string) => string | null;
  resultCount: number;
  isSearching: boolean;
  hasPatient: boolean;
  viewMode: string;
  onViewModeChange: (mode: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchResultsHeader({
  query,
  onQueryChange,
  onSearch,
  loading,
  selectedTypes,
  onTypeToggle,
  selectedTags,
  onTagRemove,
  matchMode,
  hasActiveFilters,
  getTagColor,
  resultCount,
  isSearching,
  hasPatient,
  viewMode,
  onViewModeChange,
}: SearchResultsHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <>
      {/* Active Filter Chips */}
      {(hasActiveFilters || matchMode === 'all') && (
        <Group gap="xs" mb="sm">
          <Text size="xs" fw={500} c="dimmed">{t('search.activeFilters')}:</Text>
          {selectedTypes.map(type => {
            const typeConfig = RECORD_TYPES.find(rt => rt.value === type);
            return (
              <Badge
                key={type}
                color={typeConfig?.color}
                variant="light"
                size="sm"
                rightSection={
                  <CloseButton
                    size="xs"
                    variant="transparent"
                    onClick={() => onTypeToggle(type)}
                    aria-label={`Remove ${typeConfig?.label} filter`}
                  />
                }
              >
                {typeConfig?.label}
              </Badge>
            );
          })}
          {selectedTags.map(tag => (
            <Badge
              key={tag}
              color={getTagColor(tag)}
              variant="light"
              size="sm"
              leftSection={<IconTag size="0.6rem" />}
              rightSection={
                <CloseButton
                  size="xs"
                  variant="transparent"
                  onClick={() => onTagRemove(tag)}
                  aria-label={`Remove ${tag} tag`}
                />
              }
            >
              {tag}
            </Badge>
          ))}
          {matchMode === 'all' && selectedTags.length >= 2 && (
            <Badge color="gray" variant="outline" size="sm">
              {t('search.matchAll')}
            </Badge>
          )}
        </Group>
      )}

      {/* Search Bar */}
      <Paper p="md" withBorder mb="md">
        <form onSubmit={onSearch}>
          <Flex gap="sm" align="end" wrap="wrap">
            <TextInput
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              leftSection={<IconSearch size="1rem" />}
              style={{ flex: 1, minWidth: '200px' }}
              size="md"
            />
            <Button
              type="submit"
              loading={loading}
              size="md"
              style={{ flexShrink: 0 }}
            >
              {t('buttons.search')}
            </Button>
          </Flex>
        </form>
      </Paper>

      {/* Results Header with view toggle */}
      {hasPatient && !isSearching && (
        <Group justify="space-between" mb="xs">
          <Text size="sm" c="dimmed">
            {t('search.resultCount', { count: resultCount })}
            {query && (
              <> {t('search.filtered')}</>
            )}
          </Text>
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={onViewModeChange}
            data={[
              {
                value: 'table',
                label: (
                  <Tooltip label={t('search.viewTable')} withArrow>
                    <ActionIcon variant="transparent" size="xs" aria-label={t('search.viewTable')}>
                      <IconTable size="0.9rem" />
                    </ActionIcon>
                  </Tooltip>
                ),
              },
              {
                value: 'cards',
                label: (
                  <Tooltip label={t('search.viewCards')} withArrow>
                    <ActionIcon variant="transparent" size="xs" aria-label={t('search.viewCards')}>
                      <IconLayoutGrid size="0.9rem" />
                    </ActionIcon>
                  </Tooltip>
                ),
              },
            ]}
          />
        </Group>
      )}
    </>
  );
}
