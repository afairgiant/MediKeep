import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FormLoadingOverlay from '../FormLoadingOverlay';

const renderOverlay = props =>
  render(
    <MantineProvider>
      <FormLoadingOverlay message="Saving injury..." {...props} />
    </MantineProvider>
  );

describe('FormLoadingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message at once by default', () => {
    renderOverlay({ visible: true });

    expect(screen.getByText('Saving injury...')).toBeInTheDocument();
  });

  describe('frosted variant', () => {
    it('shows the message only once the save has run for a while', () => {
      renderOverlay({ visible: true, variant: 'frosted' });
      expect(screen.queryByText('Saving injury...')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByText('Saving injury...')).toBeInTheDocument();
    });

    it('never shows the message for a save that ends sooner', () => {
      const { rerender } = renderOverlay({ visible: true, variant: 'frosted' });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      rerender(
        <MantineProvider>
          <FormLoadingOverlay message="Saving injury..." variant="frosted" />
        </MantineProvider>
      );
      rerender(
        <MantineProvider>
          <FormLoadingOverlay
            message="Saving injury..."
            variant="frosted"
            visible
          />
        </MantineProvider>
      );
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // The next save starts its own wait
      expect(screen.queryByText('Saving injury...')).not.toBeInTheDocument();
    });
  });
});
