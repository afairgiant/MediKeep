import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import PrintButton from './PrintButton';

const MODE_CONFIG = {
  panels: {
    icon: '📋',
    labelKey: 'viewToggle.labwork',
    fallback: 'Labs',
  },
  cards: {
    icon: '📋',
    labelKey: 'viewToggle.cards',
    fallback: 'Cards',
  },
  table: {
    icon: '📊',
    labelKey: 'viewToggle.table',
    fallback: 'Table',
  },
  components: {
    icon: '🧪',
    labelKey: 'viewToggle.components',
    fallback: 'Test Results',
  },
};

const ViewToggle = ({
  viewMode,
  onViewModeChange,
  showPrint = false,
  modes = ['cards', 'table'],
  size,
}) => {
  const { t } = useTranslation('common');

  const sizeClass = size ? `view-toggle-${size}` : '';

  return (
    <div className={`view-toggle-container ${sizeClass}`.trim()}>
      <div
        className="view-toggle"
        role="group"
        aria-label={t('viewToggle.label', 'View mode')}
      >
        {modes.map(mode => {
          const cfg = MODE_CONFIG[mode];
          if (!cfg) return null;
          return (
            <button
              key={mode}
              className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => onViewModeChange(mode)}
              aria-pressed={viewMode === mode}
            >
              {cfg.icon} {t(cfg.labelKey, cfg.fallback)}
            </button>
          );
        })}
      </div>
      {showPrint && viewMode === 'table' && (
        <PrintButton
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => window.print()}
        />
      )}
    </div>
  );
};

ViewToggle.propTypes = {
  viewMode: PropTypes.string.isRequired,
  onViewModeChange: PropTypes.func.isRequired,
  showPrint: PropTypes.bool,
  modes: PropTypes.arrayOf(PropTypes.string),
  size: PropTypes.oneOf(['sm']),
};

export default ViewToggle;
