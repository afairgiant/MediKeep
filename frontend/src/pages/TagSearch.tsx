import React, { useState } from 'react';
import { Container, Title, Paper, Stack, MultiSelect, Button, Badge, Group, Text, Card, Loader, Alert, Tabs, ScrollArea, ActionIcon } from '@mantine/core';
import { Search, Tag, FileText, Pill, Heart, Stethoscope, Calendar, Activity, AlertTriangle, X } from 'lucide-react';
import api from '../services/api';
import logger from '../services/logger';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { showNotification } from '@mantine/notifications';

interface SearchResult {
  id: number;
  entity_type: string;
  name: string;
  description?: string;
  date?: string;
  status?: string;
  tags: string[];
}

interface SearchResults {
  lab_results: any[];
  medications: any[];
  conditions: any[];
  procedures: any[];
  immunizations: any[];
  treatments: any[];
  encounters: any[];
  allergies: any[];
}

const ENTITY_CONFIG = {
  lab_result: { icon: FileText, color: 'blue', label: 'Lab Results', route: '/lab-results' },
  medication: { icon: Pill, color: 'green', label: 'Medications', route: '/medications' },
  condition: { icon: Heart, color: 'red', label: 'Conditions', route: '/conditions' },
  procedure: { icon: Stethoscope, color: 'purple', label: 'Procedures', route: '/procedures' },
  immunization: { icon: Activity, color: 'orange', label: 'Immunizations', route: '/immunizations' },
  treatment: { icon: Calendar, color: 'teal', label: 'Treatments', route: '/treatments' },
  encounter: { icon: Calendar, color: 'cyan', label: 'Encounters', route: '/encounters' },
  allergy: { icon: AlertTriangle, color: 'pink', label: 'Allergies', route: '/allergies' }
};

