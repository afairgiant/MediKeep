import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../AdminHeader.css', () => ({}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

import AdminHeader from '../AdminHeader';

const renderAdminHeader = (props = {}) => {
  return render(
    <MemoryRouter>
      <AdminHeader {...props} />
    </MemoryRouter>
  );
};

describe('AdminHeader', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('renders without crashing and shows title', () => {
    renderAdminHeader();

    expect(screen.getByText('Medical Records Admin')).toBeInTheDocument();
  });

  test('Dashboard button calls navigate with /admin', () => {
    renderAdminHeader();

    const dashboardBtn = screen.getByTitle('Return to Admin Dashboard');
    fireEvent.click(dashboardBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin');
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('http'));
  });

  test('Home button calls navigate with /dashboard', () => {
    renderAdminHeader();

    const homeBtn = screen.getByTitle('Return to Normal Dashboard');
    fireEvent.click(homeBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('http'));
  });

  test('pressing Enter in search input navigates to /admin/data-models with encoded query', () => {
    renderAdminHeader();

    const searchInput = screen.getByRole('textbox', { name: 'Search data models' });
    fireEvent.change(searchInput, { target: { value: 'users' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/admin/data-models?q=users');
  });

  test('clicking the search button navigates to /admin/data-models with encoded query', () => {
    renderAdminHeader();

    const searchInput = screen.getByRole('textbox', { name: 'Search data models' });
    fireEvent.change(searchInput, { target: { value: 'medications' } });

    const searchBtn = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/data-models?q=medications');
  });

  test('empty search query does not trigger navigation', () => {
    renderAdminHeader();

    const searchInput = screen.getByRole('textbox', { name: 'Search data models' });
    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('whitespace-only search query does not trigger navigation', () => {
    renderAdminHeader();

    const searchInput = screen.getByRole('textbox', { name: 'Search data models' });
    fireEvent.change(searchInput, { target: { value: '   ' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('search input is cleared after a successful navigation', () => {
    renderAdminHeader();

    const searchInput = screen.getByRole('textbox', { name: 'Search data models' });
    fireEvent.change(searchInput, { target: { value: 'labs' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(searchInput.value).toBe('');
  });

  test('displays the username from the user prop', () => {
    renderAdminHeader({ user: { username: 'dr_smith' } });

    expect(screen.getByText('dr_smith')).toBeInTheDocument();
  });

  test('displays "Administrator" as fallback when no user prop is provided', () => {
    renderAdminHeader();

    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  test('displays "Administrator" as fallback when user prop has no username', () => {
    renderAdminHeader({ user: {} });

    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  test('sidebar toggle button calls onToggleSidebar when provided', () => {
    const onToggleSidebar = vi.fn();
    renderAdminHeader({ onToggleSidebar });

    const sidebarToggleBtn = screen.getByRole('button', { name: /☰/i });
    fireEvent.click(sidebarToggleBtn);

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  test('sidebar toggle button does not throw when onToggleSidebar is not provided', () => {
    renderAdminHeader();

    const sidebarToggleBtn = screen.getByRole('button', { name: /☰/i });
    expect(() => fireEvent.click(sidebarToggleBtn)).not.toThrow();
  });

  test('logout button calls onLogout when provided', () => {
    const onLogout = vi.fn();
    renderAdminHeader({ onLogout });

    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutBtn);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  test('logout button does not throw when onLogout is not provided', () => {
    renderAdminHeader();

    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    expect(() => fireEvent.click(logoutBtn)).not.toThrow();
  });

  test('search query with special characters is URL-encoded in navigation path', () => {
    renderAdminHeader();

    const searchInput = screen.getByRole('textbox', { name: 'Search data models' });
    fireEvent.change(searchInput, { target: { value: 'blood & iron' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith(
      '/admin/data-models?q=blood%20%26%20iron'
    );
  });

  test('non-Enter keys in search input do not trigger navigation', () => {
    renderAdminHeader();

    const searchInput = screen.getByRole('textbox', { name: 'Search data models' });
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.keyDown(searchInput, { key: 'Tab' });
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    fireEvent.keyDown(searchInput, { key: 'Space' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
