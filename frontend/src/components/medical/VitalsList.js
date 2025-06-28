/**
 * VitalsList Component
 * Displays a list of patient vital signs with options to edit/delete
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { vitalsService } from '../../services/medical/vitalsService';
import {
  formatDate as formatDateHelper,
  formatDateTime,
} from '../../utils/helpers';
import './VitalsList.css';

const VitalsList = ({
  patientId,
  onEdit,
  onRefresh,
  showActions = true,
  limit = 10,
}) => {
  const [vitals, setVitals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'recorded_date',
    direction: 'desc',
  });
  const loadVitals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let response;
      if (patientId) {
        response = await vitalsService.getPatientVitals(patientId, { limit });
      } else {
        response = await vitalsService.getVitals({ limit });
      }

      // Extract the data array from the response
      const data = response?.data || response;

      setVitals(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load vitals');
      setVitals([]);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, limit]);

  useEffect(() => {
    loadVitals();
  }, [loadVitals]);

  useEffect(() => {
    if (onRefresh) {
      loadVitals();
    }
  }, [onRefresh, loadVitals]);

  const handleDelete = async vitalsId => {
    if (
      !window.confirm('Are you sure you want to delete this vitals record?')
    ) {
      return;
    }

    try {
      await vitalsService.deleteVitals(vitalsId);
      toast.success('Vitals record deleted successfully');
      loadVitals(); // Refresh the list
    } catch (err) {
      toast.error(
        err.response?.data?.detail || 'Failed to delete vitals record'
      );
    }
  };

  const formatDate = dateString => {
    return formatDateHelper(dateString);
  };

  const formatTime = dateString => {
    return formatDateTime(dateString);
  };

  const getBPDisplay = (systolic, diastolic) => {
    if (!systolic || !diastolic) return 'N/A';
    return `${systolic}/${diastolic}`;
  };

  const getBMIDisplay = (weight, height) => {
    if (!weight || !height) return 'N/A';
    const bmi = vitalsService.calculateBMI(weight, height);
    return bmi ? bmi.toString() : 'N/A';
  };

  const handleSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedVitals = () => {
    if (!sortConfig.key) return vitals;

    return [...vitals].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle special sorting cases
      if (
        sortConfig.key === 'recorded_date' ||
        sortConfig.key === 'created_at'
      ) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortConfig.key === 'bp') {
        // Sort by systolic blood pressure
        aValue = a.systolic_bp || 0;
        bValue = b.systolic_bp || 0;
      } else if (sortConfig.key === 'bmi') {
        // Calculate BMI for sorting
        aValue =
          a.weight && a.height
            ? vitalsService.calculateBMI(a.weight, a.height)
            : 0;
        bValue =
          b.weight && b.height
            ? vitalsService.calculateBMI(b.weight, b.height)
            : 0;
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Compare values
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getSortIcon = columnKey => {
    if (sortConfig.key !== columnKey) {
      return '↕️'; // Both arrows for unsorted
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const sortedVitals = getSortedVitals();

  if (isLoading) {
    return (
      <div className="vitals-list loading">
        <div className="loading-spinner">Loading vitals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vitals-list error">
        <div className="error-message">
          <p>Error loading vitals: {error}</p>
          <button onClick={loadVitals} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (vitals.length === 0) {
    return (
      <div className="vitals-list empty">
        <div className="empty-message">
          <p>No vitals records found</p>
          <p className="empty-subtitle">
            Vital signs will appear here once recorded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="vitals-list">
      <div className="vitals-table-container">
        <table className="vitals-table">
          {' '}
          <thead>
            <tr>
              <th
                className="sortable-header"
                onClick={() => handleSort('recorded_date')}
                title="Click to sort by date"
              >
                Date {getSortIcon('recorded_date')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('bp')}
                title="Click to sort by blood pressure"
              >
                Blood Pressure {getSortIcon('bp')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('heart_rate')}
                title="Click to sort by heart rate"
              >
                Heart Rate {getSortIcon('heart_rate')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('temperature')}
                title="Click to sort by temperature"
              >
                Temperature {getSortIcon('temperature')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('weight')}
                title="Click to sort by weight"
              >
                Weight {getSortIcon('weight')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('bmi')}
                title="Click to sort by BMI"
              >
                BMI {getSortIcon('bmi')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('oxygen_saturation')}
                title="Click to sort by oxygen saturation"
              >
                O2 Sat {getSortIcon('oxygen_saturation')}
              </th>
              {showActions && <th className="actions-header">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedVitals.map(vital => (
              <tr key={vital.id}>
                <td>
                  <div className="date-display">
                    {' '}
                    <div className="date">
                      {formatDate(vital.recorded_date)}
                    </div>
                    {vital.created_at && (
                      <div className="time">{formatTime(vital.created_at)}</div>
                    )}
                  </div>
                </td>
                <td>
                  <span className="vital-value">
                    {getBPDisplay(vital.systolic_bp, vital.diastolic_bp)}
                  </span>
                </td>
                <td>
                  {vital.heart_rate ? (
                    <span className="vital-value">{vital.heart_rate} BPM</span>
                  ) : (
                    <span className="na">N/A</span>
                  )}
                </td>
                <td>
                  {vital.temperature ? (
                    <span className="vital-value">{vital.temperature}°F</span>
                  ) : (
                    <span className="na">N/A</span>
                  )}
                </td>
                <td>
                  {vital.weight ? (
                    <span className="vital-value">{vital.weight} lbs</span>
                  ) : (
                    <span className="na">N/A</span>
                  )}
                </td>
                <td>
                  <span className="bmi-value">
                    {getBMIDisplay(vital.weight, vital.height)}
                  </span>
                </td>
                <td>
                  {vital.oxygen_saturation ? (
                    <span className="vital-value">
                      {vital.oxygen_saturation}%
                    </span>
                  ) : (
                    <span className="na">N/A</span>
                  )}
                </td>
                {showActions && (
                  <td>
                    <div className="actions">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onEdit(vital);
                        }}
                        className="edit-btn"
                        title="Edit vitals"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(vital.id);
                        }}
                        className="delete-btn"
                        title="Delete vitals"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vitals.length >= limit && (
        <div className="load-more">
          <button onClick={loadVitals} className="load-more-btn">
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default VitalsList;
