import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { getDeletionConfirmationMessage } from '../../utils/adminDeletionConfig';
import { Loading } from '../../components';
import { Button } from '../../components/ui';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';
import { IMPORTANT_FIELDS } from '../../constants/modelConstants';
import './ModelManagement.css';

// Constants
const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const ModelManagement = () => {
  const { modelName } = useParams();
  const navigate = useNavigate();
  const { formatDate } = useDateFormat();

  // Utility function for formatting field values - moved inside component to use hook
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
      logger.error('model_data_load_error', 'Error loading model data', {
        component: 'ModelManagement',
        modelName,
        error: err.message,
      });
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

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
    setSelectedRecords(new Set());
  }, []);

  const handlePerPageChange = useCallback((newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
    setSelectedRecords(new Set());
  }, []);

  const handleSelectRecord = useCallback((recordId) => {
    setSelectedRecords(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(recordId)) {
        newSelected.delete(recordId);
      } else {
        newSelected.add(recordId);
      }
      setShowBulkActions(newSelected.size > 0);
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
      setShowBulkActions(false);
    } else {
      const allIds = new Set(records.map(record => record.id));
      setSelectedRecords(allIds);
      setShowBulkActions(true);
    }
  }, [selectedRecords.size, records]);

  const handleDeleteRecord = useCallback(async (recordId) => {
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
      loadModelData();
    } catch (err) {
      alert('Failed to delete record: ' + err.message);
    }
  }, [modelName, records, loadModelData]);

  const handleBulkDelete = useCallback(async () => {
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
      loadModelData();
    } catch (err) {
      alert('Failed to delete records: ' + err.message);
    }
  }, [modelName, selectedRecords, records, loadModelData]);

  // Memoized display fields calculation
  const displayFields = useMemo(() => {
    if (!metadata) return [];

    const fields = metadata.fields
      .filter(field =>
        field.primary_key || IMPORTANT_FIELDS.includes(field.name)
      )
      .slice(0, 5);

    // Always include id if not already included
    if (!fields.find(f => f.name === 'id')) {
      const idField = metadata.fields.find(f => f.name === 'id');
      if (idField) {
        fields.unshift(idField);
      }
    }

    return fields;
  }, [metadata]);

  const handleNavigateToCreate = useCallback(() => {
    if (modelName === 'user') {
      navigate('/admin/create-user');
    } else {
      navigate(`/admin/models/${modelName}/create`);
    }
  }, [modelName, navigate]);

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

  return (
    <AdminLayout>
      <div className="model-management">
        <ModelHeader
          modelName={modelName}
          metadata={metadata}
          totalRecords={totalRecords}
          onNavigateBack={() => navigate('/admin/data-models')}
          onNavigateToCreate={handleNavigateToCreate}
        />

        <ModelControls
          perPage={perPage}
          onPerPageChange={handlePerPageChange}
        />

        {showBulkActions && (
          <BulkActions
            selectedCount={selectedRecords.size}
            onBulkDelete={handleBulkDelete}
          />
        )}

        <ModelTable
          records={records}
          displayFields={displayFields}
          selectedRecords={selectedRecords}
          modelName={modelName}
          onSelectAll={handleSelectAll}
          onSelectRecord={handleSelectRecord}
          onDelete={handleDeleteRecord}
          navigate={navigate}
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </AdminLayout>
  );
};

// Extracted Components with PropTypes

const ModelHeader = ({ modelName, metadata, totalRecords, onNavigateBack, onNavigateToCreate }) => (
  <div className="model-header">
    <div className="model-header-top">
      <Button
        variant="secondary"
        onClick={onNavigateBack}
        className="back-button"
        aria-label="Back to Data Models"
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
          onClick={onNavigateToCreate}
          aria-label="Add New Record"
        >
          + Add New
        </Button>
      </div>
    </div>
  </div>
);

ModelHeader.propTypes = {
  modelName: PropTypes.string.isRequired,
  metadata: PropTypes.shape({
    verbose_name_plural: PropTypes.string,
  }),
  totalRecords: PropTypes.number.isRequired,
  onNavigateBack: PropTypes.func.isRequired,
  onNavigateToCreate: PropTypes.func.isRequired,
};

