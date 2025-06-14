import { useState, useCallback } from 'react';
import { useMedicalData } from './useMedicalData';
import { apiMethods } from '../config/apiMethods';
import { useApi } from './useApi';

export const useLabResults = () => {
  const [selectedLabResult, setSelectedLabResult] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  const { execute } = useApi();
  
  // Use the base medical data hook for standard CRUD operations
  const baseHook = useMedicalData({
    entityName: 'lab result',
    apiMethodsConfig: apiMethods.labResults,
    requiresPatient: true,
    loadFilesCounts: true
  });

  // File operations - these are specific to lab results
  const uploadFile = useCallback(async (labResultId, file, description) => {
    const result = await execute(
      async () => await apiMethods.labResults.uploadFile(labResultId, file, description),
      { errorMessage: 'Failed to upload file' }
    );
    
    if (result) {
      baseHook.setSuccessMessage('File uploaded successfully!');
      
      // Refresh files list for the selected lab result
      const files = await execute(
        async () => await apiMethods.labResults.getFiles(labResultId)
      );
      if (files) {
        setSelectedFiles(files);
      }
      
      // Refresh the main data to update file counts
      await baseHook.refreshData();
      return true;
    }
    return false;
  }, [execute, baseHook]);

  const downloadFile = useCallback(async (fileId, fileName) => {
    const blob = await execute(
      async () => await apiMethods.labResults.downloadFile(fileId),
      { errorMessage: 'Failed to download file' }
    );
    
    if (blob) {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  }, [execute]);

  const deleteFile = useCallback(async (fileId, labResultId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return false;
    }

    const result = await execute(
      async () => await apiMethods.labResults.deleteFile(fileId),
      { errorMessage: 'Failed to delete file' }
    );
    
    if (result) {
      baseHook.setSuccessMessage('File deleted successfully!');
      
      // Refresh files list for the selected lab result
      const files = await execute(
        async () => await apiMethods.labResults.getFiles(labResultId)
      );
      if (files) {
        setSelectedFiles(files);
      }
      
      // Refresh the main data to update file counts
      await baseHook.refreshData();
      return true;
    }
    return false;
  }, [execute, baseHook]);

  const viewDetails = useCallback(async (labResult) => {
    setSelectedLabResult(labResult);
    
    // Load files for this lab result
    const files = await execute(
      async () => await apiMethods.labResults.getFiles(labResult.id),
      { errorMessage: 'Failed to load files' }
    );
    
    if (files) {
      setSelectedFiles(files);
    }
  }, [execute]);

  const closeDetails = useCallback(() => {
    setSelectedLabResult(null);
    setSelectedFiles([]);
  }, []);

  const loadFiles = useCallback(async (labResultId) => {
    const files = await execute(
      async () => await apiMethods.labResults.getFiles(labResultId),
      { errorMessage: 'Failed to load files' }
    );
    
    if (files) {
      setSelectedFiles(files);
      return files;
    }
    return [];
  }, [execute]);

  return {
    // Spread all the base hook functionality
    ...baseHook,
    
    // Lab result specific state
    selectedLabResult,
    selectedFiles,
    
    // Lab result specific actions
    setSelectedLabResult,
    uploadFile,
    downloadFile,
    deleteFile,
    viewDetails,
    closeDetails,
    loadFiles
  };
};