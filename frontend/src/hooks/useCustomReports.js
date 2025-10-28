import { useState, useCallback, useRef } from 'react';
import { useApi } from './useApi.js';
import { apiService } from '../services/api/index.js';
import { notifications } from '@mantine/notifications';
import logger from '../services/logger';

/**
 * Custom hook for managing custom report generation
 * Provides data fetching, report generation, and download functionality
 */
export const useCustomReports = () => {
  const [dataSummary, setDataSummary] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportSettings, setReportSettings] = useState({
    report_title: 'Custom Medical Report',
    include_patient_info: true,
    include_summary: true,
    include_profile_picture: true,
    date_range: null,
  });

  const { loading, error, execute, clearError, setError } = useApi();
  const abortControllerRef = useRef(null);

  // Fetch data summary for record selection
  const fetchDataSummary = useCallback(async () => {
    logger.info('custom_reports_fetch_summary', 'Fetching data summary for report builder', {
      component: 'useCustomReports',
    });

    const result = await execute(
      async signal => {
        const response = await apiService.getCustomReportSummary(signal);
        
        // Log response summary
        logger.debug('custom_reports_summary_response', 'Data summary fetched', {
          categoriesCount: Object.keys(response?.categories || {}).length,
          totalRecords: response?.total_records || 0,
          component: 'useCustomReports',
        });
        
        return response;
      },
      { errorMessage: 'Failed to fetch data summary' }
    );

    if (result) {
      setDataSummary(result);
      return result;
    }
    return null;
  }, [execute]);

  // Toggle record selection
  const toggleRecordSelection = useCallback((category, recordId, record) => {
    setSelectedRecords(prev => {
      const categoryRecords = prev[category] || {};
      const newCategoryRecords = { ...categoryRecords };

      if (newCategoryRecords[recordId]) {
        // Remove record
        delete newCategoryRecords[recordId];
        logger.debug('custom_reports_record_deselected', 'Record deselected', {
          category,
          recordId,
          component: 'useCustomReports',
        });
      } else {
        // Add record
        newCategoryRecords[recordId] = record;
        logger.debug('custom_reports_record_selected', 'Record selected', {
          category,
          recordId,
          component: 'useCustomReports',
        });
      }

      const newSelected = { ...prev };
      if (Object.keys(newCategoryRecords).length === 0) {
        delete newSelected[category];
      } else {
        newSelected[category] = newCategoryRecords;
      }

      return newSelected;
    });
  }, []);

  // Toggle all records in a category
  const toggleCategorySelection = useCallback((category, records) => {
    setSelectedRecords(prev => {
      const categoryRecords = prev[category] || {};
      const allSelected = records.every(record => categoryRecords[record.id]);

      if (allSelected) {
        // Deselect all
        const newSelected = { ...prev };
        delete newSelected[category];
        logger.debug('custom_reports_category_deselected', 'All records in category deselected', {
          category,
          recordCount: records.length,
          component: 'useCustomReports',
        });
        return newSelected;
      } else {
        // Select all
        const newCategoryRecords = {};
        records.forEach(record => {
          newCategoryRecords[record.id] = record;
        });
        logger.debug('custom_reports_category_selected', 'All records in category selected', {
          category,
          recordCount: records.length,
          component: 'useCustomReports',
        });
        return { ...prev, [category]: newCategoryRecords };
      }
    });
  }, []);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedRecords({});
    logger.info('custom_reports_selections_cleared', 'All record selections cleared', {
      component: 'useCustomReports',
    });
  }, []);

  // Update report settings
  const updateReportSettings = useCallback((settings) => {
    setReportSettings(prev => ({ ...prev, ...settings }));
    logger.debug('custom_reports_settings_updated', 'Report settings updated', {
      settings,
      component: 'useCustomReports',
    });
  }, []);

  // Get selected records count
  const getSelectedCount = useCallback(() => {
    return Object.values(selectedRecords).reduce((total, categoryRecords) => {
      return total + Object.keys(categoryRecords).length;
    }, 0);
  }, [selectedRecords]);

  // Get selected records in API format
  const getSelectedRecordsForAPI = useCallback(() => {
    return Object.entries(selectedRecords).map(([category, records]) => ({
      category,
      record_ids: Object.keys(records).map(id => parseInt(id, 10)),
    }));
  }, [selectedRecords]);

  // Validate selections
  const validateSelections = useCallback(() => {
    const selectedRecordsArray = getSelectedRecordsForAPI();
    
    if (selectedRecordsArray.length === 0) {
      return { valid: false, error: 'Please select at least one record to include in the report.' };
    }

    const totalRecords = selectedRecordsArray.reduce((total, category) => {
      return total + category.record_ids.length;
    }, 0);

    if (totalRecords > 5000) {
      return { valid: false, error: 'Cannot select more than 5000 records total across all categories.' };
    }

    for (const category of selectedRecordsArray) {
      if (category.record_ids.length > 1000) {
        return { valid: false, error: `Cannot select more than 1000 records in the ${category.category} category.` };
      }
    }

    return { valid: true };
  }, [getSelectedRecordsForAPI]);

  // Generate and download report
  const generateReport = useCallback(async () => {
    // Validate selections first
    const validation = validateSelections();
    if (!validation.valid) {
      setError(validation.error);
      return false;
    }

    setIsGenerating(true);
    clearError();

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const selectedRecordsArray = getSelectedRecordsForAPI();
      const requestData = {
        selected_records: selectedRecordsArray,
        ...reportSettings,
      };

      logger.info('custom_reports_generate_start', 'Starting report generation', {
        categoriesCount: selectedRecordsArray.length,
        totalRecords: getSelectedCount(),
        reportTitle: reportSettings.report_title,
        component: 'useCustomReports',
      });

      const pdfBlob = await apiService.generateCustomReport(requestData, abortController.signal);

      if (pdfBlob instanceof Blob) {
        // Create download link
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportSettings.report_title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        logger.info('custom_reports_generate_success', 'Report generated and downloaded successfully', {
          categoriesCount: selectedRecordsArray.length,
          totalRecords: getSelectedCount(),
          component: 'useCustomReports',
        });

        notifications.show({
          title: 'Report Generated',
          message: 'Your custom medical report has been downloaded successfully.',
          color: 'green',
          autoClose: 5000,
        });

        return true;
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('custom_reports_generate_cancelled', 'Report generation cancelled', {
          component: 'useCustomReports',
        });
        return false;
      }

      logger.error('custom_reports_generate_error', 'Failed to generate report', {
        error: error.message,
        categoriesCount: getSelectedRecordsForAPI().length,
        totalRecords: getSelectedCount(),
        component: 'useCustomReports',
      });

      setError(`Failed to generate report: ${error.message}`);
      
      notifications.show({
        title: 'Report Generation Failed',
        message: error.message || 'An error occurred while generating the report.',
        color: 'red',
        autoClose: 7000,
      });

      return false;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [validateSelections, getSelectedRecordsForAPI, getSelectedCount, reportSettings, setError, clearError]);

  // Cancel report generation
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      logger.info('custom_reports_generation_cancelled', 'Report generation cancelled by user', {
        component: 'useCustomReports',
      });
    }
  }, []);

  return {
    // Data
    dataSummary,
    selectedRecords,
    reportSettings,

    // State
    loading,
    error,
    isGenerating,

    // Computed
    selectedCount: getSelectedCount(),
    hasSelections: getSelectedCount() > 0,

    // Actions
    fetchDataSummary,
    toggleRecordSelection,
    toggleCategorySelection,
    clearSelections,
    updateReportSettings,
    generateReport,
    cancelGeneration,
    clearError,

    // Utilities
    getSelectedRecordsForAPI,
    validateSelections,
  };
};