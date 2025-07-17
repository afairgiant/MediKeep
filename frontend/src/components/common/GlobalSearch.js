/**
 * GlobalSearch Component
 * Provides a search input with dropdown results for medical records
 */

import React, { useState, useEffect, useRef } from 'react';
import { TextInput, Box } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import SearchResults from './SearchResults';
import { searchService } from '../../services/searchService';

const GlobalSearch = ({ 
  patientId, 
  placeholder = "Search medical records...",
  width = 300,
  style = {},
  ...props 
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }

      if (!patientId) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setLoading(true);
      setShowResults(true);

      try {
        const searchResults = await searchService.searchPatientRecords(debouncedQuery, patientId);
        setResults(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, patientId]);

  // Handle clicking outside to close results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputFocus = () => {
    if (query.trim().length >= 2) {
      setShowResults(true);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <Box ref={searchRef} style={{ position: 'relative', width, ...style }} {...props}>
      <TextInput
        placeholder={placeholder}
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onFocus={handleInputFocus}
        style={{ width: '100%' }}
        radius="md"
      />
      
      <SearchResults
        results={results}
        loading={loading}
        query={debouncedQuery}
        visible={showResults}
        onClose={() => setShowResults(false)}
      />
    </Box>
  );
};

export default GlobalSearch;