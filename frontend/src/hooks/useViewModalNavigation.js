import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Custom hook for managing view modal state with URL-based deep linking.
 * Handles opening/closing modals, URL parameter management, and auto-opening
 * modals from URL parameters for shareable links.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.items - Array of items to search when opening from URL
 * @param {boolean} options.loading - Loading state (prevents auto-open during load)
 * @param {string} [options.paramName='view'] - URL parameter name for the item ID
 * @param {Function} [options.onClose] - Optional callback when modal closes (receives the closed item)
 * @returns {Object} - Modal state and handlers
 */
export function useViewModalNavigation({
  items,
  loading,
  paramName = 'view',
  onClose,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  // Store onClose in a ref to avoid dependency issues
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /**
   * Open the view modal for an item and update the URL.
   */
  const openModal = useCallback(
    item => {
      setViewingItem(item);
      setIsOpen(true);
      const searchParams = new URLSearchParams(location.search);
      searchParams.set(paramName, item.id);
      navigate(`${location.pathname}?${searchParams.toString()}`, {
        replace: true,
      });
    },
    [navigate, location.pathname, location.search, paramName]
  );

  /**
   * Close the view modal and remove the URL parameter.
   */
  const closeModal = useCallback(() => {
    const closedItem = viewingItem;

    setIsOpen(false);
    setViewingItem(null);

    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete(paramName);
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });

    // Call onClose callback after state updates
    if (onCloseRef.current && closedItem) {
      onCloseRef.current(closedItem);
    }
  }, [navigate, location.pathname, location.search, paramName, viewingItem]);

  // Handle URL parameters for direct linking
  useEffect(() => {
    if (loading || !items || items.length === 0) {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get(paramName);

    if (viewId && !isOpen) {
      const item = items.find(i => i.id.toString() === viewId);
      if (item) {
        setViewingItem(item);
        setIsOpen(true);
      }
    }
  }, [location.search, items, loading, isOpen, paramName]);

  return {
    isOpen,
    viewingItem,
    openModal,
    closeModal,
  };
}

export default useViewModalNavigation;
