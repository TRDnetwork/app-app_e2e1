import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupRealtime, teardownRealtime } from '../realtime.js';

// Mock Supabase globally
global.window.__SUPABASE_URL__ = 'https://mock.supabase.co';
global.window.__SUPABASE_ANON_KEY__ = 'mock-anon-key';

// Mock DOM
document.body.innerHTML = `
  <div id="loading">Loading...</div>
  <div id="app" hidden>
    <button id="signOut"></button>
    <form id="workoutForm">
      <input id="type" />
      <input id="duration" />
      <select id="intensity"></select>
      <textarea id="notes"></textarea>
      <div id="formError" hidden></div>
    </form>
    <ul id="workoutList"></ul>
    <div id="emptyState"></div>
    <span id="workoutCount"></span>
    <span id="totalDuration"></span>
    <span id="streak"></span>
  </div>
`;

// Mock fetch
global.fetch = vi.fn();

// Mock Supabase auth response
const mockSession = {
  data: { session: { access_token: 'mock-token', user: { id: 'user-1' } } },
  error: null,
};

const mockUser = {
  data: { user: { id: 'user-1', email: 'test@example.com' } },
  error: null,
};

// Mock createClient
vi.mock('https://esm.sh/@supabase/supabase-js@2', async () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn(() => mockSession),
        getUser: vi.fn(() => mockUser),
        signInWithPassword: vi.fn(() => ({ error: null })),
        signUp: vi.fn(() => ({ error: null })),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
    })),
  };
});

// Re-import app.js after mocks
vi.mock('../realtime.js', () => ({
  setupRealtime: vi.fn(),
  teardownRealtime: vi.fn(),
}));

// Need to dynamically import to apply mocks
let init;
beforeEach(async () => {
  vi.clearAllMocks();
  global.fetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue([]),
  });

  const module = await import('../app.js');
  init = module.init;
});

describe('FitTrack Frontend', () => {
  it('should initialize and show loading state initially', async () => {
    await init();
    expect(document.getElementById('loading').hidden).toBe(true);
    expect(document.getElementById('app').hidden).toBe(false);
  });

  it('should render auth gate when no session', async () => {
    mockSession.data.session = null;
    await init();
    expect(document.querySelector('.auth-container')).not.toBeNull();
  });

  it('should render dashboard when authenticated', async () => {
    await init();
    expect(document.getElementById('workoutForm')).not.toBeNull();
    expect(document.getElementById('workoutList')).not.toBeNull();
  });

  it('should submit workout form and call API', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'w1', type: 'Run', duration: 30 }),
    });

    await init();
    document.getElementById('type').value = 'Run';
    document.getElementById('duration').value = 30;
    const form = document.getElementById('workoutForm');
    form.dispatchEvent(new Event('submit'));

    expect(global.fetch).toHaveBeenCalledWith('/api/workouts', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Authorization': 'Bearer mock-token'
      })
    }));
  });

  it('should display error on failed workout submission', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: 'Invalid duration' }),
    });

    await init();
    document.getElementById('type').value = 'Run';
    document.getElementById('duration').value = -10;
    const form = document.getElementById('workoutForm');
    form.dispatchEvent(new Event('submit'));

    expect(document.getElementById('formError').textContent).toBe('Failed to save workout');
    expect(document.getElementById('formError').hidden).toBe(false);
  });

  it('should update dashboard stats correctly', async () => {
    const workouts = [
      { type: 'Run', duration: 30, created_at: new Date().toISOString() },
      { type: 'Cycle', duration: 60, created_at: new Date().toISOString() },
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(workouts),
    });

    await init();
    await global.loadWorkouts();

    expect(document.getElementById('workoutCount').textContent).toBe('2');
    expect(document.getElementById('totalDuration').textContent).toBe('90');
  });

  it('should calculate streak correctly', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const workouts = [
      { created_at: today.toISOString() },
      { created_at: yesterday.toISOString() },
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(workouts),
    });

    await init();
    await global.loadWorkouts();

    expect(document.getElementById('streak').textContent).toBe('2');
  });

  it('should set up realtime subscriptions on init', async () => {
    await init();
    expect(setupRealtime).toHaveBeenCalled();
  });

  it('should handle sign out', async () => {
    const signOutSpy = vi.spyOn((await import('../app.js')).supabase, 'then')
      .mockImplementation((fn) => fn({
        auth: { signOut: vi.fn() }
      }));

    await init();
    document.getElementById('signOut').click();

    expect(signOutSpy).toHaveBeenCalled();
  });
});