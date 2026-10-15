import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

vi.mock('../ModelEdit.css', () => ({}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('../../../components/forms/UserRegistrationForm', () => ({
  default: ({ onSuccess, onCancel }) => (
    <div>
      <button
        onClick={() =>
          onSuccess({ formData: { username: 'newuser' }, userData: {} })
        }
      >
        stub-submit
      </button>
      <button onClick={onCancel}>stub-cancel</button>
    </div>
  ),
}));

import AdminUserCreate from '../AdminUserCreate';

function renderPage(locationState) {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/admin/create-user', state: locationState },
      ]}
    >
      <MantineProvider>
        <AdminUserCreate />
      </MantineProvider>
    </MemoryRouter>
  );
}

describe('AdminUserCreate return path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each(['/admin/users', '/admin/models/user'])(
    'returns to %s on cancel when opened from there',
    from => {
      renderPage({ from });
      fireEvent.click(screen.getByText('stub-cancel'));
      expect(mockNavigate).toHaveBeenCalledWith(from);
    }
  );

  test.each(['/admin/users', '/admin/models/user'])(
    'returns to %s on success when opened from there',
    from => {
      renderPage({ from });
      fireEvent.click(screen.getByText('stub-submit'));
      expect(mockNavigate).toHaveBeenCalledWith(
        from,
        expect.objectContaining({ state: expect.any(Object) })
      );
    }
  );

  test('falls back to /admin when opened without state', () => {
    renderPage(undefined);
    fireEvent.click(screen.getByText('stub-cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin');

    fireEvent.click(screen.getByText('stub-submit'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/admin', expect.any(Object));
  });

  test.each(['/somewhere/else', 'https://example.com', 42, null])(
    'falls back to /admin for unrecognised origin %p',
    from => {
      renderPage({ from });
      fireEvent.click(screen.getByText('stub-cancel'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    }
  );
});
