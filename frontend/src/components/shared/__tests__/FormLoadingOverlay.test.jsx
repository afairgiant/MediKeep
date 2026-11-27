import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FormLoadingOverlay from '../FormLoadingOverlay';

const overlay = props => (
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

  it('shows the message only once the save has run for a while', () => {
    render(overlay({ visible: true }));
    expect(screen.queryByText('Saving injury...')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText('Saving injury...')).toBeInTheDocument();
  });

  it('never shows the message for a save that ends sooner', () => {
    const { rerender } = render(overlay({ visible: true }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender(overlay({ visible: false }));
    rerender(overlay({ visible: true }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The next save starts its own wait
    expect(screen.queryByText('Saving injury...')).not.toBeInTheDocument();
  });

  it('renders nothing when not visible', () => {
    const { container } = render(overlay({ visible: false }));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText('Saving injury...')).not.toBeInTheDocument();
    expect(container.querySelector('.mantine-Overlay-root')).toBeNull();
  });
});