export function TagSearch() {
  const navigate = useNavigate();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [popularTags, setPopularTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Load popular tags on mount
  React.useEffect(() => {
    loadPopularTags();
  }, []);

  const loadPopularTags = async () => {
    setIsLoadingTags(true);
    try {
      const response = await api.get('/tags/popular', {
        params: { limit: 30 }
      });
      setPopularTags(response.data);
      logger.info(`Loaded ${response.data.length} popular tags`, {
        component: 'TagSearch'
      });
    } catch (error) {
      logger.error('Failed to load popular tags', {
        component: 'TagSearch',
        error
      });
      showNotification({
        title: 'Error',
        message: 'Failed to load popular tags',
        color: 'red'
      });
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleSearch = async () => {
    if (selectedTags.length === 0) {
      showNotification({
        title: 'No tags selected',
        message: 'Please select at least one tag to search',
        color: 'yellow'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.get('/tags/search', {
        params: {
          tags: selectedTags,
          limit_per_entity: 10
        }
      });

      setSearchResults(response.data);
      logger.info(`Search completed for ${selectedTags.length} tags`, {
        component: 'TagSearch',
        tags: selectedTags
      });
    } catch (error) {
      logger.error('Failed to search by tags', {
        component: 'TagSearch',
        tags: selectedTags,
        error
      });
      showNotification({
        title: 'Search Error',
        message: 'Failed to search records by tags',
        color: 'red'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderEntityResults = (entityType: string, results: any[]) => {
    const config = ENTITY_CONFIG[entityType as keyof typeof ENTITY_CONFIG];
    if (!config || !results || results.length === 0) return null;

    const Icon = config.icon;

    return (
      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Icon size={20} />
            <Text fw={500}>{config.label}</Text>
            <Badge color={config.color} variant="filled">{results.length}</Badge>
          </Group>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => navigate(config.route)}
          >
            View All
          </Button>
        </Group>

        <Stack gap="xs">
          {results.slice(0, 5).map((item) => (
            <Paper
              key={item.id}
              p="sm"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`${config.route}/${item.id}`)}
            >
              <Group justify="space-between">
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500}>
                    {getItemTitle(entityType, item)}
                  </Text>
                  {item.date && (
                    <Text size="xs" c="dimmed">
                      {format(new Date(item.date), 'MMM d, yyyy')}
                    </Text>
                  )}
                </div>
                {item.status && (
                  <Badge color={getStatusColor(item.status)} variant="light">
                    {item.status}
                  </Badge>
                )}
              </Group>
              {item.tags && item.tags.length > 0 && (
                <Group gap="xs" mt="xs">
                  {item.tags.map((tag: string) => (
                    <Badge key={tag} size="xs" variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </Group>
              )}
            </Paper>
          ))}
        </Stack>

        {results.length > 5 && (
          <Text size="xs" c="dimmed" ta="center" mt="md">
            +{results.length - 5} more results
          </Text>
        )}
      </Card>
    );
  };

  const getItemTitle = (entityType: string, item: any): string => {
    switch (entityType) {
      case 'lab_results':
        return item.test_name || 'Lab Result';
      case 'medications':
        return item.medication_name || 'Medication';
      case 'conditions':
        return item.diagnosis || 'Condition';
      case 'procedures':
        return item.name || 'Procedure';
      case 'immunizations':
        return item.vaccine_name || 'Immunization';
      case 'treatments':
        return item.treatment_type || 'Treatment';
      case 'encounters':
        return item.encounter_type || 'Encounter';
      case 'allergies':
        return item.allergen || 'Allergy';
      default:
        return 'Record';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'green';
      case 'completed':
        return 'blue';
      case 'pending':
        return 'yellow';
      case 'cancelled':
        return 'gray';
      case 'stopped':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getTotalResultsCount = (): number => {
    if (!searchResults) return 0;
    return Object.values(searchResults).reduce((sum, results) => sum + (results?.length || 0), 0);
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1} mb="xs">
            <Group gap="xs">
              <Tag size={28} />
              <span>Tag Search</span>
            </Group>
          </Title>
          <Text c="dimmed">
            Search across all your medical records using tags
          </Text>
        </div>

        <Paper shadow="xs" p="md" radius="md">
          <Stack gap="md">
            <MultiSelect
              data={popularTags.map(t => ({ value: t.tag, label: `${t.tag} (${t.count})` }))}
              value={selectedTags}
              onChange={setSelectedTags}
              label="Select tags to search"
              placeholder={isLoadingTags ? "Loading tags..." : "Choose one or more tags"}
              searchable
              clearable
              leftSection={<Tag size={16} />}
              disabled={isLoadingTags}
            />

            {/* Popular tags for quick selection */}
            {popularTags.length > 0 && selectedTags.length === 0 && (
              <div>
                <Text size="sm" fw={500} mb="xs">Quick select popular tags:</Text>
                <Group gap="xs">
                  {popularTags.slice(0, 12).map(({ tag, count }) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTags([...selectedTags, tag])}
                    >
                      {tag} ({count})
                    </Badge>
                  ))}
                </Group>
              </div>
            )}

            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <Group gap="xs">
                <Text size="sm" fw={500}>Selected:</Text>
                {selectedTags.map(tag => (
                  <Badge
                    key={tag}
                    variant="filled"
                    rightSection={
                      <ActionIcon
                        size="xs"
                        radius="xl"
                        variant="transparent"
                        onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                      >
                        <X size={10} />
                      </ActionIcon>
                    }
                  >
                    {tag}
                  </Badge>
                ))}
              </Group>
            )}

            <Button
              leftSection={<Search size={16} />}
              onClick={handleSearch}
              loading={isLoading}
              disabled={selectedTags.length === 0}
            >
              Search Records
            </Button>
          </Stack>
        </Paper>

        {/* Search Results */}
        {isLoading && (
          <Paper p="xl" radius="md" style={{ textAlign: 'center' }}>
            <Loader size="lg" />
            <Text mt="md" c="dimmed">Searching records...</Text>
          </Paper>
        )}

        {searchResults && !isLoading && (
          <>
            <Group justify="space-between">
              <Title order={3}>
                Search Results ({getTotalResultsCount()} total)
              </Title>
              <Button
                variant="subtle"
                onClick={() => {
                  setSearchResults(null);
                  setSelectedTags([]);
                }}
              >
                Clear Results
              </Button>
            </Group>

            {getTotalResultsCount() === 0 ? (
              <Alert icon={<Search size={16} />} title="No results found" color="yellow">
                No records found with the selected tags. Try different tags or fewer tags.
              </Alert>
            ) : (
              <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'all')}>
                <Tabs.List>
                  <Tabs.Tab value="all">All Results</Tabs.Tab>
                  {Object.entries(searchResults).map(([key, results]) => {
                    if (results && results.length > 0) {
                      const config = ENTITY_CONFIG[key.replace('_results', '').replace('s', '') as keyof typeof ENTITY_CONFIG];
                      if (config) {
                        return (
                          <Tabs.Tab key={key} value={key}>
                            {config.label} ({results.length})
                          </Tabs.Tab>
                        );
                      }
                    }
                    return null;
                  })}
                </Tabs.List>

                <Tabs.Panel value="all" pt="md">
                  <ScrollArea.Autosize mah={600}>
                    <Stack gap="md">
                      {Object.entries(searchResults).map(([entityType, results]) => 
                        renderEntityResults(entityType, results)
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                </Tabs.Panel>

                {Object.entries(searchResults).map(([key, results]) => {
                  if (results && results.length > 0) {
                    return (
                      <Tabs.Panel key={key} value={key} pt="md">
                        <ScrollArea.Autosize mah={600}>
                          {renderEntityResults(key, results)}
                        </ScrollArea.Autosize>
                      </Tabs.Panel>
                    );
                  }
                  return null;
                })}
              </Tabs>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}