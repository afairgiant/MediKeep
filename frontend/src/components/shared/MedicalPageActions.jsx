import PropTypes from 'prop-types';
import { Group, Button } from '@mantine/core';
import ViewToggle from './ViewToggle';

/**
 * MedicalPageActions - A reusable component for the action button row on medical pages
 *
 * Consolidates the repetitive "Add button + ViewToggle" pattern used across 14+ medical pages.
 * Supports primary action, secondary actions, and optional ViewToggle.
 *
 * @example
 * // Basic usage with primary action and ViewToggle
 * <MedicalPageActions
 *   primaryAction={{
 *     label: t('allergies.addNew'),
 *     onClick: handleAddAllergy,
 *     leftSection: <IconPlus size={16} />,
 *   }}
 *   viewMode={viewMode}
 *   onViewModeChange={setViewMode}
 * />
 *
 * @example
 * // With secondary actions
 * <MedicalPageActions
 *   primaryAction={{
 *     label: 'Add Lab Result',
 *     onClick: handleAddLabResult,
 *   }}
 *   secondaryActions={[
 *     {
 *       label: 'Quick PDF Import',
 *       onClick: handleQuickImport,
 *       variant: 'light',
 *       leftSection: <IconFileUpload size={16} />,
 *     },
 *   ]}
 *   viewMode={viewMode}
 *   onViewModeChange={setViewMode}
 * />
 *
 * @example
 * // Without ViewToggle
 * <MedicalPageActions
 *   primaryAction={{
 *     label: 'Add Vital Signs',
 *     onClick: handleAddVitals,
 *   }}
 *   showViewToggle={false}
 * />
 */
function MedicalPageActions({
  primaryAction,
  secondaryActions = [],
  viewMode,
  onViewModeChange,
  showPrint = true,
  showViewToggle = true,
  mb = 'lg',
  align = 'flex-start',
  buttonGap = 'sm',
  children,
}) {
  // Filter out actions with visible: false
  const visibleSecondaryActions = secondaryActions.filter(
    action => action.visible !== false
  );

  // Determine if ViewToggle should be rendered
  const shouldShowViewToggle = showViewToggle && viewMode && onViewModeChange;

  // Don't render if primary action is hidden and no visible secondary actions
  const primaryVisible = primaryAction?.visible !== false;
  if (!primaryVisible && visibleSecondaryActions.length === 0 && !shouldShowViewToggle && !children) {
    return null;
  }

  return (
    <Group justify="space-between" align={align} mb={mb}>
      <Group gap={buttonGap}>
        {primaryVisible && primaryAction && (
          <Button
            variant={primaryAction.variant || 'filled'}
            size={primaryAction.size || 'md'}
            color={primaryAction.color}
            leftSection={primaryAction.leftSection}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </Button>
        )}

        {visibleSecondaryActions.map((action, index) => (
          <Button
            key={action.key || `secondary-${index}`}
            variant={action.variant || 'light'}
            size={action.size || 'md'}
            color={action.color}
            leftSection={action.leftSection}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}

        {children}
      </Group>

      {shouldShowViewToggle && (
        <ViewToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          showPrint={showPrint}
        />
      )}
    </Group>
  );
}

const actionShape = PropTypes.shape({
  /** Button label text */
  label: PropTypes.string.isRequired,
  /** Click handler function */
  onClick: PropTypes.func.isRequired,
  /** Icon or element to show on left side of button */
  leftSection: PropTypes.node,
  /** Mantine Button variant (defaults to 'filled' for primary, 'light' for secondary) */
  variant: PropTypes.string,
  /** Mantine Button size (defaults to 'md') */
  size: PropTypes.string,
  /** Mantine color for the button */
  color: PropTypes.string,
  /** Whether the button is disabled */
  disabled: PropTypes.bool,
  /** Whether the action is visible (defaults to true) */
  visible: PropTypes.bool,
  /** Unique key for the action (used for secondary actions) */
  key: PropTypes.string,
});

MedicalPageActions.propTypes = {
  /** Primary action button configuration */
  primaryAction: actionShape,
  /** Array of secondary action button configurations */
  secondaryActions: PropTypes.arrayOf(actionShape),
  /** Current view mode ('cards' or 'table') for ViewToggle */
  viewMode: PropTypes.string,
  /** Callback when view mode changes */
  onViewModeChange: PropTypes.func,
  /** Whether to show print button in ViewToggle (defaults to true) */
  showPrint: PropTypes.bool,
  /** Whether to show ViewToggle (defaults to true) */
  showViewToggle: PropTypes.bool,
  /** Margin bottom for the container (defaults to 'lg') */
  mb: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Vertical alignment of items (defaults to 'flex-start') */
  align: PropTypes.string,
  /** Gap between buttons (defaults to 'sm') */
  buttonGap: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Custom content to render in the left section */
  children: PropTypes.node,
};

export default MedicalPageActions;
