import { rest } from 'msw';
import { getApiUrl } from '../../config/env';

const API_BASE = getApiUrl();

export const handlers = [
  // Authentication endpoints
  rest.post(`${API_BASE}/auth/login/`, (req, res, ctx) => {
    // Handle different body types in MSW v1
    let username, password;
    
    if (req.body && typeof req.body === 'string') {
      // URLSearchParams as string
      const params = new URLSearchParams(req.body);
      username = params.get('username');
      password = params.get('password');
    } else if (req.body && req.body.get) {
      // URLSearchParams object
      username = req.body.get('username');
      password = req.body.get('password');
    } else if (req.body) {
      // JSON object
      username = req.body.username;
      password = req.body.password;
    }
    
    if (username === 'testuser' && password === 'password') {
      return res(
        ctx.json({
          access_token: 'mock-jwt-token',
          token_type: 'bearer',
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            full_name: 'Test User',
            role: 'user',
          },
        })
      );
    }

    return res(
      ctx.status(401),
      ctx.json({ detail: 'Invalid credentials' })
    );
  }),

  rest.post(`${API_BASE}/auth/register/`, (req, res, ctx) => {
    const { username, email, password, full_name } = req.body;
    
    return res(
      ctx.status(201),
      ctx.json({
        id: 2,
        username,
        email,
        full_name,
        role: 'user',
        created_at: new Date().toISOString(),
      })
    );
  }),

  rest.post(`${API_BASE}/auth/logout`, (req, res, ctx) => {
    return res(ctx.json({ message: 'Logged out successfully' }));
  }),

  // Patient endpoints
  rest.get(`${API_BASE}/patients/me`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.includes('Bearer')) {
      return res(
        ctx.status(401),
        ctx.json({ detail: 'Not authenticated' })
      );
    }

    return res(
      ctx.json({
        id: 1,
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        birth_date: '1990-01-01',
        gender: 'M',
        address: '123 Main St',
        blood_type: 'A+',
        height: 70,
        weight: 180,
        physician_id: null,
        created_at: '2023-01-01T00:00:00',
        updated_at: '2023-01-01T00:00:00',
      })
    );
  }),

  rest.put(`${API_BASE}/patients/me`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.includes('Bearer')) {
      return res(
        ctx.status(401),
        ctx.json({ detail: 'Not authenticated' })
      );
    }

    const updatedData = req.body;
    
    return res(
      ctx.json({
        id: 1,
        user_id: 1,
        ...updatedData,
        updated_at: new Date().toISOString(),
      })
    );
  }),

  rest.post(`${API_BASE}/patients/me`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.includes('Bearer')) {
      return res(
        ctx.status(401),
        ctx.json({ detail: 'Not authenticated' })
      );
    }

    const patientData = req.body;
    
    return res(
      ctx.status(201),
      ctx.json({
        id: 1,
        user_id: 1,
        ...patientData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );
  }),

  // Practitioners endpoints
  rest.get(`${API_BASE}/practitioners/`, (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          name: 'Dr. John Smith',
          specialty: 'Family Medicine',
          phone_number: '555-0123',
          email: 'dr.smith@example.com',
          address: '456 Medical Center Dr',
          website: 'https://drsmith.com',
          rating: 4.8,
          status: 'active',
        },
        {
          id: 2,
          name: 'Dr. Jane Wilson',
          specialty: 'Cardiology',
          phone_number: '555-0456',
          email: 'dr.wilson@example.com',
          address: '789 Heart Center Ave',
          website: 'https://drwilson.com',
          rating: 4.9,
          status: 'active',
        },
      ])
    );
  }),

  // Medications endpoints
  rest.get(`${API_BASE}/medications/`, (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          patient_id: 1,
          medication_name: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Daily',
          start_date: '2023-01-01',
          end_date: null,
          prescribing_doctor: 'Dr. John Smith',
          notes: 'For blood pressure',
          status: 'active',
          created_at: '2023-01-01T00:00:00',
          updated_at: '2023-01-01T00:00:00',
        },
      ])
    );
  }),

  rest.post(`${API_BASE}/medications/`, (req, res, ctx) => {
    const medicationData = req.body;
    
    return res(
      ctx.status(201),
      ctx.json({
        id: 2,
        patient_id: 1,
        ...medicationData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );
  }),

  rest.delete(`${API_BASE}/medications/1`, (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  // Lab results endpoints
  rest.get(`${API_BASE}/lab-results/`, (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          patient_id: 1,
          test_name: 'Complete Blood Count',
          test_date: '2023-06-15',
          result: 'Normal',
          reference_range: 'Within normal limits',
          ordering_doctor: 'Dr. John Smith',
          lab_name: 'LabCorp',
          notes: 'All values normal',
          status: 'completed',
          created_at: '2023-06-15T00:00:00',
          updated_at: '2023-06-15T00:00:00',
        },
      ])
    );
  }),

  // System endpoints
  rest.get(`${API_BASE}/system/health`, (req, res, ctx) => {
    return res(
      ctx.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.11.0',
        database: 'connected',
      })
    );
  }),

  rest.get(`${API_BASE}/system/version`, (req, res, ctx) => {
    return res(
      ctx.json({
        app_name: 'Medical Records Management System',
        version: '0.11.0',
        build_date: '2023-12-01',
      })
    );
  }),

  // Frontend logs endpoint
  rest.post(`${API_BASE}/frontend-logs`, (req, res, ctx) => {
    return res(ctx.json({ status: 'logged' }));
  }),

  // Frontend logs endpoint (alternative path)
  rest.post(`${API_BASE}/frontend-logs/log`, (req, res, ctx) => {
    return res(ctx.json({ status: 'logged' }));
  }),

  // Recent activity endpoint
  rest.get(`${API_BASE}/patients/recent-activity/`, (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          type: 'Medication',
          action: 'created',
          description: 'Created Medication: Lisinopril',
          timestamp: '2023-12-01T10:00:00',
        },
        {
          id: 2,
          type: 'Lab Result',
          action: 'created',
          description: 'Created Lab Result: Complete Blood Count',
          timestamp: '2023-12-01T09:00:00',
        },
      ])
    );
  }),

  // Dashboard stats endpoint
  rest.get(`${API_BASE}/patients/me/dashboard-stats`, (req, res, ctx) => {
    return res(
      ctx.json({
        total_records: 25,
        active_medications: 3,
        recent_lab_results: 2,
        upcoming_appointments: 1,
        total_practitioners: 5,
      })
    );
  }),

  // Registration status endpoint
  rest.get(`${API_BASE}/auth/registration-status`, (req, res, ctx) => {
    return res(ctx.json({ registration_open: true }));
  }),

  // SSO config endpoint
  rest.get(`${API_BASE}/auth/sso/config`, (req, res, ctx) => {
    return res(ctx.json({ enabled: false }));
  }),

  // Tags suggestions endpoint
  rest.get(`${API_BASE}/tags/suggestions`, (req, res, ctx) => {
    return res(ctx.json([]));
  }),

  // Error simulation handlers
  rest.get(`${API_BASE}/test/error`, (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ detail: 'Internal server error' })
    );
  }),

  rest.get(`${API_BASE}/test/unauthorized`, (req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({ detail: 'Unauthorized' })
    );
  }),
];