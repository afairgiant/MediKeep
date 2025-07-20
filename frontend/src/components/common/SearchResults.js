/**
 * SearchResults Component
 * Displays search results with clickable items that navigate to record details
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Stack,
  Group,
  Text,
  Avatar,
  Loader,
  Alert,
  ActionIcon,
  Badge,
  Divider,
  ScrollArea
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconStethoscope,
  IconPill,
  IconVaccine,
  IconMedicalCross,
  IconHeartbeat,
  IconCalendarEvent,
  IconFlask,
  IconSearch,
  IconX,
  IconChevronRight
} from '@tabler/icons-react';
import { formatDateTime } from '../../utils/helpers';
import { searchService } from '../../services/searchService';

const SearchResults = ({ 
  results = [], 
  loading = false, 
  query = '', 
  onClose,
  visible = false 
}) => {
  const navigate = useNavigate();

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

  const handleResultClick = (result) => {
    const route = searchService.getRecordRoute(result.type, result.id);
    // Navigate to the record page with view query parameter to open the modal
    navigate(route);
    if (onClose) onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <Paper 
      withBorder 
      shadow="md" 
      p={0}
      style={{ 
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 1000,
        maxHeight: '400px'
      }}
    >
      {/* Header */}
      <Group justify="space-between" p="md" pb="xs">
        <Group gap="xs">
          <IconSearch size="1rem" />
          <Text size="sm" fw={500}>
            Search Results
            {query && (
              <Text span c="dimmed"> for "{query}"</Text>
            )}
          </Text>
        </Group>
        
        {onClose && (
          <ActionIcon variant="subtle" size="sm" onClick={onClose}>
            <IconX size="1rem" />
          </ActionIcon>
        )}
      </Group>

      <Divider />

      {/* Results */}
      <ScrollArea style={{ maxHeight: '320px' }}>
        {loading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Searching...</Text>
          </Group>
        ) : results.length === 0 ? (
          <Stack align="center" p="xl">
            <Text size="sm" c="dimmed" ta="center">
              {query ? 'No medical records found matching your search.' : 'Enter at least 2 characters to search.'}
            </Text>
          </Stack>
        ) : (
          <Stack gap={0}>
            {results.map((result, index) => {
              const IconComponent = iconMap[result.icon] || IconSearch;
              
              return (
                <Paper
                  key={`${result.type}-${result.id}-${index}`}
                  p="md"
                  style={{ 
                    borderRadius: 0,
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'var(--mantine-color-gray-0)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => handleResultClick(result)}
                >
                  <Group gap="md">
                    {/* Icon */}
                    <Avatar color={result.color} variant="light" size="md">
                      <IconComponent size="1.2rem" />
                    </Avatar>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" mb={4}>
                        <Text fw={500} size="sm" truncate>
                          {result.title}
                        </Text>
                        <Badge size="xs" color={result.color} variant="light">
                          {result.type.replace('_', ' ')}
                        </Badge>
                      </Group>
                      
                      {result.subtitle && (
                        <Text size="xs" c="dimmed" mb={2} truncate>
                          {result.subtitle}
                        </Text>
                      )}
                      
                      {result.description && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {result.description}
                        </Text>
                      )}
                      
                      <Text size="xs" c="dimmed" mt={4}>
                        {formatDateTime(result.date)}
                      </Text>
                    </div>

                    {/* Arrow */}
                    <ActionIcon variant="subtle" size="sm" color="gray">
                      <IconChevronRight size="1rem" />
                    </ActionIcon>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </ScrollArea>

      {/* Footer */}
      {results.length > 0 && (
        <>
          <Divider />
          <Text size="xs" c="dimmed" p="sm" ta="center">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </Text>
        </>
      )}
    </Paper>
  );
};

export default SearchResults;