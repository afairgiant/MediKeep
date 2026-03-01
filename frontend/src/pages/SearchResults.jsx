/**
 * SearchResults Page
 * Orchestrator for full-page search with table/card views, collapsible filter
 * sidebar, preview panel, search history, pagination, and date-range filtering.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Stack,
  Group,
  Text,
  Loader,
  Alert,
  Pagination,
  Select,
  Skeleton,
  Table,
  ScrollArea,
  Tooltip,
  Flex,
  ActionIcon,
  ThemeIcon,
  Highlight,
} from '@mantine/core';
import { IconSearch, IconArrowLeft, IconUser, IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { PageHeader } from '../components';
import { searchService } from '../services/searchService';
import { apiService } from '../services/api';
import { ClickableTagBadge } from '../components/common/ClickableTagBadge';
import {
  SearchFilterSidebar,
  SearchResultCard,
  SearchPreviewPanel,
  SearchResultsHeader,
  ICON_MAP,
  FALLBACK_ICON,
  TYPE_LABEL_MAP,
  RECORD_TYPE_TO_TAG_ENTITY,
  getItemDateWithLabel,
  flattenTagResults,
  toISODateStr,
} from '../components/search';
import AnimatedCardGrid from '../components/shared/AnimatedCardGrid';
import EmptyState from '../components/shared/EmptyState';
import { useTagColors } from '../hooks/useTagColors';
import { useCurrentPatient } from '../hooks/useGlobalData';
import { useDateFormat } from '../hooks/useDateFormat';
import { usePersistedViewMode } from '../hooks/usePersistedViewMode';
import { useSearchHistory } from '../hooks/useSearchHistory';
import logger from '../services/logger';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = ['10', '20', '50'];

const SearchResults = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { patient: currentPatient } = useCurrentPatient();
  const { formatDate } = useDateFormat();
  const { getTagColor, tagEntries, isLoading: isLoadingTags } = useTagColors();
  const { t } = useTranslation('common');
  const initialLoadDone = useRef(false);
  const initialTagSearchDone = useRef(false);
  const [viewMode, setViewMode] = usePersistedViewMode('search', 'table');
  const { addEntry: addHistoryEntry } = useSearchHistory();

  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // Tag search state
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagResults, setTagResults] = useState(null);
  const [isLoadingTagSearch, setIsLoadingTagSearch] = useState(false);
  const [matchMode, setMatchMode] = useState(searchParams.get('match_mode') || 'any');

  // Filter and pagination state
  const [selectedTypes, setSelectedTypes] = useState(() => {
    const typesParam = searchParams.get('types');
    return typesParam ? typesParam.split(',').filter(Boolean) : [];
  });
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'date_desc');
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const sizeParam = searchParams.get('per_page');
    const parsed = parseInt(sizeParam, 10);
    return PAGE_SIZE_OPTIONS.includes(String(parsed)) ? parsed : DEFAULT_PAGE_SIZE;
  });

  // Date range state
  const [dateRange, setDateRange] = useState(() => {
    const from = searchParams.get('date_from');
    const to = searchParams.get('date_to');
    return [
      from ? new Date(from + 'T00:00:00') : null,
      to ? new Date(to + 'T23:59:59') : null,
    ];
  });

  // Preview panel state
  const [previewItem, setPreviewItem] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Popular tags from useTagColors (single source of truth, no duplicate API call)
  const popularTags = useMemo(
    () => tagEntries.map(e => ({ tag: e.tag, color: e.color, usage_count: e.usage_count })),
    [tagEntries]
  );

  // ---------------------------------------------------------------------------
  // Tag search
  // ---------------------------------------------------------------------------

  const performTagSearch = useCallback(async (tags, types, matchModeOverride) => {
    if (!tags || tags.length === 0) {
      setTagResults(null);
      return;
    }

    const typesToUse = types !== undefined ? types : selectedTypes;
    let entityTypes = null;
    if (typesToUse && typesToUse.length > 0) {
      entityTypes = typesToUse
        .map(t => RECORD_TYPE_TO_TAG_ENTITY[t])
        .filter(Boolean);
      if (entityTypes.length === 0) {
        setTagResults({});
        return;
      }
    }

    const modeToUse = matchModeOverride !== undefined ? matchModeOverride : matchMode;
    setIsLoadingTagSearch(true);
    setError(null);

    try {
      const tagParams = new URLSearchParams();
      tags.forEach(t => tagParams.append('tags', t));
      tagParams.append('limit_per_entity', '20');
      if (entityTypes) {
        entityTypes.forEach(et => tagParams.append('entity_types', et));
      }
      if (modeToUse === 'all') {
        tagParams.append('match_mode', 'all');
      }

      const data = await apiService.get(`/tags/search?${tagParams.toString()}`);
      setTagResults(data);

      logger.info('tag_search_success', 'Tag search completed', {
        tagCount: tags.length,
        matchMode: modeToUse,
        component: 'SearchResults'
      });
    } catch (err) {
      logger.error('tag_search_error', 'Tag search failed', {
        error: err.message,
        tags,
        component: 'SearchResults'
      });
      setError(t('search.tagSearchFailed'));
      setTagResults(null);
    } finally {
      setIsLoadingTagSearch(false);
    }
  }, [selectedTypes, matchMode, t]);

  // ---------------------------------------------------------------------------
  // URL sync
  // ---------------------------------------------------------------------------

  const updateUrlParams = ({ q, tags, matchMode: modeOverride, types, sort, page, perPage, dateFrom, dateTo } = {}) => {
    const newParams = {};
    const queryVal = q !== undefined ? q : query;
    const tagsVal = tags !== undefined ? tags : selectedTags;
    const modeVal = modeOverride !== undefined ? modeOverride : matchMode;
    const typesVal = types !== undefined ? types : selectedTypes;
    const sortVal = sort !== undefined ? sort : sortBy;
    const pageVal = page !== undefined ? page : currentPage;
    const perPageVal = perPage !== undefined ? perPage : String(pageSize);
    const dateFromVal = dateFrom !== undefined ? dateFrom : toISODateStr(dateRange[0]);
    const dateToVal = dateTo !== undefined ? dateTo : toISODateStr(dateRange[1]);

    if (queryVal) newParams.q = queryVal;
    if (tagsVal && tagsVal.length > 0) newParams.tags = tagsVal.join(',');
    if (modeVal === 'all') newParams.match_mode = 'all';
    if (typesVal && typesVal.length > 0) newParams.types = typesVal.join(',');
    if (sortVal && sortVal !== 'date_desc') newParams.sort = sortVal;
    if (pageVal > 1) newParams.page = String(pageVal);
    if (perPageVal && perPageVal !== String(DEFAULT_PAGE_SIZE)) newParams.per_page = perPageVal;
    if (dateFromVal) newParams.date_from = dateFromVal;
    if (dateToVal) newParams.date_to = dateToVal;

    setSearchParams(newParams);
  };

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleTagChange = (newTags) => {
    setSelectedTags(newTags);
    updateUrlParams({ tags: newTags });
    performTagSearch(newTags, selectedTypes);
  };

  const handleTagClick = (tag) => {
    if (!selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      updateUrlParams({ tags: newTags });
      performTagSearch(newTags, selectedTypes);
    }
  };

  const handleTagRemove = (tagToRemove) => {
    const newTags = selectedTags.filter(t => t !== tagToRemove);
    setSelectedTags(newTags);
    updateUrlParams({ tags: newTags });
    performTagSearch(newTags, selectedTypes);
  };

  const handleMatchModeChange = (mode) => {
    setMatchMode(mode);
    updateUrlParams({ matchMode: mode });
    if (selectedTags.length >= 2) {
      performTagSearch(selectedTags, selectedTypes, mode);
    }
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setCurrentPage(1);
    const dateFrom = toISODateStr(range[0]);
    const dateTo = toISODateStr(range[1]);
    updateUrlParams({ dateFrom: dateFrom || '', dateTo: dateTo || '', page: 1 });
    performSearch(query, 1, null, null, range);
  };

  // ---------------------------------------------------------------------------
  // Text search
  // ---------------------------------------------------------------------------

  const performSearch = async (searchQuery = '', page = 1, types = null, sort = null, dateRangeOverride = null) => {
    if (!currentPatient?.id) {
      setError(t('search.noPatientTitle'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const typesToUse = types !== null ? types : selectedTypes;
      const sortToUse = sort !== null ? sort : sortBy;
      const rangesToUse = dateRangeOverride !== null ? dateRangeOverride : dateRange;
      const options = {
        limit: 100,
        skip: 0,
        sort: sortToUse
      };
      if (typesToUse.length > 0) {
        options.types = typesToUse;
      }
      const dateFrom = toISODateStr(rangesToUse[0]);
      const dateTo = toISODateStr(rangesToUse[1]);
      if (dateFrom) options.date_from = dateFrom;
      if (dateTo) options.date_to = dateTo;

      logger.info('search_page_request', 'Performing search', {
        query: searchQuery || '(all)',
        patientId: currentPatient.id,
        options,
        component: 'SearchResults'
      });

      const { results: searchResults, totalCount: backendTotal } =
        await searchService.searchWithPagination(
          searchQuery,
          currentPatient.id,
          options
        );

      setResults(searchResults);
      setTotalCount(backendTotal);

      logger.info('search_page_success', 'Search completed', {
        resultCount: searchResults.length,
        totalCount: backendTotal,
        component: 'SearchResults'
      });
    } catch (err) {
      logger.error('search_page_error', 'Search failed', {
        error: err.message,
        query: searchQuery,
        component: 'SearchResults'
      });
      setError(t('search.searchFailed'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    updateUrlParams({ q: query, page: 1 });
    addHistoryEntry(query, selectedTags, matchMode);
    performSearch(query, 1);
  };

  const handleTypeToggle = (type) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];

    setSelectedTypes(newTypes);
    setCurrentPage(1);
    updateUrlParams({ types: newTypes, page: 1 });
    performSearch(query, 1, newTypes);

    if (selectedTags.length > 0) {
      performTagSearch(selectedTags, newTypes);
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setCurrentPage(1);
    updateUrlParams({ sort: newSort, page: 1 });
    performSearch(query, 1, null, newSort);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    updateUrlParams({ page });
    performSearch(query, page);
  };

  const handlePageSizeChange = (val) => {
    const newSize = parseInt(val, 10) || DEFAULT_PAGE_SIZE;
    setPageSize(newSize);
    setCurrentPage(1);
    updateUrlParams({ page: 1, perPage: String(newSize) });
  };

  // Row/card click opens preview panel (does NOT navigate)
  const handleRowClick = (row) => {
    setPreviewItem(row);
    setPreviewOpen(true);
  };

  // "Open Full Record" from preview panel navigates to entity page
  const handleOpenFullRecord = (route) => {
    setPreviewOpen(false);
    navigate(route);
  };

  const handleClearFilters = () => {
    setSelectedTypes([]);
    setSelectedTags([]);
    setSortBy('date_desc');
    setCurrentPage(1);
    setTagResults(null);
    setMatchMode('any');
    setQuery('');
    setDateRange([null, null]);
    setSearchParams({});
    performSearch('', 1, [], 'date_desc');
  };

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!currentPatient?.id) return;
    if (!initialLoadDone.current) {
      // First load: use URL query and page
      initialLoadDone.current = true;
      const urlQuery = searchParams.get('q') || '';
      if (urlQuery) {
        setQuery(urlQuery);
      }
      performSearch(urlQuery, currentPage);
    } else {
      // Patient changed after initial load: reset to page 1
      performSearch(query, 1);
    }
  }, [currentPatient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialTagSearchDone.current || isLoadingTags) return;
    const tagsParam = searchParams.get('tags');
    const urlMatchMode = searchParams.get('match_mode');
    if (urlMatchMode === 'all') {
      setMatchMode('all');
    }
    if (tagsParam) {
      const urlTags = tagsParam.split(',').map(t => decodeURIComponent(t.trim())).filter(Boolean);
      if (urlTags.length > 0) {
        setSelectedTags(urlTags);
        initialTagSearchDone.current = true;
        performTagSearch(urlTags, selectedTypes, urlMatchMode === 'all' ? 'all' : 'any');
      }
    }
  }, [isLoadingTags, searchParams, performTagSearch, selectedTypes]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const hasActiveFilters =
    selectedTypes.length > 0 ||
    selectedTags.length > 0 ||
    dateRange[0] !== null ||
    dateRange[1] !== null;
  const isSearching = loading || isLoadingTagSearch;

  // All results are paginated client-side. The backend returns per-type batches
  // (not a single global page), so we combine everything and slice here.
  const allFilteredResults = useMemo(() => {
    const textRows = results.map(result => {
      const IconComponent = ICON_MAP[result.icon] || FALLBACK_ICON;
      const dateInfo = getItemDateWithLabel(result.type, result.data || result);
      return {
        type: result.type,
        id: result.id,
        title: result.title,
        subtitle: result.subtitle,
        date: result.date,
        dateLabel: dateInfo.label,
        icon: IconComponent,
        color: result.color || 'gray',
        typeLabel: TYPE_LABEL_MAP[result.type] || result.type.replace('_', ' '),
        tags: result.tags || [],
        route: searchService.getRecordRoute(result.type, result.id),
        _source: 'text'
      };
    });

    const hasTagFilter = selectedTags.length > 0;
    const tagRows = flattenTagResults(tagResults);

    // No tag filter active: show text results only
    if (!hasTagFilter) return textRows;

    // Tag filter active but no text query: show tag results only
    if (!query || !query.trim()) return tagRows;

    // Both active: filter tag results by query text client-side
    const q = query.trim().toLowerCase();
    return tagRows.filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.subtitle?.toLowerCase().includes(q)
    );
  }, [results, tagResults, selectedTags, query]);

  // Client-side page slice
  const mergedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allFilteredResults.slice(start, start + pageSize);
  }, [allFilteredResults, currentPage, pageSize]);

  const totalPages = Math.ceil(allFilteredResults.length / pageSize);

  // ---------------------------------------------------------------------------
  // Sortable column header helper
  // ---------------------------------------------------------------------------

  const getSortIcon = (columnAsc, columnDesc) => {
    if (sortBy === columnAsc) return <IconChevronUp size="0.75rem" />;
    if (sortBy === columnDesc) return <IconChevronDown size="0.75rem" />;
    return <IconSelector size="0.75rem" />;
  };

  const handleColumnSort = (columnAsc, columnDesc) => {
    // Cycle: default → asc → desc → asc
    const next = sortBy === columnAsc ? columnDesc : columnAsc;
    handleSortChange(next);
  };

  // ---------------------------------------------------------------------------
  // Table row renderer
  // ---------------------------------------------------------------------------

  const renderTableRow = (row) => {
    const EntityIcon = row.icon;
    const hasTextQuery = query && query.trim().length > 0;
    const isSelected = previewOpen && previewItem?.type === row.type && previewItem?.id === row.id;

    return (
      <Table.Tr
        key={`${row.type}-${row.id}`}
        onClick={() => handleRowClick(row)}
        style={{
          cursor: 'pointer',
          outline: isSelected ? '2px solid var(--mantine-color-blue-5)' : undefined,
          outlineOffset: isSelected ? '-2px' : undefined,
        }}
      >
        <Table.Td style={{ width: 140 }}>
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon size="sm" color={row.color} variant="light">
              <EntityIcon size="0.8rem" />
            </ThemeIcon>
            <Text size="xs" c="dimmed" truncate>{row.typeLabel}</Text>
          </Group>
        </Table.Td>
        <Table.Td>
          {hasTextQuery ? (
            <Highlight
              highlight={query}
              fw={500}
              size="sm"
              truncate
              highlightStyles={{
                backgroundColor: 'var(--mantine-color-yellow-2)',
                fontWeight: 600
              }}
            >
              {row.title || ''}
            </Highlight>
          ) : (
            <Text fw={500} size="sm" truncate>{row.title}</Text>
          )}
          {row.subtitle && (
            <Text size="xs" c="dimmed" truncate>{row.subtitle}</Text>
          )}
        </Table.Td>
        <Table.Td style={{ width: 180 }}>
          {row.date ? (
            <>
              {row.dateLabel && <Text size="xs" c="dimmed">{row.dateLabel}</Text>}
              <Text size="xs">{formatDate(row.date)}</Text>
            </>
          ) : (
            <Text size="xs" c="dimmed">{'\u2014'}</Text>
          )}
        </Table.Td>
        <Table.Td style={{ width: 200 }}>
          {Array.isArray(row.tags) && row.tags.length > 0 ? (
            <Group gap={4} wrap="wrap">
              {row.tags.slice(0, 3).map((tag) => (
                <ClickableTagBadge
                  key={tag}
                  tag={tag}
                  color={getTagColor(tag)}
                  size="xs"
                  compact
                  highlighted={selectedTags.includes(tag)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTagClick(tag);
                  }}
                />
              ))}
              {row.tags.length > 3 && (
                <Text size="xs" c="dimmed">+{row.tags.length - 3}</Text>
              )}
            </Group>
          ) : (
            <Text size="xs" c="dimmed">{'\u2014'}</Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Container size="xl" py="md">
      <PageHeader
        title={t('search.title')}
        subtitle={t('search.subtitle')}
        leftSection={
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => navigate(-1)}
            aria-label={t('buttons.back')}
          >
            <IconArrowLeft size="1.2rem" />
          </ActionIcon>
        }
      />

      <Flex gap="md" align="flex-start">
        {/* Collapsible filter sidebar */}
        <SearchFilterSidebar
          selectedTypes={selectedTypes}
          onTypeToggle={handleTypeToggle}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          selectedTags={selectedTags}
          onTagChange={handleTagChange}
          matchMode={matchMode}
          onMatchModeChange={handleMatchModeChange}
          popularTags={popularTags}
          isLoadingTags={isLoadingTags}
          onTagClick={handleTagClick}
          hasActiveFilters={hasActiveFilters}
          query={query}
          onClearFilters={handleClearFilters}
          getTagColor={getTagColor}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
        />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchResultsHeader
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            loading={loading}
            selectedTypes={selectedTypes}
            onTypeToggle={handleTypeToggle}
            selectedTags={selectedTags}
            onTagRemove={handleTagRemove}
            matchMode={matchMode}
            hasActiveFilters={hasActiveFilters}
            getTagColor={getTagColor}
            resultCount={allFilteredResults.length}
            isSearching={isSearching}
            hasPatient={Boolean(currentPatient?.id)}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* No patient */}
          {!currentPatient?.id && (
            <EmptyState
              icon={IconUser}
              title={t('search.noPatientTitle')}
              message={t('search.noPatientMessage')}
            />
          )}

          {/* Error */}
          {error && <Alert color="red" mb="md">{error}</Alert>}

          {/* Loading */}
          {isSearching && (
            <>
              <Group gap="xs" mb="md">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">{t('search.searching')}</Text>
              </Group>
              <Stack gap="xs">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Group key={i} gap="md" wrap="nowrap" p="xs">
                    <Skeleton height={24} width={24} radius="md" />
                    <Skeleton height={14} width="25%" />
                    <Skeleton height={14} width="35%" />
                    <Skeleton height={14} width="15%" />
                    <Skeleton height={14} width="10%" />
                  </Group>
                ))}
              </Stack>
            </>
          )}

          {/* Table view */}
          {currentPatient?.id && !isSearching && mergedResults.length > 0 && viewMode === 'table' && (
            <Paper withBorder>
              <ScrollArea>
                <Table highlightOnHover striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 140 }}>
                        <Text size="sm" fw={500}>{t('search.columnType', 'Type')}</Text>
                      </Table.Th>
                      <Table.Th
                        onClick={() => handleColumnSort('title', 'title_desc')}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" fw={500}>{t('search.columnName', 'Name')}</Text>
                          {getSortIcon('title', 'title_desc')}
                        </Group>
                      </Table.Th>
                      <Table.Th
                        onClick={() => handleColumnSort('date_asc', 'date_desc')}
                        style={{ cursor: 'pointer', userSelect: 'none', width: 180 }}
                      >
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" fw={500}>{t('search.columnDate', 'Date')}</Text>
                          {getSortIcon('date_asc', 'date_desc')}
                        </Group>
                      </Table.Th>
                      <Table.Th style={{ width: 200 }}>
                        <Text size="sm" fw={500}>{t('search.tags')}</Text>
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {mergedResults.map(renderTableRow)}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}

          {/* Card view */}
          {currentPatient?.id && !isSearching && mergedResults.length > 0 && viewMode === 'cards' && (
            <AnimatedCardGrid
              items={mergedResults}
              keyExtractor={(row) => `${row.type}-${row.id}`}
              columns={{ base: 12, sm: 6, lg: 4 }}
              renderCard={(row) => (
                <SearchResultCard
                  row={row}
                  query={query}
                  selectedTags={selectedTags}
                  getTagColor={getTagColor}
                  onTagClick={handleTagClick}
                  onClick={handleRowClick}
                  isSelected={previewOpen && previewItem?.type === row.type && previewItem?.id === row.id}
                  formatDate={formatDate}
                />
              )}
            />
          )}

          {/* Empty state */}
          {currentPatient?.id && !isSearching && mergedResults.length === 0 && !error && (
            <EmptyState
              icon={IconSearch}
              title={t('search.noResults')}
              hasActiveFilters={hasActiveFilters || Boolean(query)}
              filteredMessage={t('search.noResultsFiltered')}
              noDataMessage={t('search.noResultsGeneral')}
            />
          )}

          {/* Pagination */}
          {!loading && mergedResults.length > 0 && (
            <Group justify="center" align="center" mt="xl" gap="md">
              {totalPages > 1 && (
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={handlePageChange}
                  size="sm"
                />
              )}
              <Select
                value={String(pageSize)}
                onChange={handlePageSizeChange}
                data={PAGE_SIZE_OPTIONS.map(v => ({ value: v, label: `${v} / ${t('search.page', 'page')}` }))}
                size="xs"
                style={{ width: 110 }}
                aria-label={t('search.perPage', 'Items per page')}
              />
            </Group>
          )}
        </div>
      </Flex>

      {/* Preview drawer */}
      <SearchPreviewPanel
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        item={previewItem}
        query={query}
        selectedTags={selectedTags}
        getTagColor={getTagColor}
        onTagClick={handleTagClick}
        formatDate={formatDate}
        onOpenFullRecord={handleOpenFullRecord}
      />
    </Container>
  );
};

export default SearchResults;
