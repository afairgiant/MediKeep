/**
 * GlobalSearch Component
 * Provides a search input with dropdown results for medical records
 */
import logger from '../../services/logger';


import React, { useState, useEffect, useRef } from 'react';
import { TextInput, Box } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import SearchResults from './SearchResults';
import { searchService } from '../../services/searchService';

const GlobalSearch = ({ 
  patientId, 
  placeholder = "Search medical records, tags...",
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
      logger.debug('global_search_triggered', 'GlobalSearch useEffect triggered', {
        debouncedQuery,
        patientId,
        component: 'GlobalSearch'
      });

      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        logger.debug('global_search_query_short', 'Query too short, clearing results', {
          component: 'GlobalSearch'
        });
        setResults([]);
        setShowResults(false);
        return;
      }

      if (!patientId) {
        logger.debug('global_search_no_patient', 'No patient ID provided, clearing results', {
          patientId,
          component: 'GlobalSearch'
        });
        setResults([]);
        setShowResults(false);
        return;
      }

      logger.info('global_search_starting', 'Starting search request', {
        query: debouncedQuery,
        patientId,
        component: 'GlobalSearch'
      });
      setLoading(true);
      setShowResults(true);

      try {
        const searchResults = await searchService.searchPatientRecords(debouncedQuery, patientId);
        logger.info('global_search_success', 'Search completed successfully', {
          resultCount: searchResults.length,
          component: 'GlobalSearch'
        });
        setResults(searchResults);
      } catch (error) {
        logger.error('global_search_error', 'Search failed', {
          error: error.message,
          query: debouncedQuery,
          patientId,
          component: 'GlobalSearch'
        });
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