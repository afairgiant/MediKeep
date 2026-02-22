import { vi } from 'vitest';
import { apiService } from './index';
import { server } from '../../test-utils/mocks/server';
import { rest } from 'msw';

// Mock frontend logger
vi.mock('../frontendLogger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

// Mock secureStorage
vi.mock('../../utils/secureStorage', () => ({
  secureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  legacyMigration: {
    migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import mocked secureStorage
import { secureStorage } from '../../utils/secureStorage';

describe('API Service', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    // Set up secureStorage mock to return a token
    secureStorage.getItem.mockResolvedValue('mock-jwt-token');
  });

  describe('Authentication Methods', () => {
    test('login makes correct API call', async () => {
      const result = await apiService.login('testuser', 'password');

      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        token_type: 'bearer',
        user: expect.objectContaining({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        }),
      });
    });

    test('login handles invalid credentials', async () => {
      await expect(apiService.login('wronguser', 'wrongpassword')).rejects.toThrow();
    });

    test('localStorage can be cleared manually', () => {
      secureStorage.removeItem('token');
      secureStorage.getItem.mockResolvedValue(null);
      expect(secureStorage.removeItem).toHaveBeenCalledWith('token');
    });

    test('register creates new user account', async () => {
      const result = await apiService.register(
        'newuser',
        'password123',
        'newuser@example.com',
        'New User'
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          username: 'newuser',
          email: 'newuser@example.com',
          full_name: 'New User',
        })
      );
    });
  });

  describe('Patient Methods', () => {
    test('getCurrentPatient fetches patient data', async () => {
      const patient = await apiService.getCurrentPatient();

      expect(patient).toEqual(
        expect.objectContaining({
          id: 1,
          user_id: 1,
          first_name: 'John',
          last_name: 'Doe',
          birth_date: '1990-01-01',
        })
      );
    });

    test('updateCurrentPatient updates patient data', async () => {
      const updateData = {
        first_name: 'Jane',
        last_name: 'Smith',
        address: '456 New St',
      };

      const result = await apiService.updateCurrentPatient(updateData);

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          first_name: 'Jane',
          last_name: 'Smith',
          address: '456 New St',
        })
      );
    });

    test('createCurrentPatient creates new patient record', async () => {
      const patientData = {
        first_name: 'New',
        last_name: 'Patient',
        birth_date: '1995-01-01',
        gender: 'F',
        address: '789 Patient St',
      };

      const result = await apiService.createCurrentPatient(patientData);

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          first_name: 'New',
          last_name: 'Patient',
          birth_date: '1995-01-01',
        })
      );
    });
  });

  describe('Medical Records Methods', () => {
    test('getMedications fetches medication list', async () => {
      const medications = await apiService.getMedications();

      expect(Array.isArray(medications)).toBe(true);
      expect(medications[0]).toEqual(
        expect.objectContaining({
          id: 1,
          medication_name: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Daily',
        })
      );
    });

    test('getLabResults fetches lab results', async () => {
      const labResults = await apiService.getLabResults();

      expect(Array.isArray(labResults)).toBe(true);
      expect(labResults[0]).toEqual(
        expect.objectContaining({
          id: 1,
          test_name: 'Complete Blood Count',
          test_date: '2023-06-15',
          result: 'Normal',
        })
      );
    });

    test('getPractitioners fetches practitioner list', async () => {
      const practitioners = await apiService.getPractitioners();

      expect(Array.isArray(practitioners)).toBe(true);
      expect(practitioners[0]).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'Dr. John Smith',
          specialty: 'Family Medicine',
        })
      );
    });
  });

  describe('System Methods', () => {
    test('getRecentActivity fetches user activity', async () => {
      const activity = await apiService.getRecentActivity();

      expect(Array.isArray(activity)).toBe(true);
      expect(activity[0]).toEqual(
        expect.objectContaining({
          type: 'Medication',
          action: 'created',
          description: expect.stringContaining('Medication'),
        })
      );
    });

    test('getDashboardStats fetches dashboard statistics', async () => {
      const stats = await apiService.getDashboardStats();

      expect(stats).toEqual(
        expect.objectContaining({
          total_records: expect.any(Number),
          active_medications: expect.any(Number),
          recent_lab_results: expect.any(Number),
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('handles 401 unauthorized errors', async () => {
      // Override handler to return 401
      server.use(
        rest.get('*/api/v1/patients/me', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ detail: 'Unauthorized' }));
        })
      );

      await expect(apiService.getCurrentPatient()).rejects.toThrow('Unauthorized');
    });

    test('handles 500 server errors', async () => {
      // Override handler to return 500
      server.use(
        rest.get('*/api/v1/patients/recent-activity/', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ detail: 'Internal server error' }));
        })
      );

      await expect(apiService.getRecentActivity()).rejects.toThrow();
    });

    test('handles network errors', async () => {
      // Override handler to simulate network error
      server.use(
        rest.get('*/api/v1/patients/recent-activity/', (req, res, ctx) => {
          return res.networkError('Failed to connect');
        })
      );

      await expect(apiService.getRecentActivity()).rejects.toThrow();
    });

    test('handles requests without authentication token', async () => {
      // Clear token from secureStorage
      secureStorage.getItem.mockResolvedValue(null);

      await expect(apiService.getCurrentPatient()).rejects.toThrow('Not authenticated');
    });
  });

  describe('Request Headers', () => {
    test('includes authorization header when token is present', async () => {
      let capturedHeaders;
      
      // Capture request headers
      server.use(
        rest.get('*/api/v1/patients/me', (req, res, ctx) => {
          capturedHeaders = req.headers.get('Authorization');
          return res(ctx.status(200), ctx.json({}));
        })
      );

      await apiService.getCurrentPatient();

      expect(capturedHeaders).toBe('Bearer mock-jwt-token');
    });

    test('includes content-type header for POST requests', async () => {
      let capturedHeaders;
      
      server.use(
        rest.post('*/api/v1/medications', (req, res, ctx) => {
          capturedHeaders = req.headers.get('Content-Type');
          return res(ctx.status(201), ctx.json({}));
        })
      );

      await apiService.createMedication({
        medication_name: 'Test Med',
        dosage: '10mg',
        frequency: 'Daily',
      });

      expect(capturedHeaders).toContain('application/json');
    });
  });

  describe('Data Transformation', () => {
    test('correctly serializes request data', async () => {
      let capturedBody;
      
      server.use(
        rest.post('*/api/v1/medications', (req, res, ctx) => {
          capturedBody = req.body;
          return res(ctx.status(201), ctx.json({}));
        })
      );

      const medicationData = {
        medication_name: 'Test Medication',
        dosage: '10mg',
        frequency: 'Daily',
        start_date: '2023-01-01',
        notes: 'Test notes',
      };

      await apiService.createMedication(medicationData);

      expect(capturedBody).toEqual(medicationData);
    });

    test('handles empty response bodies', async () => {
      server.use(
        rest.delete('*/api/v1/medications/1', (req, res, ctx) => {
          return res(ctx.status(204)); // No content
        })
      );

      const result = await apiService.deleteMedication(1);
      expect(result).toBe(null);
    });
  });
});
