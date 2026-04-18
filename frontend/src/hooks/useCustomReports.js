import { useState, useCallback, useRef } from 'react';
import { useApi } from './useApi.js';
import { apiService } from '../services/api/index.js';
import { notifications } from '@mantine/notifications';
import logger from '../services/logger';

// Pure date helpers hoisted to module scope so their identity is stable
const formatLocalDate = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDefaultDateFrom = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return formatLocalDate(d);
};

const getDefaultDateTo = () => formatLocalDate(new Date());

// Lab chart identity helpers — hoisted so useCallback deps stay stable and the
// same (test_name, unit) comparison is shared across add/remove/update.
const normalizeUnit = u => (u == null ? '' : String(u).trim().toLowerCase());
const labChartMatches = (c, testName, unit) =>
  c.test_name.toLowerCase() === testName.toLowerCase() &&
  normalizeUnit(c.unit) === normalizeUnit(unit);

// Default report settings shape. Exposed as a module constant so applyTemplate
// can reset to these values (not to whatever was previously in state) when a
// template has only partial settings.
const DEFAULT_REPORT_SETTINGS = Object.freeze({
  report_title: 'Custom Medical Report',
  include_patient_info: true,
  include_summary: true,
  include_profile_picture: true,
  date_range: null,
});

/**
 * Custom hook for managing custom report generation
 * Provides data fetching, report generation, and download functionality
 * Supports both medical record selections and trend chart selections
 */
