import { useState, useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { apiService } from '../services/api';
import { notifications } from '@mantine/notifications';
import logger from '../services/logger';

/**
 * Custom hook for managing report templates
 * Provides CRUD operations for saving and managing report templates
 */
export const useReportTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { loading, error, execute, clearError, setError } = useApi();
  const abortControllerRef = useRef(null);

  // Fetch all saved templates
  const fetchTemplates = useCallback(async () => {
    logger.info('report_templates_fetch', 'Fetching saved report templates', {
      component: 'useReportTemplates',
    });

    const result = await execute(
      async signal => {
        const response = await apiService.getReportTemplates(signal);
        logger.debug('report_templates_fetch_response', 'Templates fetched successfully', {
          templateCount: Array.isArray(response) ? response.length : 0,
          component: 'useReportTemplates',
        });
        return response;
      },
      { errorMessage: 'Failed to fetch report templates' }
    );

    if (result) {
      setTemplates(Array.isArray(result) ? result : []);
      return result;
    }
    return [];
  }, [execute]);

  // Fetch a specific template by ID
  const fetchTemplate = useCallback(async (templateId) => {
    logger.info('report_template_fetch_single', 'Fetching specific report template', {
      templateId,
      component: 'useReportTemplates',
    });

    const result = await execute(
      async signal => {
        const response = await apiService.getReportTemplate(templateId, signal);
        logger.debug('report_template_fetch_single_response', 'Template fetched successfully', {
          templateId,
          templateName: response?.name,
          component: 'useReportTemplates',
        });
        return response;
      },
      { errorMessage: `Failed to fetch template ${templateId}` }
    );

    if (result) {
      setCurrentTemplate(result);
      return result;
    }
    return null;
  }, [execute]);

  // Save a new template
  const saveTemplate = useCallback(async (templateData) => {
    // Validate template data
    if (!templateData.name || !templateData.name.trim()) {
      setError('Template name is required');
      return false;
    }

    if (!templateData.selected_records || templateData.selected_records.length === 0) {
      setError('Template must have at least one selected record category');
      return false;
    }

    setIsSaving(true);
    clearError();

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      logger.info('report_template_save', 'Saving new report template', {
        templateName: templateData.name,
        categoriesCount: templateData.selected_records.length,
        component: 'useReportTemplates',
      });

      const result = await apiService.saveReportTemplate(templateData, abortController.signal);

      if (result?.success) {
        logger.info('report_template_save_success', 'Template saved successfully', {
          templateId: result.template_id,
          templateName: templateData.name,
          component: 'useReportTemplates',
        });

        notifications.show({
          title: 'Template Saved',
          message: `Template "${templateData.name}" has been saved successfully.`,
          color: 'green',
          autoClose: 5000,
        });

        // Refresh templates list
        await fetchTemplates();
        return result;
      } else {
        throw new Error(result?.message || 'Unknown error occurred');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('report_template_save_cancelled', 'Template save cancelled', {
          component: 'useReportTemplates',
        });
        return false;
      }

      logger.error('report_template_save_error', 'Failed to save template', {
        error: error.message,
        templateName: templateData.name,
        component: 'useReportTemplates',
      });

      setError(`Failed to save template: ${error.message}`);
      
      notifications.show({
        title: 'Save Failed',
        message: error.message || 'An error occurred while saving the template.',
        color: 'red',
        autoClose: 7000,
      });

      return false;
    } finally {
      setIsSaving(false);
      abortControllerRef.current = null;
    }
  }, [execute, setError, clearError, fetchTemplates]);

  // Update an existing template
  const updateTemplate = useCallback(async (templateId, templateData) => {
    // Validate template data
    if (!templateData.name || !templateData.name.trim()) {
      setError('Template name is required');
      return false;
    }

    if (!templateData.selected_records || templateData.selected_records.length === 0) {
      setError('Template must have at least one selected record category');
      return false;
    }

    setIsSaving(true);
    clearError();

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      logger.info('report_template_update', 'Updating report template', {
        templateId,
        templateName: templateData.name,
        categoriesCount: templateData.selected_records.length,
        component: 'useReportTemplates',
      });

      const result = await apiService.updateReportTemplate(templateId, templateData, abortController.signal);

      if (result?.success) {
        logger.info('report_template_update_success', 'Template updated successfully', {
          templateId,
          templateName: templateData.name,
          component: 'useReportTemplates',
        });

        notifications.show({
          title: 'Template Updated',
          message: `Template "${templateData.name}" has been updated successfully.`,
          color: 'green',
          autoClose: 5000,
        });

        // Refresh templates list
        await fetchTemplates();
        return result;
      } else {
        throw new Error(result?.message || 'Unknown error occurred');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('report_template_update_cancelled', 'Template update cancelled', {
          component: 'useReportTemplates',
        });
        return false;
      }

      logger.error('report_template_update_error', 'Failed to update template', {
        error: error.message,
        templateId,
        templateName: templateData.name,
        component: 'useReportTemplates',
      });

      setError(`Failed to update template: ${error.message}`);
      
      notifications.show({
        title: 'Update Failed',
        message: error.message || 'An error occurred while updating the template.',
        color: 'red',
        autoClose: 7000,
      });

      return false;
    } finally {
      setIsSaving(false);
      abortControllerRef.current = null;
    }
  }, [execute, setError, clearError, fetchTemplates]);

  // Delete a template
  const deleteTemplate = useCallback(async (templateId, templateName) => {
    if (!window.confirm(`Are you sure you want to delete the template "${templateName}"? This action cannot be undone.`)) {
      return false;
    }

    clearError();

    try {
      logger.info('report_template_delete', 'Deleting report template', {
        templateId,
        templateName,
        component: 'useReportTemplates',
      });

      const result = await execute(
        async signal => {
          return await apiService.deleteReportTemplate(templateId, signal);
        },
        { errorMessage: `Failed to delete template "${templateName}"` }
      );

      if (result?.success) {
        logger.info('report_template_delete_success', 'Template deleted successfully', {
          templateId,
          templateName,
          component: 'useReportTemplates',
        });

        notifications.show({
          title: 'Template Deleted',
          message: `Template "${templateName}" has been deleted successfully.`,
          color: 'green',
          autoClose: 5000,
        });

        // Remove from local state
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        
        // Clear current template if it was the deleted one
        if (currentTemplate?.id === templateId) {
          setCurrentTemplate(null);
        }

        return result;
      }

      return false;
    } catch (error) {
      logger.error('report_template_delete_error', 'Failed to delete template', {
        error: error.message,
        templateId,
        templateName,
        component: 'useReportTemplates',
      });

      notifications.show({
        title: 'Delete Failed',
        message: error.message || 'An error occurred while deleting the template.',
        color: 'red',
        autoClose: 7000,
      });

      return false;
    }
  }, [execute, clearError, currentTemplate]);

  // Load template data for use in report builder
  const loadTemplateForReport = useCallback(async (templateId) => {
    const template = await fetchTemplate(templateId);
    if (template) {
      logger.info('report_template_loaded_for_report', 'Template loaded for report generation', {
        templateId,
        templateName: template.name,
        categoriesCount: template.selected_records?.length || 0,
        component: 'useReportTemplates',
      });
      return template;
    }
    return null;
  }, [fetchTemplate]);

  // Clear current template
  const clearCurrentTemplate = useCallback(() => {
    setCurrentTemplate(null);
  }, []);

  // Find template by name
  const findTemplateByName = useCallback((name) => {
    return templates.find(t => t.name.toLowerCase() === name.toLowerCase());
  }, [templates]);

  return {
    // Data
    templates,
    currentTemplate,

    // State
    loading,
    error,
    isSaving,

    // Actions
    fetchTemplates,
    fetchTemplate,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    loadTemplateForReport,
    clearCurrentTemplate,
    clearError,

    // Utilities
    findTemplateByName,
    hasTemplates: templates.length > 0,
  };
};