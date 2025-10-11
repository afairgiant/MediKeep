import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Custom hook for managing view modal navigation with URL query parameters
 * Provides consistent navigation behavior across the application
 *
 * @returns {Object} Navigation helpers
 * @property {Function} navigateToView - Navigate to view a specific item by ID
 * @property {Function} closeView - Remove view parameter from URL
 * @property {Function} getViewId - Get current view ID from URL
 */
export const useViewNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Navigate to view a specific item by adding view parameter to URL
   * @param {number|string} itemId - ID of the item to view
   * @param {boolean} replace - Whether to replace current history entry (default: true)
   */
  const navigateToView = (itemId, replace = true) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', itemId.toString());
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace });
  };

  /**
   * Close view by removing view parameter from URL
   * @param {boolean} replace - Whether to replace current history entry (default: true)
   */
  const closeView = (replace = true) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace });
  };

  /**
   * Get the current view ID from URL query parameters
   * @returns {string|null} The view ID or null if not present
   */
  const getViewId = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('view');
  };

  return {
    navigateToView,
    closeView,
    getViewId,
  };
};
