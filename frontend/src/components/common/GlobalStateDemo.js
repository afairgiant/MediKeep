import React from 'react';
import { useAppData } from '../../contexts/AppDataContext';
import { useCurrentPatient, usePractitioners, usePharmacies, useCacheManager } from '../../hooks/useGlobalData';
import './GlobalStateDemo.css';

const GlobalStateDemo = () => {
  const { patient, loading: patientLoading } = useCurrentPatient();
  const { practitioners, loading: practitionersLoading } = usePractitioners();
  const { pharmacies, loading: pharmaciesLoading } = usePharmacies();
  const { invalidateAll, updateCacheExpiry } = useCacheManager();
  const { patientLastFetch, practitionersLastFetch, pharmaciesLastFetch, cacheExpiry } = useAppData();

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getTimeRemaining = (lastFetch, cacheKey) => {
    if (!lastFetch) return 'N/A';
    const expiryTime = cacheExpiry[cacheKey] * 60 * 1000;
    const elapsed = Date.now() - lastFetch;
    const remaining = expiryTime - elapsed;
    if (remaining <= 0) return 'Expired';
    return `${Math.round(remaining / 1000)}s`;
  };

  return (
    <div className="global-state-demo">
      <h2>Global State Demo</h2>
      <p className="demo-description">
        This demo shows how data is cached globally and shared across components.
        Notice how navigating between pages doesn't refetch the same data!
      </p>

      <div className="cache-grid">
        <div className="cache-item">
          <h3>Patient Data</h3>
          <div className="cache-status">
            <span className={`status-badge ${patientLoading ? 'loading' : 'ready'}`}>
              {patientLoading ? 'Loading...' : 'Ready'}
            </span>
          </div>
          <div className="cache-details">
            <p><strong>Last Fetch:</strong> {formatTimestamp(patientLastFetch)}</p>
            <p><strong>Cache Expires:</strong> {getTimeRemaining(patientLastFetch, 'patient')}</p>
            <p><strong>Data:</strong> {patient ? patient.name || 'Loaded' : 'No data'}</p>
          </div>
        </div>

        <div className="cache-item">
          <h3>Practitioners</h3>
          <div className="cache-status">
            <span className={`status-badge ${practitionersLoading ? 'loading' : 'ready'}`}>
              {practitionersLoading ? 'Loading...' : 'Ready'}
            </span>
          </div>
          <div className="cache-details">
            <p><strong>Last Fetch:</strong> {formatTimestamp(practitionersLastFetch)}</p>
            <p><strong>Cache Expires:</strong> {getTimeRemaining(practitionersLastFetch, 'practitioners')}</p>
            <p><strong>Count:</strong> {practitioners.length}</p>
          </div>
        </div>

        <div className="cache-item">
          <h3>Pharmacies</h3>
          <div className="cache-status">
            <span className={`status-badge ${pharmaciesLoading ? 'loading' : 'ready'}`}>
              {pharmaciesLoading ? 'Loading...' : 'Ready'}
            </span>
          </div>
          <div className="cache-details">
            <p><strong>Last Fetch:</strong> {formatTimestamp(pharmaciesLastFetch)}</p>
            <p><strong>Cache Expires:</strong> {getTimeRemaining(pharmaciesLastFetch, 'pharmacies')}</p>
            <p><strong>Count:</strong> {pharmacies.length}</p>
          </div>
        </div>
      </div>

      <div className="cache-controls">
        <h3>Cache Controls</h3>
        <button 
          className="cache-button"
          onClick={() => invalidateAll()}
        >
          Clear All Caches
        </button>
        <button 
          className="cache-button"
          onClick={() => updateCacheExpiry({ patient: 1, practitioners: 2, pharmacies: 2 })}
        >
          Set Short Cache (1-2 min)
        </button>
        <button 
          className="cache-button"
          onClick={() => updateCacheExpiry({ patient: 15, practitioners: 60, pharmacies: 60 })}
        >
          Reset Default Cache
        </button>
      </div>

      <div className="cache-settings">
        <h3>Current Cache Settings</h3>
        <ul>
          <li>Patient Data: {cacheExpiry.patient} minutes</li>
          <li>Practitioners: {cacheExpiry.practitioners} minutes</li>
          <li>Pharmacies: {cacheExpiry.pharmacies} minutes</li>
        </ul>
      </div>
    </div>
  );
};

export default GlobalStateDemo; 