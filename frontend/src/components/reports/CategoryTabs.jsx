import React from 'react';
import { Tabs, Badge, Text, Stack, Center } from '@mantine/core';
import { IconFileDescription } from '@tabler/icons-react';
import RecordSelector from './RecordSelector';

/**
 * CategoryTabs Component
 * 
 * Manages navigation between different medical record categories
 * and displays the appropriate record selector for each tab
 */
const CategoryTabs = ({
  categories = [],
  dataSummary,
  selectedRecords,
  activeTab,
  onTabChange,
  onToggleRecord,
  onToggleCategory,
  categoryDisplayNames = {},
}) => {
  // If no categories available, show empty state
  if (!categories || categories.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <IconFileDescription size={64} stroke={1} color="var(--mantine-color-gray-5)" />
          <Stack align="center" gap="xs">
            <Text fw={500} size="lg">No Categories Available</Text>
            <Text c="dimmed" ta="center">
              No medical data categories are available for report generation.
            </Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  return (
    <Tabs value={activeTab} onChange={onTabChange} variant="outline">
      <Tabs.List>
        {categories.map((category) => {
          const categoryData = dataSummary?.categories?.[category];
          const selectedInCategory = Object.keys(selectedRecords[category] || {}).length;
          
          return (
            <Tabs.Tab 
              key={category} 
              value={category}
              rightSection={
                selectedInCategory > 0 ? (
                  <Badge size="sm" color="green" variant="filled">
                    {selectedInCategory}
                  </Badge>
                ) : null
              }
            >
              <Stack gap={2} align="center">
                <Text size="sm" fw={500}>
                  {categoryDisplayNames[category] || formatCategoryName(category)}
                </Text>
                <Text size="xs" c="dimmed">
                  {categoryData?.count || 0} records
                </Text>
              </Stack>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>

      {categories.map((category) => (
        <Tabs.Panel key={category} value={category} pt="lg">
          <RecordSelector
            category={category}
            categoryData={dataSummary?.categories?.[category]}
            selectedRecords={selectedRecords[category] || {}}
            onToggleRecord={onToggleRecord}
            onToggleCategory={onToggleCategory}
            categoryDisplayName={categoryDisplayNames[category] || formatCategoryName(category)}
          />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};

/**
 * Format category name for display
 * Converts snake_case and kebab-case to proper titles
 */
const formatCategoryName = (category) => {
  return category
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default CategoryTabs;