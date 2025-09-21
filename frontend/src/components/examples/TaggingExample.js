/**
 * Example of how to use the TypeScript tagging components in JavaScript
 * This demonstrates the hybrid TypeScript/JavaScript setup
 */

import React, { useState } from 'react';
import { Container, Title, Paper, Stack, Text, Button, Group } from '@mantine/core';

// Import TypeScript components into JavaScript - works perfectly!
import { TagInput } from '../common/TagInput';
import { TagFilter } from '../common/TagFilter';

/**
 * Example 1: Using TagInput in a form
 */
export function TagInputExample() {
  const [tags, setTags] = useState(['example', 'demo']);

  const handleSubmit = () => {
    console.log('Saving tags:', tags);
    // In a real form, you'd include tags in your API call:
    // api.post('/api/v1/medications/', { ...formData, tags })
  };

  return (
    <Paper p="md">
      <Title order={3} mb="md">TagInput Component Example</Title>
      
      <TagInput
        value={tags}
        onChange={setTags}
        placeholder="Add tags to organize this record..."
        maxTags={15}
        error={tags.length === 0 ? 'At least one tag is recommended' : undefined}
      />
      
      <Button onClick={handleSubmit} mt="md">
        Save with Tags
      </Button>
      
      <Text size="sm" mt="md" color="dimmed">
        Current tags: {JSON.stringify(tags)}
      </Text>
    </Paper>
  );
}

/**
 * Example 2: Using TagFilter in a list view
 */
export function TagFilterExample() {
  const [selectedTags, setSelectedTags] = useState([]);
  const [matchAll, setMatchAll] = useState(false);

  const handleSearch = () => {
    console.log('Filtering with:', { 
      tags: selectedTags, 
      matchAll 
    });
    
    // In a real component, you'd call your API with these filters:
    // api.get('/api/v1/medications/', { 
    //   params: { tags: selectedTags, tag_match_all: matchAll }
    // })
  };

  return (
    <Paper p="md">
      <Title order={3} mb="md">TagFilter Component Example</Title>
      
      <TagFilter
        entityType="medication"
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        matchAll={matchAll}
        onMatchAllChange={setMatchAll}
      />
      
      <Button onClick={handleSearch} mt="md">
        Apply Filter
      </Button>
    </Paper>
  );
}

/**
 * Example 3: Integrating with existing form fields
 */
export function FormIntegrationExample({ formData, onInputChange }) {
  // This shows how to integrate with your existing form structure
  
  const handleTagChange = (tags) => {
    // Simulate your existing onInputChange pattern
    onInputChange({
      target: {
        name: 'tags',
        value: tags
      }
    });
  };

  return (
    <Paper p="md">
      <Title order={3} mb="md">Form Integration Example</Title>
      
      <Stack spacing="md">
        {/* Your existing form fields */}
        <input 
          name="medication_name"
          placeholder="Medication name..."
          value={formData?.medication_name || ''}
          onChange={onInputChange}
        />
        
        {/* Add the TagInput component */}
        <TagInput
          value={formData?.tags || []}
          onChange={handleTagChange}
          placeholder="Add tags..."
        />
      </Stack>
    </Paper>
  );
}

/**
 * Full page example showing all components
 */
export default function TaggingExamplePage() {
  const [formData, setFormData] = useState({
    medication_name: '',
    tags: []
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="xl">
        TypeScript Tagging Components in JavaScript
      </Title>
      
      <Text mb="xl" color="dimmed">
        This demonstrates how to use the TypeScript tagging components 
        in your existing JavaScript code. No conversion needed!
      </Text>
      
      <Stack spacing="xl">
        <TagInputExample />
        <TagFilterExample />
        <FormIntegrationExample 
          formData={formData}
          onInputChange={handleInputChange}
        />
      </Stack>
      
      <Paper p="md" mt="xl" style={{ backgroundColor: '#f0f0f0' }}>
        <Title order={4}>Integration Tips:</Title>
        <ul>
          <li>Import TypeScript components directly: import {'{ TagInput }'} from '../common/TagInput'</li>
          <li>TypeScript components work seamlessly in JavaScript files</li>
          <li>All props are automatically available with IntelliSense</li>
          <li>No type annotations needed in JavaScript files</li>
        </ul>
      </Paper>
    </Container>
  );
}