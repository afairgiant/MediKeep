import React from 'react';

const ViewToggle = ({ viewMode, onViewModeChange, showPrint = false }) => {
  return (
    <div className="view-toggle-container">
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
          onClick={() => onViewModeChange('cards')}
        >
          📋 Cards
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
          onClick={() => onViewModeChange('table')}
        >
          📊 Table
        </button>
      </div>
      {showPrint && viewMode === 'table' && (
        <button className="print-button" onClick={() => window.print()}>
          🖨️ Print
        </button>
      )}
    </div>
  );
};

export default ViewToggle;
