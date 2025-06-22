/**
 * Vitals Page Component
 * Main page for managing patient vital signs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import VitalsForm from '../../components/medical/VitalsForm';
import VitalsList from '../../components/medical/VitalsList';
import VitalsChart from '../../components/medical/VitalsChart';
import { vitalsService } from '../../services/medical/vitalsService';
import { useCurrentPatient } from '../../hooks/useGlobalData';
import { apiService } from '../../services/api';
import '../../styles/shared/MedicalPageShared.css';
import './Vitals.css';

const Vitals = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingVitals, setEditingVitals] = useState(null);
  const [refreshList, setRefreshList] = useState(0);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('list');

  // Use global state for patient data
  const { data: currentPatient, loading: globalDataLoading } = useCurrentPatient();

  const loadStats = useCallback(async () => {
    if (!currentPatient?.id) return;

    try {
      const statsResponse = await vitalsService.getPatientVitalsStats(
        currentPatient.id
      );

      // Extract the data from the response
      const statsData = statsResponse?.data || statsResponse;
      setStats(statsData);
    } catch (error) {
      // Stats are optional, don't show error to user
      setStats(null);
    }
  }, [currentPatient?.id]);

  useEffect(() => {
    // Load stats when current patient is available
    if (currentPatient) {
      loadStats();
    }
  }, [loadStats, currentPatient]);

  const handleAddNew = () => {
    setEditingVitals(null);
    setShowForm(true);
  };

  const handleEdit = vitals => {
    setEditingVitals(vitals);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingVitals(null);
    setRefreshList(prev => prev + 1);
    loadStats();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingVitals(null);
  };

  const formatStatValue = (value, unit = '') => {
    if (value === null || value === undefined) return 'N/A';
    return `${typeof value === 'number' ? value.toFixed(1) : value}${unit}`;
  };

  const getStatCategory = (stat, value) => {
    if (!value) return '';

    switch (stat) {
      case 'avg_systolic_bp':
      case 'avg_diastolic_bp':
        if (stat === 'avg_systolic_bp') {
          return vitalsService.getBloodPressureCategory(
            value,
            stats?.avg_diastolic_bp
          );
        }
        return '';
      default:
        return '';
    }
  };
  return (
    <div className="medical-page-container">
      <div className="medical-page-header">
        <Link to="/dashboard" className="back-button">
          ← Back to Dashboard{' '}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🩺</span>
          <h1>Vital Signs</h1>
        </div>
        {currentPatient && (
          <div style={{ marginLeft: 'auto', fontSize: '1.1rem', opacity: 0.9 }}>
            {currentPatient.name}
          </div>
        )}
      </div>

      <div className="medical-page-content">
        <div
          className="header-actions"
          style={{ marginBottom: '2rem', textAlign: 'right' }}
        >
          <button onClick={handleAddNew} className="btn-primary add-vitals-btn">
            + Record Vitals
          </button>
        </div>
        {stats && (
          <div className="stats-overview">
            <h3>Latest Readings & Averages</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Blood Pressure</div>
                <div className="stat-value">
                  {formatStatValue(stats.avg_systolic_bp, '')} /{' '}
                  {formatStatValue(stats.avg_diastolic_bp, ' mmHg')}
                </div>
                {stats.avg_systolic_bp && stats.avg_diastolic_bp && (
                  <div
                    className={`stat-category ${getStatCategory('avg_systolic_bp', stats.avg_systolic_bp).toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {getStatCategory('avg_systolic_bp', stats.avg_systolic_bp)}
                  </div>
                )}
              </div>
              <div className="stat-card">
                <div className="stat-label">Heart Rate</div>
                <div className="stat-value">
                  {formatStatValue(stats.avg_heart_rate, ' BPM')}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Temperature</div>
                <div className="stat-value">
                  {formatStatValue(stats.avg_temperature, '°F')}
                </div>
              </div>{' '}
              <div className="stat-card">
                <div className="stat-label">Latest Weight</div>
                <div className="stat-value">
                  {formatStatValue(stats.current_weight, ' lbs')}
                </div>
              </div>{' '}
              <div className="stat-card">
                <div className="stat-label">Latest BMI</div>
                <div className="stat-value">
                  {formatStatValue(stats.current_bmi, '')}
                </div>
              </div>
            </div>
          </div>
        )}
        {showForm && (
          <div className="form-overlay">
            <div className="form-container">
              {' '}
              <VitalsForm
                vitals={editingVitals}
                patientId={currentPatient?.id}
                practitionerId={null} // No practitioner until practitioners are implemented
                onSave={handleFormSave}
                onCancel={handleFormCancel}
                isEdit={!!editingVitals}
              />
            </div>
          </div>
        )}
        <div className="content-tabs">
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              📋 Records
            </button>
            <button
              className={`tab-button ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              📈 Trends (Currently Broken)
            </button>{' '}
          </div>

          <div className="tab-content">
            {activeTab === 'list' && (
              <VitalsList
                patientId={currentPatient?.id}
                onEdit={handleEdit}
                onRefresh={refreshList}
                showActions={true}
              />
            )}{' '}
            {activeTab === 'chart' && (
              <VitalsChart patientId={currentPatient?.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vitals;
