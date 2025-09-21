import React, { useState, useEffect } from 'react';
import { MultiSelect, Switch, Group, Text, Badge, ActionIcon, Stack } from '@mantine/core';
import { X, Tag } from 'lucide-react';
import apiService from '../../services/api';
import logger from '../../services/logger';

interface TagFilterProps {
  entityType: 'lab_result' | 'medication' | 'condition' | 'procedure' | 'immunization' | 'treatment' | 'encounter' | 'allergy';
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  matchAll: boolean;
  onMatchAllChange: (matchAll: boolean) => void;
}

export function TagFilter({
  entityType,
  selectedTags,
  onTagsChange,
  matchAll,
  onMatchAllChange
}: TagFilterProps) {
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [popularTags, setPopularTags] = useState<Array<{ tag: string; count: number }>>([]);

  // Fetch available tags for the entity type
  useEffect(() => {
    const fetchTags = async () => {
      setIsLoading(true);
      try {
        // Fetch popular tags for this entity type
        const response = await apiService.get('/tags/popular', {
          params: {
            entity_types: [entityType],
            limit: 20
          }
        });
        
        const tagsData = response.data;
        setPopularTags(tagsData);
        setAvailableTags(tagsData.map((item: any) => item.tag));
        
        logger.info(`Loaded ${tagsData.length} tags for ${entityType}`, {
          component: 'TagFilter',
          entityType
        });
      } catch (error) {
        logger.error('Failed to fetch available tags', {
          component: 'TagFilter',
          entityType,
          error
        });
        setAvailableTags([]);
        setPopularTags([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [entityType]);

  const removeTag = (tag: string) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  // Format data for MultiSelect
  const selectData = availableTags.map(tag => ({
    value: tag,
    label: tag
  }));

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start">
        <MultiSelect
          data={selectData}
          value={selectedTags}
          onChange={onTagsChange}
          label="Filter by tags"
          placeholder={isLoading ? "Loading tags..." : "Select tags to filter"}
          searchable
          clearable
          leftSection={<Tag size={16} />}
          maxDropdownHeight={250}
          nothingFoundMessage="No tags found"
          disabled={isLoading}
          style={{ flex: 1 }}
        />
        
        {selectedTags.length > 0 && (
          <ActionIcon 
            color="gray" 
            variant="subtle"
            onClick={clearAllTags}
            mt={32}
            title="Clear all tags"
          >
            <X size={18} />
          </ActionIcon>
        )}
      </Group>

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <Group gap="xs">
          {selectedTags.map(tag => (
            <Badge
              key={tag}
              variant="filled"
              rightSection={
                <ActionIcon
                  size="xs"
                  radius="xl"
                  variant="transparent"
                  onClick={() => removeTag(tag)}
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

      {/* Match mode toggle */}
      {selectedTags.length > 1 && (
        <Group gap="xs">
          <Switch
            checked={matchAll}
            onChange={(e) => onMatchAllChange(e.currentTarget.checked)}
            label={
              <Text size="sm">
                Match {matchAll ? 'ALL' : 'ANY'} selected tags
              </Text>
            }
          />
          <Text size="xs" c="dimmed">
            {matchAll 
              ? 'Show items that have all selected tags' 
              : 'Show items that have at least one selected tag'}
          </Text>
        </Group>
      )}

      {/* Popular tags quick select */}
      {popularTags.length > 0 && selectedTags.length === 0 && (
        <div>
          <Text size="xs" fw={500} c="dimmed" mb="xs">
            Popular tags:
          </Text>
          <Group gap="xs">
            {popularTags.slice(0, 8).map(({ tag, count }) => (
              <Badge
                key={tag}
                variant="outline"
                style={{ cursor: 'pointer' }}
                onClick={() => onTagsChange([...selectedTags, tag])}
                title={`Used ${count} times`}
              >
                {tag} ({count})
              </Badge>
            ))}
          </Group>
        </div>
      )}
    </Stack>
  );
}