import React from 'react';
import { useTranslation } from 'react-i18next';

const ViewToggle = ({ viewMode, onViewModeChange, showPrint = false }) => {
  const { t } = useTranslation('common');

  return (
    <div className="view-toggle-container">
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
          onClick={() => onViewModeChange('cards')}
        >
          📋 {t('viewToggle.cards', 'Cards')}
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
          onClick={() => onViewModeChange('table')}
        >
          📊 {t('viewToggle.table', 'Table')}
        </button>
      </div>
      {showPrint && viewMode === 'table' && (
        <button className="print-button" onClick={() => window.print()}>
          🖨️ {t('buttons.print', 'Print')}
        </button>
      )}
    </div>
  );
};

export default ViewToggle;