const ModelControls = ({ perPage, onPerPageChange }) => (
  <div className="model-controls">
    <div className="pagination-controls">
      <select
        value={perPage}
        onChange={e => onPerPageChange(Number(e.target.value))}
        className="per-page-select"
        aria-label="Records per page"
      >
        {PER_PAGE_OPTIONS.map(option => (
          <option key={option} value={option}>
            {option} per page
          </option>
        ))}
      </select>
    </div>
  </div>
);

ModelControls.propTypes = {
  perPage: PropTypes.number.isRequired,
  onPerPageChange: PropTypes.func.isRequired,
};

const BulkActions = ({ selectedCount, onBulkDelete }) => (
  <div className="bulk-actions">
    <span>{selectedCount} selected</span>
    <Button variant="danger" onClick={onBulkDelete} aria-label="Delete Selected Records">
      Delete Selected
    </Button>
  </div>
);

BulkActions.propTypes = {
  selectedCount: PropTypes.number.isRequired,
  onBulkDelete: PropTypes.func.isRequired,
};

const ModelTable = ({
  records,
  displayFields,
  selectedRecords,
  modelName,
  onSelectAll,
  onSelectRecord,
  onDelete,
  navigate,
}) => (
  <div className="model-table-container">
    <table className="model-table">
      <thead>
        <tr>
          <th>
            <input
              type="checkbox"
              checked={selectedRecords.size === records.length && records.length > 0}
              onChange={onSelectAll}
              aria-label="Select all records"
            />
          </th>
          {displayFields.map(field => (
            <th key={field.name}>
              {field.name}
              {field.primary_key && (
                <span className="pk-indicator" title="Primary Key">PK</span>
              )}
            </th>
          ))}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {records.map(record => (
          <TableRow
            key={record.id}
            record={record}
            displayFields={displayFields}
            isSelected={selectedRecords.has(record.id)}
            modelName={modelName}
            onSelect={onSelectRecord}
            onDelete={onDelete}
            navigate={navigate}
          />
        ))}
      </tbody>
    </table>
  </div>
);

ModelTable.propTypes = {
  records: PropTypes.arrayOf(PropTypes.object).isRequired,
  displayFields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
      primary_key: PropTypes.bool,
    })
  ).isRequired,
  selectedRecords: PropTypes.instanceOf(Set).isRequired,
  modelName: PropTypes.string.isRequired,
  onSelectAll: PropTypes.func.isRequired,
  onSelectRecord: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
};

const TableRow = React.memo(({ record, displayFields, isSelected, modelName, onSelect, onDelete, navigate }) => (
  <tr>
    <td>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelect(record.id)}
        aria-label={`Select record ${record.id}`}
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
          onClick={() => navigate(`/admin/models/${modelName}/${record.id}`)}
          variant="secondary"
          size="small"
          title="View Details"
          aria-label="View Details"
        >
          View
        </Button>
        <Button
          onClick={() => navigate(`/admin/models/${modelName}/${record.id}/edit`)}
          variant="primary"
          size="small"
          title="Edit"
          aria-label="Edit Record"
        >
          Edit
        </Button>
        <Button
          onClick={() => onDelete(record.id)}
          variant="danger"
          size="small"
          title="Delete"
          aria-label="Delete Record"
        >
          Delete
        </Button>
      </div>
    </td>
  </tr>
));

TableRow.displayName = 'TableRow';

TableRow.propTypes = {
  record: PropTypes.object.isRequired,
  displayFields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
    })
  ).isRequired,
  isSelected: PropTypes.bool.isRequired,
  modelName: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
};

const Pagination = ({ currentPage, totalPages, onPageChange }) => (
  <div className="pagination">
    <Button
      onClick={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
      variant="secondary"
      aria-label="Previous page"
    >
      ← Previous
    </Button>

    <span className="pagination-info" aria-live="polite">
      Page {currentPage} of {totalPages}
    </span>

    <Button
      onClick={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
      variant="secondary"
      aria-label="Next page"
    >
      Next →
    </Button>
  </div>
);

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};

export default ModelManagement;
