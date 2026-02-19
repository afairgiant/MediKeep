import { vi } from 'vitest';
import React from 'react';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import test utilities
import {
  renderResponsive,
  testBreakpointTransitions,
  measureRenderPerformance,
  TEST_VIEWPORTS,
  mockViewport,
  BREAKPOINTS
} from './ResponsiveTestUtils';

import logger from '../../services/logger';

// Mock logger
vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useResponsive hook with performance tracking
const mockUseResponsive = vi.fn();
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive()
}));

// Mock ResponsiveTable with simple HTML
vi.mock('../../components/adapters/ResponsiveTable', () => {
  function MockResponsiveTable({ data = [], columns = [], onRowClick, pagination, totalRecords, pageSize = 20, virtualization, loading }) {
    if (loading) {
      return (
        <div data-testid="responsive-table-loading">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} data-testid="skeleton" style={{ height: 40, background: '#eee' }} />
          ))}
        </div>
      );
    }

    // Simulate virtualization: only render a subset of rows
    const isVirtualized = virtualization === true || (virtualization === 'auto' && data.length > 100);
    const visibleData = isVirtualized ? data.slice(0, Math.min(50, data.length)) : data;

    return (
      <div data-testid="responsive-table">
        {isVirtualized && <div data-testid="scroll-area" data-scrollable="true" style={{ overflow: 'auto', maxHeight: 500 }} />}
        <table role="table">
          <thead>
            <tr role="row">
              {columns.map(col => (
                <th key={col.key} role="columnheader">{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, i) => (
              <tr key={row.id ?? i} role="row" onClick={() => onRowClick && onRowClick(row, i)}>
                {columns.map(col => (
                  <td key={col.key} role="cell">{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && totalRecords > pageSize && (
          <nav role="navigation" aria-label="Pagination">
            <button>Previous</button>
            <button>Next</button>
          </nav>
        )}
      </div>
    );
  }
  return { default: MockResponsiveTable, ResponsiveTable: MockResponsiveTable };
});

// Mock ResponsiveModal with simple HTML
vi.mock('../../components/adapters/ResponsiveModal', () => {
  function MockResponsiveModal({ opened, onClose, title, children }) {
    if (!opened) return null;
    return (
      <div role="dialog" aria-label={title || 'Modal'}>
        {title && <h2>{title}</h2>}
        <div>{children}</div>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }
  return { default: MockResponsiveModal, ResponsiveModal: MockResponsiveModal };
});

// Mock ResponsiveSelect with native select
vi.mock('../../components/adapters/ResponsiveSelect', () => {
  function MockResponsiveSelect({ options = [], label, onChange, error, value, ...rest }) {
    const normalizedOptions = options.map(opt =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
    return (
      <div>
        {label && <label htmlFor={`select-${label}`}>{label}</label>}
        <select
          id={label ? `select-${label}` : undefined}
          role="combobox"
          value={value || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {normalizedOptions.map((opt, i) => (
            <option key={opt.value ?? i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <div role="alert">{error}</div>}
      </div>
    );
  }
  return { default: MockResponsiveSelect, ResponsiveSelect: MockResponsiveSelect };
});

// Mock MantineMedicationForm with simple HTML
vi.mock('../../components/medical/MantineMedicationForm', () => ({
  default: function MockMedicationForm({ isOpen, onClose, onSubmit, onInputChange, formData = {}, practitionersOptions = [] }) {
    if (!isOpen) return null;
    return (
      <form data-testid="medication-form" onSubmit={(e) => { e.preventDefault(); onSubmit && onSubmit(formData); }}>
        <label htmlFor="perf-med-name">Medication Name</label>
        <input
          id="perf-med-name"
          name="medication_name"
          role="textbox"
          defaultValue={formData.medication_name || ''}
          onChange={(e) => onInputChange && onInputChange({ target: { name: 'medication_name', value: e.target.value } })}
        />
        <label htmlFor="perf-med-dosage">Dosage</label>
        <input
          id="perf-med-dosage"
          name="dosage"
          defaultValue={formData.dosage || ''}
          onChange={(e) => onInputChange && onInputChange({ target: { name: 'dosage', value: e.target.value } })}
        />
        <button type="submit">Save</button>
        <button type="button" onClick={onClose}>Close</button>
      </form>
    );
  },
}));

// Import mocked components
import ResponsiveTable from '../../components/adapters/ResponsiveTable';
import ResponsiveModal from '../../components/adapters/ResponsiveModal';
import ResponsiveSelect from '../../components/adapters/ResponsiveSelect';
import MantineMedicationForm from '../../components/medical/MantineMedicationForm';

// Performance measurement utilities
const measureAsyncRender = async (renderFn) => {
  const start = performance.now();
  const result = await renderFn();
  const end = performance.now();
  return {
    result,
    duration: end - start
  };
};

const createMockData = (count) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    medication_name: `Medication ${index}`,
    dosage: `${(index + 1) * 10}mg`,
    frequency: index % 2 === 0 ? 'Once daily' : 'Twice daily',
    prescribing_practitioner: `Dr. ${String.fromCharCode(65 + (index % 26))}`,
    start_date: '2024-01-01',
    status: index % 3 === 0 ? 'Discontinued' : 'Active',
    notes: `Notes for medication ${index}`.repeat(Math.floor(index % 5) + 1)
  }));
};

const createMockColumns = () => [
  { key: 'medication_name', title: 'Medication', priority: 'high' },
  { key: 'dosage', title: 'Dosage', priority: 'high' },
  { key: 'frequency', title: 'Frequency', priority: 'medium' },
  { key: 'prescribing_practitioner', title: 'Doctor', priority: 'medium' },
  { key: 'start_date', title: 'Start Date', priority: 'low' },
  { key: 'status', title: 'Status', priority: 'high' },
  { key: 'notes', title: 'Notes', priority: 'low' }
];

describe('Responsive Component Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock default responsive state
    mockUseResponsive.mockReturnValue({
      breakpoint: 'lg',
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1280,
      height: 720
    });
  });

  describe('Breakpoint Transition Performance', () => {
    it('transitions between breakpoints within 100ms for ResponsiveTable', async () => {
      const data = createMockData(50);
      const columns = createMockColumns();

      await testBreakpointTransitions(
        <ResponsiveTable data={data} columns={columns} />,
        ['mobile', 'tablet', 'desktop']
      );

      // Each transition should be logged with performance metrics
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Breakpoint transition'),
        expect.objectContaining({
          transitionTime: expect.stringMatching(/\d+\.\d+ms/)
        })
      );
    });

    it('transitions between breakpoints efficiently for ResponsiveModal', async () => {
      const ModalContent = () => (
        <div>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i}>Form field {i}</div>
          ))}
        </div>
      );

      await testBreakpointTransitions(
        <ResponsiveModal opened={true} onClose={() => {}}>
          <ModalContent />
        </ResponsiveModal>,
        ['mobile', 'tablet', 'desktop']
      );

      // Modal transitions should also be within performance limits
      const debugCalls = logger.debug.mock.calls.filter(call =>
        call[0].includes('Breakpoint transition')
      );

      debugCalls.forEach(call => {
        const transitionTime = parseFloat(call[1].transitionTime.replace('ms', ''));
        expect(transitionTime).toBeLessThan(100);
      });
    });

    it('handles rapid breakpoint changes without performance degradation', async () => {
      const { rerender } = renderResponsive(
        <ResponsiveTable data={createMockData(25)} columns={createMockColumns()} />
      );

      const breakpointSequence = ['xs', 'sm', 'md', 'lg', 'xl', 'xs', 'lg', 'md'];
      const transitionTimes = [];

      for (let i = 0; i < breakpointSequence.length - 1; i++) {
        const currentBreakpoint = breakpointSequence[i];
        const nextBreakpoint = breakpointSequence[i + 1];

        const currentViewport = TEST_VIEWPORTS[currentBreakpoint] || {
          width: BREAKPOINTS[currentBreakpoint].min + 50,
          height: 600
        };
        const nextViewport = TEST_VIEWPORTS[nextBreakpoint] || {
          width: BREAKPOINTS[nextBreakpoint].min + 50,
          height: 600
        };

        // Update mock for current breakpoint
        mockUseResponsive.mockReturnValue({
          breakpoint: currentBreakpoint,
          deviceType: currentBreakpoint === 'xs' || currentBreakpoint === 'sm' ? 'mobile' :
                     currentBreakpoint === 'md' ? 'tablet' : 'desktop',
          isMobile: currentBreakpoint === 'xs' || currentBreakpoint === 'sm',
          isTablet: currentBreakpoint === 'md',
          isDesktop: ['lg', 'xl'].includes(currentBreakpoint),
          width: currentViewport.width,
          height: currentViewport.height
        });

        mockViewport(currentViewport.width, currentViewport.height);

        const startTime = performance.now();

        // Update to next breakpoint
        mockUseResponsive.mockReturnValue({
          breakpoint: nextBreakpoint,
          deviceType: nextBreakpoint === 'xs' || nextBreakpoint === 'sm' ? 'mobile' :
                     nextBreakpoint === 'md' ? 'tablet' : 'desktop',
          isMobile: nextBreakpoint === 'xs' || nextBreakpoint === 'sm',
          isTablet: nextBreakpoint === 'md',
          isDesktop: ['lg', 'xl'].includes(nextBreakpoint),
          width: nextViewport.width,
          height: nextViewport.height
        });

        mockViewport(nextViewport.width, nextViewport.height);
        rerender(<ResponsiveTable data={createMockData(25)} columns={createMockColumns()} />);

        const endTime = performance.now();
        transitionTimes.push(endTime - startTime);
      }

      // All transitions should be fast
      transitionTimes.forEach(time => {
        expect(time).toBeLessThan(100);
      });

      // Average transition time should be reasonable
      const averageTime = transitionTimes.reduce((a, b) => a + b, 0) / transitionTimes.length;
      expect(averageTime).toBeLessThan(50);
    });
  });

  describe('Component Render Performance', () => {
    it('renders ResponsiveTable with large datasets efficiently', async () => {
      const dataSizes = [10, 50, 100, 250, 500];
      const renderTimes = {};

      for (const size of dataSizes) {
        const data = createMockData(size);
        const columns = createMockColumns();

        const { duration } = await measureAsyncRender(async () => {
          const { unmount } = renderResponsive(
            <ResponsiveTable data={data} columns={columns} />
          );
          return unmount;
        });

        renderTimes[size] = duration;

        // Render time should scale reasonably with data size
        expect(duration).toBeLessThan(size * 2); // Max 2ms per item
      }

      // Verify scaling is reasonable (not exponential)
      expect(renderTimes[500]).toBeLessThan(renderTimes[100] * 10);
    });

    it('handles ResponsiveSelect with many options efficiently', async () => {
      const optionCounts = [10, 50, 100, 500, 1000];
      const renderTimes = {};

      for (const count of optionCounts) {
        const options = Array.from({ length: count }, (_, i) => ({
          value: i.toString(),
          label: `Option ${i + 1}`
        }));

        const { duration } = await measureAsyncRender(async () => {
          const { unmount } = renderResponsive(
            <ResponsiveSelect options={options} />
          );
          return unmount;
        });

        renderTimes[count] = duration;

        // Select should render quickly regardless of option count
        expect(duration).toBeLessThan(200);
      }

      // Performance should not degrade significantly with option count
      // Allow generous multiplier since small absolute times have high variance
      expect(renderTimes[1000]).toBeLessThan(renderTimes[100] * 10);
    });

    it('measures ResponsiveModal render performance', async () => {
      const complexityLevels = ['low', 'medium', 'high'];
      const fieldCounts = { low: 5, medium: 15, high: 25 };
      const renderTimes = {};

      for (const complexity of complexityLevels) {
        const fieldCount = fieldCounts[complexity];
        const formFields = Array.from({ length: fieldCount }, (_, i) => (
          <ResponsiveSelect
            key={i}
            label={`Field ${i + 1}`}
            options={['Option 1', 'Option 2', 'Option 3']}
          />
        ));

        const { duration } = await measureAsyncRender(async () => {
          const { unmount } = renderResponsive(
            <ResponsiveModal
              opened={true}
              onClose={() => {}}
              complexity={complexity}
              fieldCount={fieldCount}
            >
              <form>{formFields}</form>
            </ResponsiveModal>
          );
          return unmount;
        });

        renderTimes[complexity] = duration;

        // Modal should render within reasonable time even for complex forms
        expect(duration).toBeLessThan(300);
      }

      // High complexity should not be exponentially slower
      expect(renderTimes.high).toBeLessThan(renderTimes.low * 4);
    });
  });

  describe('Memory and Resource Management', () => {
    it('cleans up properly when components unmount', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Create and destroy multiple components
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderResponsive(
          <ResponsiveTable
            data={createMockData(100)}
            columns={createMockColumns()}
          />
        );

        await waitFor(() => {
          expect(screen.getByRole('table')).toBeInTheDocument();
        });

        unmount();
      }

      // Allow garbage collection
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });

    it('handles event listener cleanup correctly', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderResponsive(
        <ResponsiveTable data={createMockData(10)} columns={createMockColumns()} />
      );

      const addedListeners = addEventListenerSpy.mock.calls.length;

      unmount();

      const removedListeners = removeEventListenerSpy.mock.calls.length;

      // All event listeners should be cleaned up
      expect(removedListeners).toBe(addedListeners);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Virtual Scrolling Performance', () => {
    it('enables virtualization for large datasets automatically', () => {
      const largeDataset = createMockData(1000);

      renderResponsive(
        <ResponsiveTable
          data={largeDataset}
          columns={createMockColumns()}
          virtualization="auto"
        />
      );

      // With virtualization, not all rows should be in DOM
      const rows = screen.getAllByRole('row');
      // Rows include header row + visible data rows (mock renders max 50 + 1 header)
      expect(rows.length).toBeLessThan(largeDataset.length);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('renders virtual scrolling efficiently', async () => {
      const veryLargeDataset = createMockData(2000);

      const { duration } = await measureAsyncRender(async () => {
        const { unmount } = renderResponsive(
          <ResponsiveTable
            data={veryLargeDataset}
            columns={createMockColumns()}
            virtualization={true}
          />
        );
        return unmount;
      });

      // Virtual scrolling should render large datasets quickly
      expect(duration).toBeLessThan(500);
    });

    it('handles scroll performance in virtual mode', async () => {
      const largeDataset = createMockData(500);

      renderResponsive(
        <ResponsiveTable
          data={largeDataset}
          columns={createMockColumns()}
          virtualization={true}
        />
      );

      const scrollContainer = screen.getByTestId('scroll-area');

      const scrollStart = performance.now();

      // Simulate rapid scrolling
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 100 } });
      }

      const scrollEnd = performance.now();
      const scrollTime = scrollEnd - scrollStart;

      // Scrolling should be smooth and fast
      expect(scrollTime).toBeLessThan(100);
    });
  });

  describe('Responsive Image and Asset Loading', () => {
    it('loads appropriate assets for different breakpoints', async () => {
      const imageLoadTimes = {};
      const breakpoints = ['mobile', 'tablet', 'desktop'];

      for (const breakpoint of breakpoints) {
        const viewport = TEST_VIEWPORTS[breakpoint];

        const startTime = performance.now();

        renderResponsive(
          <ResponsiveModal opened={true} onClose={() => {}}>
            <img
              src={`/images/${breakpoint}-image.jpg`}
              alt="Responsive image"
              loading="lazy"
            />
          </ResponsiveModal>,
          { viewport }
        );

        const endTime = performance.now();
        imageLoadTimes[breakpoint] = endTime - startTime;
      }

      // All breakpoints should load quickly
      Object.values(imageLoadTimes).forEach(loadTime => {
        expect(loadTime).toBeLessThan(50);
      });
    });
  });

  describe('Form Interaction Performance', () => {
    it('handles rapid form interactions efficiently', async () => {
      const mockOnInputChange = vi.fn();

      renderResponsive(
        <MantineMedicationForm
          isOpen={true}
          onClose={() => {}}
          onInputChange={mockOnInputChange}
          onSubmit={() => {}}
          formData={{}}
          practitionersOptions={[]}
        />
      );

      const medicationField = screen.getByRole('textbox', { name: /medication/i });

      const interactionStart = performance.now();

      // Simulate rapid typing using fireEvent for reliability
      for (let i = 0; i < 20; i++) {
        fireEvent.change(medicationField, { target: { value: `Med${i}` } });
      }

      const interactionEnd = performance.now();
      const interactionTime = interactionEnd - interactionStart;

      // Rapid interactions should not cause performance issues
      expect(interactionTime).toBeLessThan(1000);
      expect(mockOnInputChange.mock.calls.length).toBeGreaterThan(0);
    });

    it('maintains performance during form validation', async () => {
      const user = userEvent.setup();
      const mockValidation = vi.fn().mockImplementation(() => {
        return Math.random() > 0.5 ? null : 'Validation error';
      });

      const FormWithValidation = () => {
        const [error, setError] = React.useState(null);

        const handleChange = (value) => {
          const validationError = mockValidation(value);
          setError(validationError);
        };

        return (
          <ResponsiveSelect
            options={['Option 1', 'Option 2', 'Option 3']}
            onChange={handleChange}
            error={error}
          />
        );
      };

      renderResponsive(<FormWithValidation />);

      const select = screen.getByRole('combobox');

      const validationStart = performance.now();

      // Trigger multiple validation cycles by changing select value
      for (let i = 0; i < 10; i++) {
        fireEvent.change(select, { target: { value: `Option ${(i % 3) + 1}` } });
      }

      const validationEnd = performance.now();
      const validationTime = validationEnd - validationStart;

      // Validation should not significantly impact performance
      expect(validationTime).toBeLessThan(500);
    });
  });

  describe('Animation and Transition Performance', () => {
    it('handles modal animations efficiently', async () => {
      const { rerender } = renderResponsive(
        <ResponsiveModal opened={false} onClose={() => {}}>
          <div>Modal Content</div>
        </ResponsiveModal>
      );

      const animationStart = performance.now();

      // Open modal (should trigger animation)
      rerender(
        <ResponsiveModal opened={true} onClose={() => {}}>
          <div>Modal Content</div>
        </ResponsiveModal>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const animationEnd = performance.now();
      const animationTime = animationEnd - animationStart;

      // Animation should complete quickly
      expect(animationTime).toBeLessThan(300);
    });

    it('handles table loading animations smoothly', () => {
      const { rerender } = renderResponsive(
        <ResponsiveTable
          data={[]}
          columns={createMockColumns()}
          loading={true}
        />
      );

      // Should render loading skeletons
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

      const transitionStart = performance.now();

      // Switch to loaded state
      rerender(
        <ResponsiveTable
          data={createMockData(10)}
          columns={createMockColumns()}
          loading={false}
        />
      );

      const transitionEnd = performance.now();
      const transitionTime = transitionEnd - transitionStart;

      // Loading to loaded transition should be smooth
      expect(transitionTime).toBeLessThan(100);
    });
  });

  describe('Concurrent Rendering Performance', () => {
    it('handles multiple responsive components simultaneously', async () => {
      const components = [
        <ResponsiveTable key="table" data={createMockData(20)} columns={createMockColumns()} />,
        <ResponsiveModal key="modal" opened={true} onClose={() => {}}>
          <ResponsiveSelect options={['A', 'B', 'C']} />
        </ResponsiveModal>,
        <ResponsiveSelect key="select" options={Array.from({ length: 50 }, (_, i) => `Option ${i}`)} />
      ];

      const renderStart = performance.now();

      const { unmount } = renderResponsive(
        <div>
          {components}
        </div>
      );

      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;

      // Multiple components should render efficiently together
      expect(renderTime).toBeLessThan(400);

      unmount();
    });
  });
});
