import { vi, describe, test, expect, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import render from '../../../test-utils/render';
import UserRegistrationForm from '../UserRegistrationForm';

// Mock dependencies
vi.mock('../../../services/auth/simpleAuthService', () => ({
  authService: {
    register: vi.fn(),
  },
}));

vi.mock('../../../services/api/adminApi', () => ({
  adminApiService: {
    searchAllPatients: vi.fn(),
    createUserWithPatientLink: vi.fn(),
  },
  default: {
    searchAllPatients: vi.fn(),
    createUserWithPatientLink: vi.fn(),
  },
}));

vi.mock('../../../services/frontendLogger', () => ({
  default: {
    logError: vi.fn(),
    logInfo: vi.fn(),
  },
}));

vi.mock('../../../utils/notifyTranslated', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

import { authService } from '../../../services/auth/simpleAuthService';
import { adminApiService } from '../../../services/api/adminApi';

// Helper to fill the form using input IDs
function fillForm(overrides = {}) {
  const defaults = {
    username: 'testuser',
    password: 'password1',
    email: 'test@test.com',
    firstName: 'Test',
    lastName: 'User',
  };
  const values = { ...defaults, ...overrides };

  fireEvent.change(document.getElementById('username'), { target: { name: 'username', value: values.username } });
  fireEvent.change(document.getElementById('password'), { target: { name: 'password', value: values.password } });
  fireEvent.change(document.getElementById('email'), { target: { name: 'email', value: values.email } });
  fireEvent.change(document.getElementById('firstName'), { target: { name: 'firstName', value: values.firstName } });
  fireEvent.change(document.getElementById('lastName'), { target: { name: 'lastName', value: values.lastName } });
}

describe('UserRegistrationForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    test('renders form fields', () => {
      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      expect(document.getElementById('username')).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(document.getElementById('email')).toBeInTheDocument();
      expect(document.getElementById('firstName')).toBeInTheDocument();
      expect(document.getElementById('lastName')).toBeInTheDocument();
    });

    test('does not show role field when not admin context', () => {
      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={false} />
      );

      expect(document.getElementById('role')).not.toBeInTheDocument();
    });

    test('shows role field in admin context', () => {
      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      expect(document.getElementById('role')).toBeInTheDocument();
    });
  });

  describe('Patient linking UI (admin context)', () => {
    test('shows link checkbox only in admin context', () => {
      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      expect(screen.getByText(/Link to existing patient record/i)).toBeInTheDocument();
    });

    test('does not show link checkbox when not admin context', () => {
      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={false} />
      );

      expect(screen.queryByText(/Link to existing patient record/i)).not.toBeInTheDocument();
    });

    test('shows patient dropdown when checkbox is checked', async () => {
      adminApiService.searchAllPatients.mockResolvedValueOnce({
        patients: [],
        total_count: 0,
      });

      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      const checkbox = document.getElementById('linkExistingPatient');
      fireEvent.click(checkbox);

      // The Select component should appear (Mantine renders a combobox input)
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/loading patients|select a patient/i)).toBeInTheDocument();
      });
    });

    test('hides patient dropdown when checkbox is unchecked', async () => {
      adminApiService.searchAllPatients.mockResolvedValueOnce({
        patients: [],
        total_count: 0,
      });

      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      const checkbox = document.getElementById('linkExistingPatient');

      // Check
      fireEvent.click(checkbox);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/loading patients|select a patient/i)).toBeInTheDocument();
      });

      // Uncheck
      fireEvent.click(checkbox);
      expect(screen.queryByPlaceholderText(/select a patient/i)).not.toBeInTheDocument();
    });

    test('loads patients when checkbox is toggled on', async () => {
      adminApiService.searchAllPatients.mockResolvedValueOnce({
        patients: [
          {
            id: 1,
            first_name: 'Alice',
            last_name: 'Smith',
            birth_date: '1995-06-15',
            is_self_record: false,
            owner_username: 'parentuser',
            owner_full_name: 'Parent User',
          },
        ],
        total_count: 1,
      });

      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      fireEvent.click(document.getElementById('linkExistingPatient'));

      await waitFor(() => {
        expect(adminApiService.searchAllPatients).toHaveBeenCalled();
      });
    });

    test('shows self-record warning when self-record patient is selected', async () => {
      adminApiService.searchAllPatients.mockResolvedValueOnce({
        patients: [
          {
            id: 10,
            first_name: 'Self',
            last_name: 'Record',
            birth_date: '1990-01-01',
            is_self_record: true,
            owner_username: 'parentuser',
            owner_full_name: 'Parent User',
          },
        ],
        total_count: 1,
      });

      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      fireEvent.click(document.getElementById('linkExistingPatient'));

      // Wait for patients to load
      await waitFor(() => {
        expect(adminApiService.searchAllPatients).toHaveBeenCalled();
      });

      // Wait for loading to complete and find the select input
      const selectInput = await screen.findByPlaceholderText(/select a patient/i);
      fireEvent.click(selectInput);

      await waitFor(() => {
        const option = screen.getByText(/Self Record.*Self-Record/);
        fireEvent.click(option);
      });

      await waitFor(() => {
        expect(screen.getByText(/current owner's self-record/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form submission routing', () => {
    test('admin context with link uses admin API with link_patient_id', async () => {
      adminApiService.searchAllPatients.mockResolvedValueOnce({
        patients: [
          {
            id: 42,
            first_name: 'Child',
            last_name: 'Patient',
            birth_date: '2012-03-10',
            is_self_record: false,
            owner_username: 'parentuser',
            owner_full_name: 'Parent User',
          },
        ],
        total_count: 1,
      });

      adminApiService.createUserWithPatientLink.mockResolvedValueOnce({
        status: 'success',
        message: 'User created and linked',
        data: {
          user_id: 5,
          username: 'childuser',
          linked_patient_id: 42,
        },
      });

      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      fillForm({ username: 'childuser', email: 'child@test.com', firstName: 'Child', lastName: 'User' });

      // Enable linking and wait for patients to load
      fireEvent.click(document.getElementById('linkExistingPatient'));

      await waitFor(() => {
        expect(adminApiService.searchAllPatients).toHaveBeenCalled();
      });

      // Wait for loading to complete, open dropdown and select patient
      const selectInput = await screen.findByPlaceholderText(/select a patient/i);
      fireEvent.click(selectInput);

      await waitFor(() => {
        const option = screen.getByText(/Child Patient/);
        fireEvent.click(option);
      });

      // Submit
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => {
        expect(adminApiService.createUserWithPatientLink).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'childuser',
            link_patient_id: 42,
          })
        );
      });
    });

    test('admin context without link still uses admin API', async () => {
      adminApiService.createUserWithPatientLink.mockResolvedValueOnce({
        status: 'success',
        message: 'User created',
        data: {
          user_id: 6,
          username: 'regularuser',
          linked_patient_id: null,
        },
      });

      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={true} />
      );

      fillForm({ username: 'regularuser', email: 'reg@test.com', firstName: 'Regular', lastName: 'User' });

      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => {
        expect(adminApiService.createUserWithPatientLink).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'regularuser',
          })
        );
      });
    });

    test('non-admin context uses authService.register', async () => {
      authService.register.mockResolvedValueOnce({
        success: true,
        data: { id: 7, username: 'normaluser' },
      });

      render(
        <UserRegistrationForm onSuccess={mockOnSuccess} isAdminContext={false} />
      );

      fillForm({ username: 'normaluser', email: 'normal@test.com', firstName: 'Normal', lastName: 'User' });

      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => {
        expect(authService.register).toHaveBeenCalled();
        expect(adminApiService.createUserWithPatientLink).not.toHaveBeenCalled();
      });
    });
  });
});
