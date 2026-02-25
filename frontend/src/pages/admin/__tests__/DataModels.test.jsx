import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

// ─── CSS mock ────────────────────────────────────────────────────────────────

vi.mock('../DataModels.css', () => ({}));

// ─── Router mock ─────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

// ─── AdminLayout mock ─────────────────────────────────────────────────────────

vi.mock('../../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

// ─── ThemeContext mock ────────────────────────────────────────────────────────

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  MantineIntegratedThemeProvider: ({ children }) => children,
}));

// ─── adminApiService mock ───────────────────────────────────────────────────

vi.mock('../../../services/api/adminApi', () => ({
  adminApiService: {
    getAvailableModels: vi.fn().mockRejectedValue(new Error('No server')),
  },
}));

// ─── Logger mock ────────────────────────────────────────────────────────────

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Component under test (imported after mocks) ─────────────────────────────

import DataModels from '../DataModels';

// ─── Render helper ────────────────────────────────────────────────────────────

const renderComponent = async (searchParams = '') => {
  const result = render(
    <MemoryRouter initialEntries={[`/admin/data-models${searchParams}`]}>
      <MantineProvider>
        <DataModels />
      </MantineProvider>
    </MemoryRouter>
  );
  // Wait for async fallback to complete (API rejects, fallback models load)
  // The yellow alert only appears after loading finishes with an error + fallback
  await waitFor(() => {
    expect(screen.getByText(/Could not load models/)).toBeInTheDocument();
  });
  return result;
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DataModels', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // 1. Renders all models by default
  describe('renders all models by default', () => {
    test('renders inside AdminLayout', async () => {
      await renderComponent();
      expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    });

    test('shows the page title', async () => {
      await renderComponent();
      expect(screen.getByText('Data Models')).toBeInTheDocument();
    });

    test('shows the filter input with no initial value', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('');
    });

    test('renders Users model card', async () => {
      await renderComponent();
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    test('renders Patients model card', async () => {
      await renderComponent();
      expect(screen.getByText('Patients')).toBeInTheDocument();
    });

    test('renders Medications model card', async () => {
      await renderComponent();
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    test('renders all eight category headers', async () => {
      await renderComponent();
      const expectedCategories = [
        'System',
        'Core Medical',
        'Healthcare Directory',
        'Medical Records',
        'Patient Support',
        'Family History',
        'File Management',
        'Sharing & Access',
      ];
      expectedCategories.forEach(category => {
        expect(screen.getAllByText(category).length).toBeGreaterThanOrEqual(1);
      });
    });

    test('does not show the clear button when filter is empty', async () => {
      await renderComponent();
      expect(screen.queryByLabelText('Clear filter')).not.toBeInTheDocument();
    });
  });

  // 2. URL ?q= param pre-fills filter
  describe('URL search param pre-fills filter', () => {
    test('filter input value matches the ?q= param', async () => {
      await renderComponent('?q=user');
      const input = screen.getByLabelText('Filter data models');
      expect(input.value).toBe('user');
    });

    test('Users model card is visible when ?q=user', async () => {
      await renderComponent('?q=user');
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    test('Medications card is not visible when ?q=user (no match)', async () => {
      await renderComponent('?q=user');
      expect(screen.queryByText('Medications')).not.toBeInTheDocument();
    });

    test('Lab Results card is not visible when ?q=user (no match)', async () => {
      await renderComponent('?q=user');
      expect(screen.queryByText('Lab Results')).not.toBeInTheDocument();
    });

    test('clear button is visible when filter is pre-filled via URL', async () => {
      await renderComponent('?q=user');
      expect(screen.getByLabelText('Clear filter')).toBeInTheDocument();
    });
  });

  // 3. Typing filters models
  describe('typing in filter input filters models', () => {
    test('Medications card appears when typing "medication"', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'medication' } });
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    test('Users card is hidden when typing "medication"', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'medication' } });
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
    });

    test('Patients card is hidden when typing "medication"', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'medication' } });
      expect(screen.queryByText('Patients')).not.toBeInTheDocument();
    });

    test('filter is case-insensitive', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'MEDICATION' } });
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    test('clear button appears once user types into filter', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'lab' } });
      expect(screen.getByLabelText('Clear filter')).toBeInTheDocument();
    });

    test('matches on model description text', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'dosages' } });
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    test('matches on model name (snake_case internal name)', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'lab_result' } });
      expect(screen.getByText('Lab Results')).toBeInTheDocument();
    });

    test('matches on category name', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'patient support' } });
      expect(screen.getByText('Emergency Contacts')).toBeInTheDocument();
      expect(screen.getByText('Insurance')).toBeInTheDocument();
    });
  });

  // 4. Empty categories are hidden when filter is applied
  describe('empty categories are hidden when filter excludes all their models', () => {
    test('System category is visible when filtering for "user"', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'user' } });
      expect(screen.getAllByText('System').length).toBeGreaterThanOrEqual(1);
    });

    test('Medical Records category header is absent when filtering for "user"', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'user' } });
      expect(screen.queryByText('Medical Records')).not.toBeInTheDocument();
    });

    test('File Management category header is absent when filtering for "user"', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'user' } });
      expect(screen.queryByText('File Management')).not.toBeInTheDocument();
    });

    test('Core Medical category header is absent when filtering for "medication"', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'medication' } });
      expect(screen.queryByText('Core Medical')).not.toBeInTheDocument();
    });
  });

  // 5. Clear button resets filter
  describe('clear button resets the filter', () => {
    test('clicking clear restores filter input to empty string', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'user' } });
      expect(input.value).toBe('user');

      const clearBtn = screen.getByLabelText('Clear filter');
      fireEvent.click(clearBtn);

      expect(input.value).toBe('');
    });

    test('clicking clear makes all model cards reappear', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'user' } });

      const clearBtn = screen.getByLabelText('Clear filter');
      fireEvent.click(clearBtn);

      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(screen.getByText('Patients')).toBeInTheDocument();
    });

    test('clicking clear hides the clear button itself', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'user' } });

      const clearBtn = screen.getByLabelText('Clear filter');
      fireEvent.click(clearBtn);

      expect(screen.queryByLabelText('Clear filter')).not.toBeInTheDocument();
    });

    test('clicking clear restores all category headers', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'user' } });

      fireEvent.click(screen.getByLabelText('Clear filter'));

      expect(screen.getAllByText('Medical Records').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('File Management').length).toBeGreaterThanOrEqual(1);
    });
  });

  // 6. No models match shows empty-state message
  describe('empty state when no models match filter', () => {
    test('shows "No models match" message for a nonsense query', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'xyznonexistent' } });
      expect(screen.getByText(/No models match/)).toBeInTheDocument();
    });

    test('the "no match" message includes the search query', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'xyznonexistent' } });
      expect(screen.getByText(/xyznonexistent/)).toBeInTheDocument();
    });

    test('no category headers are rendered when no models match', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'xyznonexistent' } });
      expect(screen.queryByText('System')).not.toBeInTheDocument();
      expect(screen.queryByText('Medical Records')).not.toBeInTheDocument();
    });

    test('recovering from empty state by clearing shows all models again', async () => {
      await renderComponent();
      const input = screen.getByLabelText('Filter data models');
      fireEvent.change(input, { target: { value: 'xyznonexistent' } });
      expect(screen.getByText(/No models match/)).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Clear filter'));

      expect(screen.queryByText(/No models match/)).not.toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
    });
  });

  // 7. Model card click navigates
  describe('model card click navigates to the model route', () => {
    test('clicking the Users card navigates to /admin/models/user', async () => {
      await renderComponent();
      fireEvent.click(screen.getByText('Users'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/user');
    });

    test('clicking the Medications card navigates to /admin/models/medication', async () => {
      await renderComponent();
      fireEvent.click(screen.getByText('Medications'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/medication');
    });

    test('clicking the Patients card navigates to /admin/models/patient', async () => {
      await renderComponent();
      fireEvent.click(screen.getByText('Patients'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/patient');
    });

    test('clicking the Lab Results card navigates to /admin/models/lab_result', async () => {
      await renderComponent();
      fireEvent.click(screen.getByText('Lab Results'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/lab_result');
    });

    test('clicking the Emergency Contacts card navigates to /admin/models/emergency_contact', async () => {
      await renderComponent();
      fireEvent.click(screen.getByText('Emergency Contacts'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin/models/emergency_contact');
    });

    test('navigate is not called before any card is clicked', async () => {
      await renderComponent();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
