import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { getDeletionConfirmationMessage } from '../../utils/adminDeletionConfig';
import { Loading } from '../../components';
import { Button } from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import './ModelManagement.css';

const ModelManagement = () => {
  const { modelName } = useParams();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [perPage, setPerPage] = useState(25);

  // Selection for bulk operations
  const [selectedRecords, setSelectedRecords] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const loadModelData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load metadata and records in parallel
      const [metadataResult, recordsResult] = await Promise.all([
        adminApiService.getModelMetadata(modelName),
        adminApiService.getModelRecords(modelName, {
          page: currentPage,
          per_page: perPage,
        }),
      ]);

      setMetadata(metadataResult);
      setRecords(recordsResult.items);
      setTotalPages(recordsResult.total_pages);
      setTotalRecords(recordsResult.total);
    } catch (err) {
      console.error('Error loading model data:', err);
      setError(err.message || 'Failed to load model data');
    } finally {
      setLoading(false);
    }
  }, [modelName, currentPage, perPage]);

  useEffect(() => {
    if (modelName) {
      loadModelData();
    }
  }, [modelName, loadModelData]);

  const handlePageChange = newPage => {
    setCurrentPage(newPage);
    setSelectedRecords(new Set());
  };

  const handlePerPageChange = newPerPage => {
    setPerPage(newPerPage);
    setCurrentPage(1);
    setSelectedRecords(new Set());
  };

  const handleSelectRecord = recordId => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
      setShowBulkActions(false);
    } else {
      const allIds = new Set(records.map(record => record.id));
      setSelectedRecords(allIds);
      setShowBulkActions(true);
    }
  };
  const handleDeleteRecord = async recordId => {
    const record = records.find(r => r.id === recordId);
    const confirmationMessage = getDeletionConfirmationMessage(
      modelName,
      record
    );

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    try {
      await adminApiService.deleteModelRecord(modelName, recordId);
      loadModelData(); // Refresh the data
    } catch (err) {
      alert('Failed to delete record: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    const selectedRecordsArray = Array.from(selectedRecords).map(id =>
      records.find(r => r.id === id)
    );
    const confirmationMessage = getDeletionConfirmationMessage(
      modelName,
      selectedRecordsArray,
      true
    );

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    try {
      await adminApiService.bulkDeleteRecords(
        modelName,
        Array.from(selectedRecords)
      );
      setSelectedRecords(new Set());
      setShowBulkActions(false);
      loadModelData(); // Refresh the data
    } catch (err) {
      alert('Failed to delete records: ' + err.message);
    }
  };

  const formatFieldValue = (value, fieldType) => {
    if (value === null || value === undefined) {
      return '-';
    }

    if (fieldType === 'datetime' || fieldType === 'date') {
      return formatDate(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  };
  const getDisplayFields = () => {
    if (!metadata) return [];

    // Show primary key and first few important fields
    const displayFields = metadata.fields
      .filter(
        field =>
          field.primary_key ||
          [
            // User fields
            'username',
            'email',
            'full_name',
            'role',
            // Patient fields
            'first_name',
            'last_name',
            'birth_date',
            // Practitioner fields
            'name',
            'specialty',
            'practice',
            // Medical record fields
            'medication_name',
            'allergen',
            'diagnosis',
            'vaccine_name',
            'test_name',
            'reason',
            'name',
            // Status and date fields
            'status',
            'severity',
            'date',
            'start_date',
            'end_date',
            'onset_date',
            'duration',
          ].includes(field.name)
      )
      .slice(0, 5);

    // Always include id if not already included
    if (!displayFields.find(f => f.name === 'id')) {
      const idField = metadata.fields.find(f => f.name === 'id');
      if (idField) {
        displayFields.unshift(idField);
      }
    }

    return displayFields;
  };
  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-page-loading">
          <Loading message="Loading models..." />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="model-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadModelData} className="retry-btn">
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  const displayFields = getDisplayFields();

  return (
    <AdminLayout>
      <div className="model-management">
        <div className="model-header">
          <div className="model-header-top">
            <Button
              variant="secondary"
              onClick={() => navigate('/admin/data-models')}
              className="back-button"
            >
              ← Back to Data Models
            </Button>
          </div>
          
          <div className="model-header-main">
            <div className="model-title">
              <h1>{metadata?.verbose_name_plural || modelName}</h1>
              <p>{totalRecords} total records</p>
            </div>

            <div className="model-actions">
            <Button
              variant="primary"
              onClick={() => {
                // For user model, use our specialized admin user creation page
                if (modelName === 'user') {
                  navigate('/admin/create-user');
                } else {
                  navigate(`/admin/models/${modelName}/create`);
                }
              }}
            >
              ➕ Add New
            </Button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="model-controls">
          <div className="pagination-controls">
            <select
              value={perPage}
              onChange={e => handlePerPageChange(Number(e.target.value))}
              className="per-page-select"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="bulk-actions">
            <span>{selectedRecords.size} selected</span>
            <Button variant="danger" onClick={handleBulkDelete}>
              🗑️ Delete Selected
            </Button>
          </div>
        )}

        {/* Data Table */}
        <div className="model-table-container">
          <table className="model-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      selectedRecords.size === records.length &&
                      records.length > 0
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                {displayFields.map(field => (
                  <th key={field.name}>
                    {field.name}
                    {field.primary_key && (
                      <span className="pk-indicator">PK</span>
                    )}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedRecords.has(record.id)}
                      onChange={() => handleSelectRecord(record.id)}
                    />
                  </td>
                  {displayFields.map(field => (
                    <td key={field.name}>
                      {formatFieldValue(record[field.name], field.type)}
                    </td>
                  ))}
                  <td>
                    <div className="record-actions">
                      <Button
                        onClick={() =>
                          navigate(`/admin/models/${modelName}/${record.id}`)
                        }
                        variant="secondary"
                        size="small"
                        title="View Details"
                      >
                        👁️
                      </Button>
                      <Button
                        onClick={() =>
                          navigate(
                            `/admin/models/${modelName}/${record.id}/edit`
                          )
                        }
                        variant="primary"
                        size="small"
                        title="Edit"
                      >
                        ✏️
                      </Button>
                      <Button
                        onClick={() => handleDeleteRecord(record.id)}
                        variant="danger"
                        size="small"
                        title="Delete"
                      >
                        🗑️
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              variant="secondary"
            >
              ← Previous
            </Button>

            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              variant="secondary"
            >
              Next →
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ModelManagement;
