import { describe, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { app } from '../server.js';

// Mock Supabase Auth via JWT
vi.mock('jsonwebtoken', () => ({
  verify: vi.fn((token, secret, callback) => {
    if (token === 'valid-token') {
      callback(null, { id: 'user-1' });
    } else {
      callback(new Error('Invalid token'));
    }
  }),
}));

// Mock PostgreSQL
const mockQuery = vi.fn();
vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    query: mockQuery,
  })),
}));

// Mock Express
const mockJson = vi.fn();
const mockStatus = vi.fn(() => ({ json: mockJson }));
const mockSend = vi.fn();

// Helper to mock request
function mockRequest(headers = {}, body = {}) {
  return {
    headers,
    body,
    user: { id: 'user-1' }
  };
}

function mockResponse() {
  return {
    status: mockStatus,
    json: mockJson,
    send: mockSend,
  };
}

describe('FitTrack API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without authorization header', () => {
      const req = { headers: {} };
      const res = mockResponse();
      const next = vi.fn();

      app._router.stack.find(r => r.name === 'authenticateToken').handle(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should reject requests with invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const res = mockResponse();
      const next = vi.fn();

      app._router.stack.find(r => r.name === 'authenticateToken').handle(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow requests with valid token', () => {
      const req = { headers: { authorization: 'Bearer valid-token' } };
      const res = mockResponse();
      const next = vi.fn();

      app._router.stack.find(r => r.name === 'authenticateToken').handle(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('GET /api/workouts', () => {
    it('should fetch user workouts with RLS', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'w1', type: 'Run', user_id: 'user-1' }] });

      const req = mockRequest({ authorization: 'Bearer valid-token' });
      const res = mockResponse();

      await app._router.stack.find(r => r.route?.path === '/api/workouts' && r.route?.methods.get).route.stack[0].handle(req, res);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM app_e2e1_workouts WHERE user_id = $1'),
        ['user-1']
      );
      expect(mockJson).toHaveBeenCalledWith([{ id: 'w1', type: 'Run', user_id: 'user-1' }]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const req = mockRequest({ authorization: 'Bearer valid-token' });
      const res = mockResponse();

      await app._router.stack.find(r => r.route?.path === '/api/workouts' && r.route?.methods.get).route.stack[0].handle(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('POST /api/workouts', () => {
    it('should create a new workout with valid data', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'w1', type: 'Run', duration: 30, user_id: 'user-1' }] });

      const req = mockRequest(
        { authorization: 'Bearer valid-token' },
        { type: 'Run', duration: 30 }
      );
      const res = mockResponse();

      await app._router.stack.find(r => r.route?.path === '/api/workouts' && r.route?.methods.post).route.stack[0].handle(req, res);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app_e2e1_workouts'),
        ['user-1', 'Run', 30, undefined, undefined]
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ type: 'Run' }));
    });

    it('should reject missing required fields', async () => {
      const req = mockRequest(
        { authorization: 'Bearer valid-token' },
        { type: '' }
      );
      const res = mockResponse();

      await app._router.stack.find(r => r.route?.path === '/api/workouts' && r.route?.methods.post).route.stack[0].handle(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Workout type and duration are required' });
    });
  });

  describe('GET /api/dashboard', () => {
    it('should return weekly stats', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_duration: 120, session_count: 4 }]
      });

      const req = mockRequest({ authorization: 'Bearer valid-token' });
      const res = mockResponse();

      await app._router.stack.find(r => r.route?.path === '/api/dashboard').route.stack[0].handle(req, res);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('NOW() - INTERVAL \'7 days\''), ['user-1']);
      expect(mockJson).toHaveBeenCalledWith({ total_duration: 120, session_count: 4, current_streak: 0 });
    });
  });
});