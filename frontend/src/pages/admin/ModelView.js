import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { Loading } from '../../components';
import './ModelView.css';

const ModelView = () => {
  const { modelName, recordId } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load metadata and record in parallel
        const [metadataResult, recordResult] = await Promise.all([
          adminApiService.getModelMetadata(modelName),
          adminApiService.getModelRecord(modelName, recordId),
        ]);

        setMetadata(metadataResult);
        setRecord(recordResult);
      } catch (err) {
        console.error('Error loading record:', err);
        setError(err.message || 'Failed to load record');
      } finally {
        setLoading(false);
      }
    };

    if (modelName && recordId) {
      loadData();
    }
  }, [modelName, recordId]);

  const formatFieldValue = (value, fieldType) => {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    if (fieldType === 'datetime' || fieldType === 'date') {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  };

  const handleEdit = () => {
    navigate(`/admin/models/${modelName}/${recordId}/edit`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      await adminApiService.deleteModelRecord(modelName, recordId);
      navigate(`/admin/models/${modelName}`);
    } catch (err) {
      alert('Failed to delete record: ' + err.message);
    }
  };

  const handleBack = () => {
    navigate(`/admin/models/${modelName}`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <Loading />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="model-view-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleBack} className="btn btn-secondary">
            ← Back to {modelName}
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="model-view">
        <div className="model-view-header">
          <div className="view-title">
            <button onClick={handleBack} className="back-btn">
              ← Back
            </button>
            <h1>View {metadata?.display_name || modelName}</h1>
            <p>Record ID: {recordId}</p>
          </div>

          <div className="view-actions">
            <button onClick={handleEdit} className="btn btn-primary">
              ✏️ Edit
            </button>
            <button onClick={handleDelete} className="btn btn-danger">
              🗑️ Delete
            </button>
          </div>
        </div>

        <div className="record-details">
          <div className="details-grid">
            {metadata?.fields.map(field => (
              <div key={field.name} className="field-group">
                <label className="field-label">
                  {field.name}
                  {field.primary_key && <span className="pk-badge">PK</span>}
                  {field.foreign_key && <span className="fk-badge">FK</span>}
                  {!field.nullable && <span className="required">*</span>}
                </label>
                <div className={`field-value ${field.type}`}>
                  {formatFieldValue(record[field.name], field.type)}
                </div>
                <div className="field-meta">
                  Type: {field.type}
                  {field.max_length && ` | Max Length: ${field.max_length}`}
                  {field.foreign_key && ` | References: ${field.foreign_key}`}
                </div>
              </div>
            ))}
          </div>

          {/* Show raw JSON for debugging if needed */}
          <div className="raw-data-section">
            <details>
              <summary>Raw Data (JSON)</summary>
              <pre className="raw-json">{JSON.stringify(record, null, 2)}</pre>
            </details>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ModelView;
