import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

vi.mock('../AdminSidebar.css', () => ({}));

import AdminSidebar from '../AdminSidebar';

const renderSidebar = (props = {}) =>
  render(
    <MantineProvider>
      <MemoryRouter>
        <AdminSidebar
          isOpen
          currentPath="/admin"
          onToggle={vi.fn()}
          {...props}
        />
      </MemoryRouter>
    </MantineProvider>
  );

describe('AdminSidebar', () => {
  test('open sidebar dashboard link points to /dashboard and closes the sidebar', () => {
    const onToggle = vi.fn();
    renderSidebar({ onToggle });

    const link = screen.getByRole('link', { name: 'Return to Dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');

    fireEvent.click(link);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('collapsed sidebar still links back to the user dashboard', () => {
    renderSidebar({ isOpen: false });

    const link = screen.getByRole('link', { name: 'Return to Dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  test('dashboard link is not marked as the current admin page', () => {
    renderSidebar();

    const link = screen.getByRole('link', { name: 'Return to Dashboard' });
    expect(link).not.toHaveAttribute('aria-current');
  });
});
