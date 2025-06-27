import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components';
import { exportService } from '../services/exportService';
import '../styles/pages/ExportPage.css';

const ExportPage = () => {
  const navigate = useNavigate();

  // State management
  const [summary, setSummary] = useState(null);
  const [formats, setFormats] = useState({ formats: [], scopes: [] });
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Export configuration
  const [exportConfig, setExportConfig] = useState({
    format: 'json',
    scope: 'all',
    startDate: '',
    endDate: '',
    includeFiles: false,
  });

  // Bulk export state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState(['all']);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setSummaryLoading(true);
      const [summaryData, formatsData] = await Promise.all([
        exportService.getSummary(),
        exportService.getSupportedFormats(),
      ]);

      setSummary(summaryData.data);
      setFormats(formatsData);
    } catch (error) {
      setError('Failed to load export data. Please try again.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSingleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate parameters
      const validation = exportService.validateExportParams(exportConfig);
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      const params = {
        format: exportConfig.format,
        scope: exportConfig.scope,
        include_files: exportConfig.includeFiles.toString(),
      };

      if (exportConfig.startDate) {
        params.start_date = exportConfig.startDate;
      }
      if (exportConfig.endDate) {
        params.end_date = exportConfig.endDate;
      }

      await exportService.downloadExport(params);
      setSuccess(
        `Export completed successfully! Your ${exportConfig.format.toUpperCase()} file has been downloaded.`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      setError(`Export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = async () => {
    try {
      setLoading(true);
      setError(null);

      const scopes = selectedScopes.filter(scope => scope !== 'all');
      if (scopes.length === 0) {
        setError('Please select at least one data type for bulk export');
        return;
      }

      const requestData = {
        scopes,
        format: exportConfig.format,
        start_date: exportConfig.startDate || undefined,
        end_date: exportConfig.endDate || undefined,
      };

      await exportService.downloadBulkExport(requestData);
      setSuccess(
        `Bulk export completed successfully! Your ZIP file containing ${scopes.length} data types has been downloaded.`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      setError(`Bulk export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = scope => {
    if (scope === 'all') {
      setSelectedScopes(['all']);
      setExportConfig(prev => ({ ...prev, scope: 'all' }));
    } else {
      const newScopes = selectedScopes.includes(scope)
        ? selectedScopes.filter(s => s !== scope && s !== 'all')
        : [...selectedScopes.filter(s => s !== 'all'), scope];

      setSelectedScopes(newScopes);
      if (newScopes.length === 1) {
        setExportConfig(prev => ({ ...prev, scope: newScopes[0] }));
      }
    }
  };

  const getRecordCount = scopeValue => {
    if (!summary || !summary.counts) return 0;
    return summary.counts[scopeValue] || 0;
  };

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  if (summaryLoading) {
    return (
      <div className="export-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading export options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="export-page">
      {/* Header */}
      <PageHeader
        title="Export Medical Records"
        icon="📥"
        backButtonText="← Back to Dashboard"
        backButtonPath="/dashboard"
        variant="medical"
      />

      <div className="export-content">
        <p className="export-description">
          Download your medical data in various formats for backup or sharing
          with healthcare providers
        </p>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            {error}
            <button onClick={clearAlerts} className="alert-close">
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
            <button onClick={clearAlerts} className="alert-close">
              ×
            </button>
          </div>
        )}

        {/* Data Summary */}
        <div className="export-card">
          <h2>📊 Available Data Summary</h2>
          <div className="summary-grid">
            {formats.scopes
              ?.filter(scope => scope.value !== 'all')
              .map(scope => (
                <div key={scope.value} className="summary-item">
                  <div className="count">{getRecordCount(scope.value)}</div>
                  <div className="label">{scope.label}</div>
                </div>
              ))}
          </div>
        </div>

        {/* Export Mode Toggle */}
        <div className="export-card">
          <h2>📋 Export Mode</h2>
          <div className="mode-toggle">
            <button
              className={`mode-button ${!bulkMode ? 'active' : ''}`}
              onClick={() => setBulkMode(false)}
            >
              Single Export
            </button>
            <button
              className={`mode-button ${bulkMode ? 'active' : ''}`}
              onClick={() => setBulkMode(true)}
            >
              Bulk Export
            </button>
          </div>
          <p className="mode-description">
            {!bulkMode
              ? 'Export a single data type in your chosen format'
              : 'Export multiple data types together in a ZIP file'}
          </p>
        </div>

        {/* Export Configuration */}
        <div className="export-card">
          <h2>⚙️ Export Configuration</h2>

          {/* Format Selection */}
          <div className="form-group">
            <label htmlFor="format">Export Format</label>
            <select
              id="format"
              value={exportConfig.format}
              onChange={e =>
                setExportConfig(prev => ({ ...prev, format: e.target.value }))
              }
              className="form-control"
            >
              {formats.formats?.map(format => (
                <option key={format.value} value={format.value}>
                  {format.label} - {format.description}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Selection */}
          {!bulkMode ? (
            <div className="form-group">
              <label htmlFor="scope">Data to Export</label>
              <select
                id="scope"
                value={exportConfig.scope}
                onChange={e =>
                  setExportConfig(prev => ({ ...prev, scope: e.target.value }))
                }
                className="form-control"
              >
                {formats.scopes?.map(scope => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label} ({getRecordCount(scope.value)} records)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>Select Data Types for Bulk Export</label>
              <div className="checkbox-grid">
                {formats.scopes
                  ?.filter(scope => scope.value !== 'all')
                  .map(scope => (
                    <label key={scope.value} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => handleScopeToggle(scope.value)}
                      />
                      <span>
                        {scope.label} ({getRecordCount(scope.value)})
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="date-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date (Optional)</label>
              <input
                id="startDate"
                type="date"
                value={exportConfig.startDate}
                onChange={e =>
                  setExportConfig(prev => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label htmlFor="endDate">End Date (Optional)</label>
              <input
                id="endDate"
                type="date"
                value={exportConfig.endDate}
                onChange={e =>
                  setExportConfig(prev => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="form-control"
              />
            </div>
          </div>

          {/* Include Files Option (PDF only) */}
          {exportConfig.format === 'pdf' && !bulkMode && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={exportConfig.includeFiles}
                  onChange={e =>
                    setExportConfig(prev => ({
                      ...prev,
                      includeFiles: e.target.checked,
                    }))
                  }
                />
                <span>Include file attachments (creates ZIP file)</span>
              </label>
            </div>
          )}

          {/* Export Actions */}
          <div className="export-actions">
            {!bulkMode ? (
              <button
                onClick={handleSingleExport}
                disabled={loading}
                className="export-button primary"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Exporting...
                  </>
                ) : (
                  `📥 Export ${exportConfig.scope} as ${exportConfig.format.toUpperCase()}`
                )}
              </button>
            ) : (
              <button
                onClick={handleBulkExport}
                disabled={loading || selectedScopes.length === 0}
                className="export-button primary"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Creating ZIP...
                  </>
                ) : (
                  `📦 Bulk Export ${selectedScopes.length} types as ZIP`
                )}
              </button>
            )}
          </div>
        </div>

        {/* Export Information */}
        <div className="export-card info">
          <h2>ℹ️ Export Information</h2>
          <ul>
            <li>
              <strong>JSON Format:</strong> Machine-readable structured data
              format, ideal for importing into other systems or applications.
            </li>
            <li>
              <strong>CSV Format:</strong> Comma-separated values suitable for
              spreadsheet applications like Excel or Google Sheets.
            </li>
            <li>
              <strong>PDF Format:</strong> Human-readable document format
              perfect for printing or sharing with healthcare providers.
            </li>
            <li>
              <strong>Bulk Export:</strong> Creates a ZIP file containing
              multiple data types in your chosen format for comprehensive data
              backup.
            </li>
            <li>
              <strong>File Attachments:</strong> When available for PDF exports,
              lab result files can be included in a ZIP archive.
            </li>
          </ul>
          <p className="privacy-note">
            🔒 All exports are secured through user authentication. Data is
            transmitted securely and only accessible to authorized users. Your
            medical data privacy is our top priority.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
