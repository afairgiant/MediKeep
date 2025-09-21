import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Badge, TextInput, ActionIcon, Group, Text, Paper, ScrollArea } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import apiService from '../../services/api';
import logger from '../../services/logger';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  error?: string;
}

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Add tags...',
  maxTags = 15,
  disabled = false,
  error
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [debouncedInput] = useDebouncedValue(inputValue, 300);

  // Fetch tag suggestions based on input
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedInput.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await apiService.get(`/tags/autocomplete?q=${encodeURIComponent(debouncedInput)}&limit=10`);
        // Filter out already selected tags
        const tags = response.data || [];
        const filtered = tags.filter((tag: string) => !value.includes(tag));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch (error) {
        logger.error('Failed to fetch tag suggestions', {
          component: 'TagInput',
          error
        });
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedInput, value]);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    
    // Validation
    if (!trimmedTag) return;
    if (value.includes(trimmedTag)) return;
    if (value.length >= maxTags) {
      logger.warn(`Maximum of ${maxTags} tags allowed`, {
        component: 'TagInput'
      });
      return;
    }
    if (trimmedTag.length > 50) {
      logger.warn('Tag must be 50 characters or less', {
        component: 'TagInput'
      });
      return;
    }

    onChange([...value, trimmedTag]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      // Remove last tag when backspace is pressed with empty input
      removeTag(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className="tag-input-container">
      <Paper withBorder p="xs" style={{ position: 'relative' }}>
        <ScrollArea.Autosize mah={200} offsetScrollbars>
          <Group gap="xs" align="center">
            {value.map((tag) => (
              <Badge
                key={tag}
                variant="filled"
                rightSection={
                  !disabled && (
                    <ActionIcon
                      size="xs"
                      radius="xl"
                      variant="transparent"
                      onClick={() => removeTag(tag)}
                    >
                      <X size={10} />
                    </ActionIcon>
                  )
                }
              >
                {tag}
              </Badge>
            ))}
            {!disabled && value.length < maxTags && (
              <TextInput
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Delay to allow suggestion click to register
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder={value.length === 0 ? placeholder : ''}
                size="xs"
                variant="unstyled"
                style={{ minWidth: 120, flex: 1 }}
                disabled={disabled}
                error={error}
              />
            )}
          </Group>
        </ScrollArea.Autosize>
        
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <Paper
            shadow="md"
            p="xs"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              marginTop: 4,
              maxHeight: 200,
              overflowY: 'auto'
            }}
          >
            {isLoadingSuggestions ? (
              <Text size="sm" c="dimmed">Loading suggestions...</Text>
            ) : (
              suggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Text size="sm">{suggestion}</Text>
                </div>
              ))
            )}
          </Paper>
        )}
      </Paper>
      
      {/* Helper text */}
      <Text size="xs" c="dimmed" mt={4}>
        {value.length}/{maxTags} tags • Press Enter to add a tag
      </Text>
      
      {error && (
        <Text size="xs" c="red" mt={4}>
          {error}
        </Text>
      )}
    </div>
  );
}