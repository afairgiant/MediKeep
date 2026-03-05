import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

const MODE_CONFIG = {
  cards: { icon: '\uD83D\uDCCB', labelKey: 'viewToggle.cards', fallback: 'Cards' },
  table: { icon: '\uD83D\uDCCA', labelKey: 'viewToggle.table', fallback: 'Table' },
  components: { icon: '\uD83E\uDDEA', labelKey: 'viewToggle.components', fallback: 'Components' },
};

const ViewToggle = ({ viewMode, onViewModeChange, showPrint = false, modes = ['cards', 'table'] }) => {
  const { t } = useTranslation('common');

  return (
    <div className="view-toggle-container">
      <div className="view-toggle">
        {modes.map((mode) => {
          const cfg = MODE_CONFIG[mode];
          if (!cfg) return null;
          return (
            <button
              key={mode}
              className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => onViewModeChange(mode)}
            >
              {cfg.icon} {t(cfg.labelKey, cfg.fallback)}
            </button>
          );
        })}
      </div>
      {showPrint && viewMode === 'table' && (
        <button className="print-button" onClick={() => window.print()}>
          🖨️ {t('buttons.print', 'Print')}
        </button>
      )}
    </div>
  );
};

ViewToggle.propTypes = {
  viewMode: PropTypes.string.isRequired,
  onViewModeChange: PropTypes.func.isRequired,
  showPrint: PropTypes.bool,
  modes: PropTypes.arrayOf(PropTypes.string),
};

export default ViewToggle;
