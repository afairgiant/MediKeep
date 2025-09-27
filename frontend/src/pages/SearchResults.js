/**
 * SearchResults Page
 * Full-page search results with filters, pagination, and sorting
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Stack,
  Group,
  Text,
  Title,
  TextInput,
  Button,
  Loader,
  Alert,
  Badge,
  Pagination,
  Select,
  Checkbox,
  Divider,
  ActionIcon,
  ThemeIcon,
  UnstyledButton,
  Highlight,
  Box,
  Flex
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconArrowLeft,
  IconAlertTriangle,
  IconStethoscope,
  IconPill,
  IconVaccine,
  IconMedicalCross,
  IconHeartbeat,
  IconCalendarEvent,
  IconFlask,
  IconChevronRight
} from '@tabler/icons-react';
import { PageHeader } from '../components';
import { searchService } from '../services/searchService';
import { useCurrentPatient } from '../hooks/useGlobalData';
import { formatDateTime } from '../utils/helpers';
import logger from '../services/logger';

const ITEMS_PER_PAGE = 20;

const RECORD_TYPES = [
  { value: 'medications', label: 'Medications', icon: IconPill, color: 'green' },
  { value: 'conditions', label: 'Conditions', icon: IconStethoscope, color: 'blue' },
  { value: 'lab_results', label: 'Lab Results', icon: IconFlask, color: 'indigo' },
  { value: 'procedures', label: 'Procedures', icon: IconMedicalCross, color: 'violet' },
  { value: 'immunizations', label: 'Immunizations', icon: IconVaccine, color: 'orange' },
  { value: 'treatments', label: 'Treatments', icon: IconHeartbeat, color: 'pink' },
  { value: 'encounters', label: 'Visits', icon: IconCalendarEvent, color: 'teal' },
  { value: 'allergies', label: 'Allergies', icon: IconAlertTriangle, color: 'red' },
  { value: 'vitals', label: 'Vitals', icon: IconHeartbeat, color: 'cyan' }
];

const SearchResults = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { patient: currentPatient } = useCurrentPatient();

  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filter and pagination state
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [currentPage, setCurrentPage] = useState(1);

  // Icon mapping
  const iconMap = {
    IconAlertTriangle,
    IconStethoscope,
    IconPill,
    IconVaccine,
    IconMedicalCross,
    IconHeartbeat,
    IconCalendarEvent,
    IconFlask
  };

  // Perform search
  const performSearch = async (searchQuery = query, page = 1, types = null, sort = null) => {
    if (!searchQuery || searchQuery.trim().length < 1) {
      setResults([]);
      setTotalCount(0);
      return;
    }

    if (!currentPatient?.id) {
      setError('No patient selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use passed parameters or fall back to current state
      const typesToUse = types !== null ? types : selectedTypes;
      const sortToUse = sort !== null ? sort : sortBy;
      const options = {
        types: typesToUse.length > 0 ? typesToUse : null,
        limit: ITEMS_PER_PAGE,
        skip: (page - 1) * ITEMS_PER_PAGE,
        sort: sortToUse
      };

      logger.info('search_page_request', 'Performing search', {
        query: searchQuery,
        queryLength: searchQuery.length,
        patientId: currentPatient.id,
        options,
        component: 'SearchResults'
      });

      const searchResults = await searchService.searchPatientRecords(
        searchQuery,
        currentPatient.id,
        options
      );

      setResults(searchResults);
      setTotalCount(searchResults.length); // This is approximate, backend doesn't return total

      logger.info('search_page_success', 'Search completed', {
        resultCount: searchResults.length,
        component: 'SearchResults'
      });

    } catch (err) {
      logger.error('search_page_error', 'Search failed', {
        error: err.message,
        query: searchQuery,
        component: 'SearchResults'
      });
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search submission
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchParams({ q: query });
    performSearch(query, 1);
  };

  // Handle type filter change
  const handleTypeToggle = (type) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];

    setSelectedTypes(newTypes);
    setCurrentPage(1);

    // Perform search with the new types immediately
    performSearch(query, 1, newTypes);
  };

  // Handle sort change
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setCurrentPage(1);

    // Perform search with the new sort immediately
    performSearch(query, 1, null, newSort);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
    performSearch(query, page);
  };

  // Handle result click
  const handleResultClick = (result) => {
    const route = searchService.getRecordRoute(result.type, result.id);
    navigate(route);
  };

  // Initialize search from URL
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && currentPatient?.id) {
      setQuery(urlQuery);
      performSearch(urlQuery, 1);
    }
  }, [searchParams, currentPatient?.id]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Search Results"
        subtitle="Search across all medical records"
        leftSection={
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => navigate(-1)}
          >
            <IconArrowLeft size="1.2rem" />
          </ActionIcon>
        }
      />

      <Grid>
        {/* Filter Sidebar */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper p="md" withBorder>
            <Group gap="xs" mb="md">
              <IconFilter size="1rem" />
              <Text fw={500}>Filters</Text>
            </Group>

            {/* Record Type Filters */}
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">Record Types</Text>
              {RECORD_TYPES.map((type) => {
                const IconComponent = type.icon;
                return (
                  <Checkbox
                    key={type.value}
                    label={
                      <Group gap="xs">
                        <ThemeIcon size="sm" color={type.color} variant="light">
                          <IconComponent size="0.8rem" />
                        </ThemeIcon>
                        <Text size="sm">{type.label}</Text>
                      </Group>
                    }
                    checked={selectedTypes.includes(type.value)}
                    onChange={() => handleTypeToggle(type.value)}
                  />
                );
              })}
            </Stack>

            <Divider my="md" />

            {/* Sort Options */}
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">Sort By</Text>
              <Select
                value={sortBy}
                onChange={handleSortChange}
                data={[
                  { value: 'relevance', label: 'Relevance' },
                  { value: 'date', label: 'Date (Newest)' },
                  { value: 'type', label: 'Type' },
                  { value: 'title', label: 'Title' }
                ]}
                size="sm"
              />
            </Stack>

            {/* Clear Filters */}
            {selectedTypes.length > 0 && (
              <>
                <Divider my="md" />
                <Button
                  variant="subtle"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setSelectedTypes([]);
                    setSortBy('relevance');
                    setCurrentPage(1);
                    performSearch(query, 1, [], 'relevance');
                  }}
                >
                  Clear Filters
                </Button>
              </>
            )}
          </Paper>
        </Grid.Col>

        {/* Main Content */}
        <Grid.Col span={{ base: 12, md: 9 }}>
          {/* Search Bar */}
          <Paper p="md" withBorder mb="md">
            <form onSubmit={handleSearch}>
              <Flex gap="sm" align="end" wrap="wrap">
                <TextInput
                  placeholder="Search medical records..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
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
                  Search
                </Button>
              </Flex>
            </form>
          </Paper>

          {/* Results Header */}
          {query && (
            <Group justify="space-between" mb="md">
              <div>
                <Text size="lg" fw={500}>
                  Search results for "{query}"
                </Text>
                {!loading && (
                  <Text size="sm" c="dimmed">
                    {totalCount} result{totalCount !== 1 ? 's' : ''} found
                    {selectedTypes.length > 0 && (
                      <Text span c="blue"> (filtered)</Text>
                    )}
                  </Text>
                )}
              </div>

              {selectedTypes.length > 0 && (
                <Group gap="xs">
                  {selectedTypes.map(type => {
                    const typeConfig = RECORD_TYPES.find(t => t.value === type);
                    return (
                      <Badge key={type} color={typeConfig?.color} variant="light">
                        {typeConfig?.label}
                      </Badge>
                    );
                  })}
                </Group>
              )}
            </Group>
          )}

          {/* Error State */}
          {error && (
            <Alert color="red" mb="md">
              {error}
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <Group justify="center" py="xl">
              <Loader />
              <Text>Searching...</Text>
            </Group>
          )}

          {/* Empty State */}
          {!loading && query && results.length === 0 && !error && (
            <Paper p="xl" withBorder>
              <Stack align="center">
                <IconSearch size="3rem" color="gray" />
                <Text size="lg" fw={500}>No results found</Text>
                <Text c="dimmed" ta="center">
                  {selectedTypes.length > 0
                    ? "Try adjusting your filters or search terms"
                    : "Try different search terms or check spelling"
                  }
                </Text>
              </Stack>
            </Paper>
          )}

          {/* Results List */}
          {!loading && results.length > 0 && (
            <Stack gap="xs">
              {results.map((result, index) => {
                const IconComponent = iconMap[result.icon] || IconSearch;

                return (
                  <Paper
                    key={`${result.type}-${result.id}-${index}`}
                    p="md"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleResultClick(result)}
                  >
                    <Group gap="md">
                      <ThemeIcon color={result.color} variant="light" size="lg">
                        <IconComponent size="1.2rem" />
                      </ThemeIcon>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="xs" mb={4}>
                          <Highlight
                            highlight={query}
                            fw={500}
                            size="sm"
                            truncate
                            style={{ flex: 1, minWidth: 0 }}
                            highlightStyles={{
                              backgroundColor: 'var(--mantine-color-yellow-2)',
                              fontWeight: 600
                            }}
                          >
                            {result.title}
                          </Highlight>
                          <Badge size="xs" color={result.color} variant="dot">
                            {result.type.replace('_', ' ')}
                          </Badge>
                        </Group>

                        {result.subtitle && (
                          <Highlight
                            highlight={query}
                            size="xs"
                            c="dimmed"
                            mb={2}
                            truncate
                            highlightStyles={{
                              backgroundColor: 'var(--mantine-color-yellow-1)',
                              fontWeight: 500
                            }}
                          >
                            {result.subtitle}
                          </Highlight>
                        )}

                        {result.description && (
                          <Highlight
                            highlight={query}
                            size="xs"
                            c="dimmed"
                            lineClamp={2}
                            highlightStyles={{
                              backgroundColor: 'var(--mantine-color-yellow-1)',
                              fontWeight: 500
                            }}
                          >
                            {result.description}
                          </Highlight>
                        )}

                        <Text size="xs" c="dimmed" mt={4}>
                          {formatDateTime(result.date)}
                        </Text>
                      </div>

                      <ActionIcon variant="subtle" size="sm" color="gray">
                        <IconChevronRight size="1rem" />
                      </ActionIcon>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}

          {/* Pagination */}
          {!loading && results.length > 0 && totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={handlePageChange}
                size="sm"
              />
            </Group>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default SearchResults;