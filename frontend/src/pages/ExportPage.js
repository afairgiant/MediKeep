import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportService } from '../services/exportService';
import '../styles/pages/ExportPage.css';

const ExportPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [formats, setFormats] = useState({ formats: [], scopes: [] });
  const [exportConfig, setExportConfig] = useState({
    format: 'json',
    scope: 'all',
    startDate: '',
    endDate: '',
    includeFiles: false,
  });
  const [selectedScopes, setSelectedScopes] = useState(['all']);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    loadExportSummary();
    loadSupportedFormats();
  }, []);

  const loadExportSummary = async () => {
    try {
      setSummaryLoading(true);
      const data = await exportService.getSummary();
      setSummary(data.data);
    } catch (error) {
      setError('Failed to load export summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadSupportedFormats = async () => {
    try {
      const data = await exportService.getSupportedFormats();
      setFormats(data);
    } catch (error) {
      setError('Failed to load supported formats');
    }
  };
  const handleSingleExport = async () => {
    try {
      setLoading(true);
      setError(null);

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
      setSuccess('Export completed successfully');
    } catch (error) {
      setError('Export failed: ' + error.message);
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
        setError('Please select at least one data scope for bulk export');
        return;
      }

      await exportService.downloadBulkExport({
        scopes,
        format: exportConfig.format,
        start_date: exportConfig.startDate || undefined,
        end_date: exportConfig.endDate || undefined,
      });

      setSuccess('Bulk export completed successfully');
    } catch (error) {
      setError('Bulk export failed: ' + error.message);
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
      <div className="export-header">
        <div className="header-top">
          <button
            onClick={() => navigate('/')}
            className="back-button"
            type="button"
          >
            ← Back to Home
          </button>
        </div>
        <h1>📥 Export Medical Records</h1>
        <p>Download your medical data in various formats</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)} className="alert-close">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess(null)} className="alert-close">
            ×
          </button>
        </div>
      )}

      {/* Export Summary */}
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
        <h2>Export Mode</h2>
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
      </div>

      {/* Export Configuration */}
      <div className="export-card">
        <h2>📋 Export Configuration</h2>

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
                setExportConfig(prev => ({ ...prev, endDate: e.target.value }))
              }
              className="form-control"
            />
          </div>
        </div>

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
              <span>Include file attachments</span>
            </label>
          </div>
        )}

        <div className="export-actions">
          {!bulkMode ? (
            <button
              onClick={handleSingleExport}
              disabled={loading}
              className="export-button primary"
            >
              {loading
                ? 'Exporting...'
                : `📥 Export ${exportConfig.scope} as ${exportConfig.format.toUpperCase()}`}
            </button>
          ) : (
            <button
              onClick={handleBulkExport}
              disabled={loading || selectedScopes.length === 0}
              className="export-button primary"
            >
              {loading
                ? 'Exporting...'
                : `📦 Bulk Export ${selectedScopes.length} types as ZIP`}
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
            format, ideal for importing into other systems.
          </li>
          <li>
            <strong>CSV Format:</strong> Comma-separated values suitable for
            spreadsheet applications like Excel.
          </li>
          <li>
            <strong>PDF Format:</strong> Human-readable document format perfect
            for printing or sharing with healthcare providers.
          </li>
          <li>
            <strong>Bulk Export:</strong> Creates a ZIP file containing multiple
            data types in your chosen format.
          </li>
        </ul>{' '}
        <p className="privacy-note">
          🔒 Exports are secured through user authentication and access
          controls. Data is transmitted securely and only accessible to
          authorized users.
        </p>
      </div>
    </div>
  );
};

export default ExportPage;