export const useCustomReports = () => {
  const [dataSummary, setDataSummary] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportSettings, setReportSettings] = useState({
    ...DEFAULT_REPORT_SETTINGS,
  });

  // Trend chart state
  const [trendCharts, setTrendCharts] = useState({
    vital_charts: [],
    lab_test_charts: [],
  });

  const { loading, error, execute, clearError, setError } = useApi();
  const abortControllerRef = useRef(null);

  // Fetch data summary for record selection
  const fetchDataSummary = useCallback(async () => {
    logger.info(
      'custom_reports_fetch_summary',
      'Fetching data summary for report builder',
      {
        component: 'useCustomReports',
      }
    );

    const result = await execute(
      async signal => {
        const response = await apiService.getCustomReportSummary(signal);

        // Log response summary
        logger.debug(
          'custom_reports_summary_response',
          'Data summary fetched',
          {
            categoriesCount: Object.keys(response?.categories || {}).length,
            totalRecords: response?.total_records || 0,
            component: 'useCustomReports',
          }
        );

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
        logger.debug(
          'custom_reports_category_deselected',
          'All records in category deselected',
          {
            category,
            recordCount: records.length,
            component: 'useCustomReports',
          }
        );
        return newSelected;
      } else {
        // Select all
        const newCategoryRecords = {};
        records.forEach(record => {
          newCategoryRecords[record.id] = record;
        });
        logger.debug(
          'custom_reports_category_selected',
          'All records in category selected',
          {
            category,
            recordCount: records.length,
            component: 'useCustomReports',
          }
        );
        return { ...prev, [category]: newCategoryRecords };
      }
    });
  }, []);

  // Clear all selections (records + charts)
  const clearSelections = useCallback(() => {
    setSelectedRecords({});
    setTrendCharts({ vital_charts: [], lab_test_charts: [] });
    logger.info('custom_reports_selections_cleared', 'All selections cleared', {
      component: 'useCustomReports',
    });
  }, []);

  // Update report settings
  const updateReportSettings = useCallback(settings => {
    setReportSettings(prev => ({ ...prev, ...settings }));
    logger.debug('custom_reports_settings_updated', 'Report settings updated', {
      settings,
      component: 'useCustomReports',
    });
  }, []);

  // Apply a saved template to the builder state. Uses dataSummary to rehydrate
  // record objects (selection map stores full record objects keyed by id).
  const applyTemplate = useCallback((template, summary) => {
    if (!template) return;

    // Rehydrate selectedRecords: {category: {recordId: recordObject}}.
    // The data-summary endpoint truncates each category to 100 records for UI
    // performance, so a saved id may not appear in `summary.categories[...]`.
    // Preserve those ids as minimal stubs so the selection — and the eventual
    // report-generation payload built from Object.keys(records) — still covers
    // every id the user originally saved. The UI only renders records that
    // appear in the summary, so stubs are invisible (a separate UX concern).
    const nextSelected = {};
    (template.selected_records || []).forEach(({ category, record_ids }) => {
      if (!Array.isArray(record_ids) || record_ids.length === 0) return;
      const categoryData = summary?.categories?.[category];
      const byId = new Map(
        (categoryData?.records || []).map(r => [r.id, r])
      );
      const picked = {};
      record_ids.forEach(id => {
        picked[id] = byId.get(id) || { id };
      });
      nextSelected[category] = picked;
    });
    setSelectedRecords(nextSelected);

    // Apply report settings: replace state entirely with the template's
    // values, falling back to DEFAULT_REPORT_SETTINGS for any key the template
    // omits. Merging with prior state would leak in-progress edits into the
    // loaded template. Backend returns trend_charts as a sibling field, but
    // older blobs may carry it nested under report_settings — strip defensively.
    const rawSettings = { ...(template.report_settings || {}) };
    delete rawSettings.trend_charts;
    setReportSettings({ ...DEFAULT_REPORT_SETTINGS, ...rawSettings });

    // Apply trend charts. Legacy templates (pre unit-aware trending) may store
    // lab_test_charts without a `unit` field — hydrate to `unit: null` so the
    // UI can flag them and the backend gets legacy merged-across-units behavior.
    const tc = template.trend_charts;
    const rawLab = Array.isArray(tc?.lab_test_charts) ? tc.lab_test_charts : [];
    setTrendCharts({
      vital_charts: Array.isArray(tc?.vital_charts) ? tc.vital_charts : [],
      lab_test_charts: rawLab.map(c => ({
        ...c,
        unit: c.unit ?? null,
      })),
    });

    logger.info('custom_reports_template_applied', 'Template applied to builder', {
      templateId: template.id,
      templateName: template.name,
      categoriesApplied: Object.keys(nextSelected).length,
      component: 'useCustomReports',
    });
  }, []);

  // --- Trend chart actions ---

  const addVitalChart = useCallback(vitalType => {
    setTrendCharts(prev => {
      // Don't add duplicate
      if (prev.vital_charts.some(c => c.vital_type === vitalType)) {
        return prev;
      }
      const totalCharts =
        prev.vital_charts.length + prev.lab_test_charts.length;
      if (totalCharts >= 10) {
        return prev;
      }
      return {
        ...prev,
        vital_charts: [
          ...prev.vital_charts,
          {
            vital_type: vitalType,
            date_from: getDefaultDateFrom(),
            date_to: getDefaultDateTo(),
          },
        ],
      };
    });
  }, []);

  const removeVitalChart = useCallback(vitalType => {
    setTrendCharts(prev => ({
      ...prev,
      vital_charts: prev.vital_charts.filter(c => c.vital_type !== vitalType),
    }));
  }, []);

  const updateVitalChartDates = useCallback((vitalType, dateFrom, dateTo) => {
    setTrendCharts(prev => ({
      ...prev,
      vital_charts: prev.vital_charts.map(c =>
        c.vital_type === vitalType
          ? { ...c, date_from: dateFrom, date_to: dateTo }
          : c
      ),
    }));
  }, []);

  // Chart identity is (test_name, unit). Same test with different units is
  // allowed. See module-level labChartMatches/normalizeUnit helpers.
  const addLabTestChart = useCallback((testName, unit = null) => {
    setTrendCharts(prev => {
      if (prev.lab_test_charts.some(c => labChartMatches(c, testName, unit))) {
        return prev;
      }
      const totalCharts =
        prev.vital_charts.length + prev.lab_test_charts.length;
      if (totalCharts >= 10) {
        return prev;
      }
      return {
        ...prev,
        lab_test_charts: [
          ...prev.lab_test_charts,
          {
            test_name: testName,
            unit: unit ?? null,
            date_from: getDefaultDateFrom(),
            date_to: getDefaultDateTo(),
          },
        ],
      };
    });
  }, []);

  const removeLabTestChart = useCallback((testName, unit = null) => {
    setTrendCharts(prev => ({
      ...prev,
      lab_test_charts: prev.lab_test_charts.filter(
        c => !labChartMatches(c, testName, unit)
      ),
    }));
  }, []);

  const updateLabTestChartDates = useCallback(
    (testName, unit, dateFrom, dateTo) => {
      setTrendCharts(prev => ({
        ...prev,
        lab_test_charts: prev.lab_test_charts.map(c =>
          labChartMatches(c, testName, unit)
            ? { ...c, date_from: dateFrom, date_to: dateTo }
            : c
        ),
      }));
    },
    []
  );

  const clearTrendCharts = useCallback(() => {
    setTrendCharts({ vital_charts: [], lab_test_charts: [] });
  }, []);

  // --- Computed values ---

  // Get selected records count
  const getSelectedCount = useCallback(() => {
    return Object.values(selectedRecords).reduce((total, categoryRecords) => {
      return total + Object.keys(categoryRecords).length;
    }, 0);
  }, [selectedRecords]);

  const trendChartCount =
    trendCharts.vital_charts.length + trendCharts.lab_test_charts.length;
  const hasTrendCharts = trendChartCount > 0;

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
    const hasRecords = selectedRecordsArray.length > 0;
    const hasCharts = trendChartCount > 0;

    if (!hasRecords && !hasCharts) {
      return {
        valid: false,
        error:
          'Please select at least one record or trend chart to include in the report.',
      };
    }

    if (hasRecords) {
      const totalRecords = selectedRecordsArray.reduce((total, category) => {
        return total + category.record_ids.length;
      }, 0);

      if (totalRecords > 5000) {
        return {
          valid: false,
          error:
            'Cannot select more than 5000 records total across all categories.',
        };
      }

      for (const category of selectedRecordsArray) {
        if (category.record_ids.length > 1000) {
          return {
            valid: false,
            error: `Cannot select more than 1000 records in the ${category.category} category.`,
          };
        }
      }
    }

    return { valid: true };
  }, [getSelectedRecordsForAPI, trendChartCount]);

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

      // Include trend charts if any are selected
      if (trendChartCount > 0) {
        requestData.trend_charts = trendCharts;
      }

      logger.info(
        'custom_reports_generate_start',
        'Starting report generation',
        {
          categoriesCount: selectedRecordsArray.length,
          totalRecords: getSelectedCount(),
          trendChartCount,
          reportTitle: reportSettings.report_title,
          component: 'useCustomReports',
        }
      );

      const pdfBlob = await apiService.generateCustomReport(
        requestData,
        abortController.signal
      );

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

        logger.info(
          'custom_reports_generate_success',
          'Report generated and downloaded successfully',
          {
            categoriesCount: selectedRecordsArray.length,
            totalRecords: getSelectedCount(),
            trendChartCount,
            component: 'useCustomReports',
          }
        );

        notifications.show({
          title: 'Report Generated',
          message:
            'Your custom medical report has been downloaded successfully.',
          color: 'green',
          autoClose: 5000,
        });

        return true;
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info(
          'custom_reports_generate_cancelled',
          'Report generation cancelled',
          {
            component: 'useCustomReports',
          }
        );
        return false;
      }

      logger.error(
        'custom_reports_generate_error',
        'Failed to generate report',
        {
          error: error.message,
          categoriesCount: getSelectedRecordsForAPI().length,
          totalRecords: getSelectedCount(),
          component: 'useCustomReports',
        }
      );

      setError(`Failed to generate report: ${error.message}`);

      notifications.show({
        title: 'Report Generation Failed',
        message:
          error.message || 'An error occurred while generating the report.',
        color: 'red',
        autoClose: 7000,
      });

      return false;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [
    validateSelections,
    getSelectedRecordsForAPI,
    getSelectedCount,
    reportSettings,
    trendCharts,
    trendChartCount,
    setError,
    clearError,
  ]);

  // Cancel report generation
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      logger.info(
        'custom_reports_generation_cancelled',
        'Report generation cancelled by user',
        {
          component: 'useCustomReports',
        }
      );
    }
  }, []);

  return {
    // Data
    dataSummary,
    selectedRecords,
    reportSettings,
    trendCharts,

    // State
    loading,
    error,
    isGenerating,

    // Computed
    selectedCount: getSelectedCount(),
    hasSelections: getSelectedCount() > 0 || hasTrendCharts,
    trendChartCount,
    hasTrendCharts,

    // Actions
    fetchDataSummary,
    toggleRecordSelection,
    toggleCategorySelection,
    clearSelections,
    updateReportSettings,
    applyTemplate,
    generateReport,
    cancelGeneration,
    clearError,

    // Trend chart actions
    addVitalChart,
    removeVitalChart,
    updateVitalChartDates,
    addLabTestChart,
    removeLabTestChart,
    updateLabTestChartDates,
    clearTrendCharts,

    // Utilities
    getSelectedRecordsForAPI,
    validateSelections,
  };
};
