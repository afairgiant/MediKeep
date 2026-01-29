import { vi, describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewModalNavigation } from '../useViewModalNavigation';

// Mock react-router-dom
const mockNavigate = vi.fn();
let mockLocationSearch = '';

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: '/test-page',
    search: mockLocationSearch,
  }),
}));

describe('useViewModalNavigation Hook', () => {
  const mockItems = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationSearch = '';
  });

  describe('Initial State', () => {
    test('should initialize with modal closed and no viewing item', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(false);
      expect(result.current.viewingItem).toBeNull();
      expect(typeof result.current.openModal).toBe('function');
      expect(typeof result.current.closeModal).toBe('function');
    });

    test('should expose setIsOpen and setViewingItem for advanced use cases', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      expect(typeof result.current.setIsOpen).toBe('function');
      expect(typeof result.current.setViewingItem).toBe('function');
    });
  });

  describe('openModal', () => {
    test('should open modal and set viewing item', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      act(() => {
        result.current.openModal(mockItems[0]);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.viewingItem).toEqual(mockItems[0]);
    });

    test('should update URL with view parameter', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      act(() => {
        result.current.openModal(mockItems[1]);
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/test-page?view=2',
        { replace: true }
      );
    });

    test('should use custom paramName for URL parameter', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
          paramName: 'itemId',
        })
      );

      act(() => {
        result.current.openModal(mockItems[0]);
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/test-page?itemId=1',
        { replace: true }
      );
    });

    test('should preserve existing URL parameters when opening', () => {
      mockLocationSearch = '?filter=active';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      act(() => {
        result.current.openModal(mockItems[0]);
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/test-page?filter=active&view=1',
        { replace: true }
      );
    });
  });

  describe('closeModal', () => {
    test('should close modal and clear viewing item', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      // First open the modal
      act(() => {
        result.current.openModal(mockItems[0]);
      });

      expect(result.current.isOpen).toBe(true);

      // Then close it
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.viewingItem).toBeNull();
    });

    test('should remove view parameter from URL', () => {
      mockLocationSearch = '?view=1';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      // Set up modal as open
      act(() => {
        result.current.openModal(mockItems[0]);
      });

      mockNavigate.mockClear();

      act(() => {
        result.current.closeModal();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/test-page',
        { replace: true }
      );
    });

    test('should preserve other URL parameters when closing', () => {
      mockLocationSearch = '?filter=active&view=1';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      act(() => {
        result.current.openModal(mockItems[0]);
      });

      mockNavigate.mockClear();

      act(() => {
        result.current.closeModal();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/test-page?filter=active',
        { replace: true }
      );
    });

    test('should call onClose callback with the closed item', () => {
      const onCloseMock = vi.fn();

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
          onClose: onCloseMock,
        })
      );

      act(() => {
        result.current.openModal(mockItems[1]);
      });

      act(() => {
        result.current.closeModal();
      });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledWith(mockItems[1]);
    });

    test('should not call onClose callback if no item was being viewed', () => {
      const onCloseMock = vi.fn();

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
          onClose: onCloseMock,
        })
      );

      act(() => {
        result.current.closeModal();
      });

      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('URL Deep Linking (Auto-open from URL)', () => {
    test('should auto-open modal when URL has view parameter and items are loaded', () => {
      mockLocationSearch = '?view=2';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(true);
      expect(result.current.viewingItem).toEqual(mockItems[1]);
    });

    test('should NOT auto-open modal while loading is true', () => {
      mockLocationSearch = '?view=2';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: true,
        })
      );

      expect(result.current.isOpen).toBe(false);
      expect(result.current.viewingItem).toBeNull();
    });

    test('should NOT auto-open modal when items array is empty', () => {
      mockLocationSearch = '?view=2';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: [],
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(false);
      expect(result.current.viewingItem).toBeNull();
    });

    test('should NOT auto-open modal if item ID does not exist', () => {
      mockLocationSearch = '?view=999';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(false);
      expect(result.current.viewingItem).toBeNull();
    });

    test('should auto-open modal when loading changes from true to false', () => {
      mockLocationSearch = '?view=1';

      const { result, rerender } = renderHook(
        ({ loading }) =>
          useViewModalNavigation({
            items: mockItems,
            loading,
          }),
        { initialProps: { loading: true } }
      );

      expect(result.current.isOpen).toBe(false);

      rerender({ loading: false });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.viewingItem).toEqual(mockItems[0]);
    });

    test('should work with custom paramName for URL parameter', () => {
      mockLocationSearch = '?itemId=3';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
          paramName: 'itemId',
        })
      );

      expect(result.current.isOpen).toBe(true);
      expect(result.current.viewingItem).toEqual(mockItems[2]);
    });

    test('should handle string ID comparison correctly', () => {
      mockLocationSearch = '?view=1';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      // The URL param is a string '1', but item.id is number 1
      expect(result.current.isOpen).toBe(true);
      expect(result.current.viewingItem).toEqual(mockItems[0]);
    });
  });

  describe('Advanced Setters', () => {
    test('setIsOpen should directly control modal open state', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      act(() => {
        result.current.setIsOpen(true);
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.setIsOpen(false);
      });

      expect(result.current.isOpen).toBe(false);
    });

    test('setViewingItem should directly set the viewing item', () => {
      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      act(() => {
        result.current.setViewingItem(mockItems[2]);
      });

      expect(result.current.viewingItem).toEqual(mockItems[2]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined items gracefully', () => {
      mockLocationSearch = '?view=1';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: undefined,
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(false);
      expect(result.current.viewingItem).toBeNull();
    });

    test('should handle null items gracefully', () => {
      mockLocationSearch = '?view=1';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: null,
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(false);
      expect(result.current.viewingItem).toBeNull();
    });

    test('should not re-open modal if already open with same URL param', () => {
      mockLocationSearch = '?view=1';

      const { result, rerender } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(true);

      // Store the initial viewingItem reference
      const initialViewingItem = result.current.viewingItem;

      // Re-render (simulating React re-render)
      rerender();

      // Should still be open with same item (not re-opened)
      expect(result.current.isOpen).toBe(true);
      expect(result.current.viewingItem).toBe(initialViewingItem);
    });

    test('should handle items with string IDs', () => {
      const stringIdItems = [
        { id: 'abc', name: 'Item ABC' },
        { id: 'def', name: 'Item DEF' },
      ];

      mockLocationSearch = '?view=def';

      const { result } = renderHook(() =>
        useViewModalNavigation({
          items: stringIdItems,
          loading: false,
        })
      );

      expect(result.current.isOpen).toBe(true);
      expect(result.current.viewingItem).toEqual(stringIdItems[1]);
    });
  });

  describe('Memory and Cleanup', () => {
    test('should not throw on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useViewModalNavigation({
          items: mockItems,
          loading: false,
        })
      );

      act(() => {
        result.current.openModal(mockItems[0]);
      });

      expect(() => unmount()).not.toThrow();
    });

    test('should handle onClose callback reference changes', () => {
      const onCloseMock1 = vi.fn();
      const onCloseMock2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ onClose }) =>
          useViewModalNavigation({
            items: mockItems,
            loading: false,
            onClose,
          }),
        { initialProps: { onClose: onCloseMock1 } }
      );

      act(() => {
        result.current.openModal(mockItems[0]);
      });

      // Change the callback
      rerender({ onClose: onCloseMock2 });

      act(() => {
        result.current.closeModal();
      });

      // Should call the new callback, not the old one
      expect(onCloseMock1).not.toHaveBeenCalled();
      expect(onCloseMock2).toHaveBeenCalledWith(mockItems[0]);
    });
  });
});
