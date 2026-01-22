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
  disableSuggestions?: boolean;
}

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Add tags...',
  maxTags = 15,
  disabled = false,
  error,
  disableSuggestions = false
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [debouncedInput] = useDebouncedValue(inputValue, 300);

  // Clear validation error after 3 seconds
  useEffect(() => {
    if (validationError) {
      const timer = setTimeout(() => {
        setValidationError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [validationError]);

  // Fetch popular tags on mount (only if suggestions enabled)
  useEffect(() => {
    if (disableSuggestions) return;

    const fetchPopularTags = async () => {
      try {
        const response = await apiService.get('/tags/suggestions?limit=20');
        setPopularTags(response.data || response || []);
      } catch (error) {
        logger.error('Failed to fetch popular tags', {
          component: 'TagInput',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    fetchPopularTags();
  }, [disableSuggestions]);

  // Fetch tag suggestions based on input (only if suggestions enabled)
  useEffect(() => {
    if (disableSuggestions) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      if (debouncedInput.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await apiService.get(`/tags/autocomplete?q=${encodeURIComponent(debouncedInput)}&limit=10`);

        // Filter out already selected tags
        const tags = response.data || response || [];
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
  }, [debouncedInput, value, disableSuggestions]);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    
    // Validation
    if (!trimmedTag) return;
    
    if (value.includes(trimmedTag)) {
      setValidationError('Tag already exists');
      logger.debug('Duplicate tag attempted', {
        tag: trimmedTag,
        component: 'TagInput'
      });
      return;
    }
    
    if (value.length >= maxTags) {
      setValidationError(`Maximum ${maxTags} tags allowed`);
      logger.debug('Max tags limit reached', {
        currentCount: value.length,
        maxTags,
        component: 'TagInput'
      });
      return;
    }
    
    if (trimmedTag.length > 50) {
      setValidationError('Tag must be 50 characters or less');
      logger.debug('Tag exceeds character limit', {
        tag: trimmedTag,
        length: trimmedTag.length,
        component: 'TagInput'
      });
      return;
    }

    onChange([...value, trimmedTag]);
    setInputValue('');
    setShowSuggestions(false);
    setValidationError(''); // Clear any existing error on successful add
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
                  // Clear validation error when user starts typing again
                  if (validationError) {
                    setValidationError('');
                  }
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Delay to allow suggestion click to register
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                onFocus={() => {
                  // Show popular tags if no input, otherwise show suggestions
                  if (inputValue === '' && popularTags.length > 0) {
                    const filtered = popularTags.filter(tag => !value.includes(tag));
                    setSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);
                  } else if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder={value.length === 0 ? placeholder : ''}
                size="xs"
                variant="unstyled"
                style={{ minWidth: 120, flex: 1 }}
                disabled={disabled}
                error={validationError || error}
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
              <>
                {inputValue === '' && suggestions.length > 0 && (
                  <Text size="xs" c="dimmed" p="xs" style={{ borderBottom: '1px solid #e0e0e0' }}>
                    Common tags:
                  </Text>
                )}
                {suggestions.map((suggestion) => (
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
                ))}
              </>
            )}
          </Paper>
        )}
      </Paper>
      
      {/* Helper text */}
      <Text size="xs" c="dimmed" mt={4}>
        {value.length}/{maxTags} tags • Press Enter to add a tag
      </Text>
      
      {(validationError || error) && (
        <Text size="xs" c="red" mt={4}>
          {validationError || error}
        </Text>
      )}
    </div>
  );
}