import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { DateInput } from '../ui/DateInput';
import { Alert } from '../ui/Alert';
import { Loader } from '../ui/Loader';
import { exportService } from '../../services/exportService';
import './DataExport.css';

const DataExport = () => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [formats, setFormats] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [selectedScope, setSelectedScope] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeFiles, setIncludeFiles] = useState(false);
  const [bulkExport, setBulkExport] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [summaryData, formatsData] = await Promise.all([
        exportService.getSummary(),
        exportService.getSupportedFormats(),
      ]);

      setSummary(summaryData.data);
      setFormats(formatsData.formats);
      setScopes(formatsData.scopes);
      setError(null);
    } catch (err) {
      setError('Failed to load export options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSingleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        format: selectedFormat,
        scope: selectedScope,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedFormat === 'pdf' && { include_files: includeFiles }),
      };
      await exportService.downloadExport(params);
      setSuccess(
        `Successfully exported ${selectedScope} data as ${selectedFormat.toUpperCase()}`
      );
    } catch (err) {
      setError(err.message || 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = async () => {
    if (selectedScopes.length === 0) {
      setError('Please select at least one data type for bulk export');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = {
        scopes: selectedScopes,
        format: selectedFormat,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      };
      await exportService.downloadBulkExport(params);
      setSuccess(
        `Successfully exported ${selectedScopes.length} data types as ${selectedFormat.toUpperCase()}`
      );
    } catch (err) {
      setError(err.message || 'Bulk export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = scopeValue => {
    setSelectedScopes(prev =>
      prev.includes(scopeValue)
        ? prev.filter(s => s !== scopeValue)
        : [...prev, scopeValue]
    );
  };

  if (loading && !summary) {
    return (
      <div className="export-loading">
        <Loader />
        <p>Loading export options...</p>
      </div>
    );
  }

  return (
    <div className="data-export">
      <Card>
        <CardHeader>
          <CardTitle>Export Medical Records</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert type="error" className="mb-4">
              {error}
            </Alert>
          )}

          {success && (
            <Alert type="success" className="mb-4">
              {success}
            </Alert>
          )}

          {/* Data Summary */}
          {summary && (
            <div className="export-summary mb-6">
              <h3 className="text-lg font-semibold mb-3">Available Data</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(summary.counts).map(([type, count]) => (
                  <div key={type} className="summary-item">
                    <div className="count">{count}</div>
                    <div className="label">{type.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Type Toggle */}
          <div className="export-type-toggle mb-6">
            <div className="flex gap-4">
              <Button
                variant={!bulkExport ? 'primary' : 'secondary'}
                onClick={() => setBulkExport(false)}
              >
                Single Export
              </Button>
              <Button
                variant={bulkExport ? 'primary' : 'secondary'}
                onClick={() => setBulkExport(true)}
              >
                Bulk Export
              </Button>
            </div>
          </div>

          {/* Export Options */}
          <div className="export-options space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Export Format
              </label>
              <Select
                value={selectedFormat}
                onChange={setSelectedFormat}
                options={formats.map(f => ({ value: f.value, label: f.label }))}
              />
              <p className="text-sm text-gray-600 mt-1">
                {formats.find(f => f.value === selectedFormat)?.description}
              </p>
            </div>

            {/* Scope Selection */}
            {!bulkExport ? (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Data to Export
                </label>
                <Select
                  value={selectedScope}
                  onChange={setSelectedScope}
                  options={scopes.map(s => ({
                    value: s.value,
                    label: s.label,
                  }))}
                />
                <p className="text-sm text-gray-600 mt-1">
                  {scopes.find(s => s.value === selectedScope)?.description}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Data Types (Bulk Export)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {scopes
                    .filter(s => s.value !== 'all')
                    .map(scope => (
                      <Checkbox
                        key={scope.value}
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => handleScopeToggle(scope.value)}
                        label={scope.label}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Start Date (Optional)
                </label>
                <DateInput
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Filter from date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  End Date (Optional)
                </label>
                <DateInput
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Filter to date"
                />
              </div>
            </div>

            {/* PDF Options */}
            {selectedFormat === 'pdf' && !bulkExport && (
              <div>
                <Checkbox
                  checked={includeFiles}
                  onChange={setIncludeFiles}
                  label="Include attached files in PDF export"
                />
                <p className="text-sm text-gray-600 mt-1">
                  This may significantly increase export time and file size
                </p>
              </div>
            )}

            {/* Export Buttons */}
            <div className="export-actions">
              {!bulkExport ? (
                <Button
                  onClick={handleSingleExport}
                  disabled={loading}
                  className="w-full"
                >
                  {loading
                    ? 'Exporting...'
                    : `Export ${selectedScope} as ${selectedFormat.toUpperCase()}`}
                </Button>
              ) : (
                <Button
                  onClick={handleBulkExport}
                  disabled={loading || selectedScopes.length === 0}
                  className="w-full"
                >
                  {loading
                    ? 'Exporting...'
                    : `Bulk Export ${selectedScopes.length} types as ${selectedFormat.toUpperCase()}`}
                </Button>
              )}
            </div>
          </div>

          {/* Export Information */}
          <div className="export-info mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              Export Information
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• JSON format provides complete machine-readable data</li>
              <li>• CSV format is ideal for spreadsheet applications</li>
              <li>• PDF format creates human-readable documents</li>
              <li>• Date filters apply to record dates where available</li>
              <li>• Bulk exports are packaged in ZIP files for convenience</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataExport;
