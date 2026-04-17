import { setupRealtime, teardownRealtime } from './realtime.js';

// Initialize Supabase client
const supabase = window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__
  ? (async () => {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      return createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON_KEY__);
    })()
  : null;

// DOM Elements
const loadingEl = document.getElementById('loading');
const appEl = document.getElementById('app');
const signOutBtn = document.getElementById('signOut');
const workoutForm = document.getElementById('workoutForm');
const formError = document.getElementById('formError');
const workoutList = document.getElementById('workoutList');
const emptyState = document.getElementById('emptyState');
const workoutCount = document.getElementById('workoutCount');
const totalDuration = document.getElementById('totalDuration');
const streak = document.getElementById('streak');

// Check credentials
if (!window.__SUPABASE_URL__ || !window.__SUPABASE_ANON_KEY__) {
  loadingEl.textContent = 'Supabase credentials not injected';
  throw new Error('Missing Supabase credentials');
}

// Global state
let currentUser = null;

// Initialize app
async function init() {
  try {
    const sb = await supabase;
    let session, user;

    // Handle sandbox restrictions on sessionStorage
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (err) {
      console.warn('Auth session access blocked (likely sandbox), treating as no session', err);
      session = null;
    }

    if (session) {
      try {
        const { data, error } = await sb.auth.getUser();
        if (error) throw error;
        user = data.user;
      } catch (err) {
        console.warn('Auth user access blocked (likely sandbox), treating as no user', err);
        user = null;
      }
    }

    currentUser = user;

    if (currentUser) {
      appEl.classList.remove('hidden');
      appEl.hidden = false;
      loadingEl.hidden = true;
      renderDashboard();
      await loadWorkouts();
      setupRealtime(sb, handleRealtimeChange);
      sb.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT') {
          window.location.reload();
        }
      });
    } else {
      appEl.classList.remove('hidden');
      appEl.hidden = false;
      loadingEl.hidden = true;
      renderAuthGate();
    }
  } catch (error) {
    console.error('Initialization failed:', error);
    formError.textContent = `App failed to initialize: ${error.message}`;
    formError.hidden = false;
  } finally {
    // Ensure loading is hidden and app is shown
    loadingEl.hidden = true;
    appEl.hidden = false;
  }
}

function renderAuthGate() {
  appEl.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2>Welcome to FitTrack</h2>
        <p>Log your workouts and track your progress over time.</p>
        <form id="authForm">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required />
          </div>
          <div class="auth-buttons">
            <button type="submit" name="action" value="signUp" class="btn btn-primary">Sign Up</button>
            <button type="submit" name="action" value="signIn" class="btn btn-outline">Sign In</button>
          </div>
          <div id="authError" class="error" role="alert" hidden></div>
        </form>
      </div>
    </div>
  `;

  const authForm = appEl.querySelector('#authForm');
  const authError = appEl.querySelector('#authError');

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(authForm);
    const action = formData.get('action');
    const email = formData.get('email');
    const password = formData.get('password');

    authError.hidden = true;
    authError.textContent = '';

    try {
      const sb = await supabase;
      if (action === 'signUp') {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        authError.textContent = 'Check your email for the confirmation link!';
        authError.hidden = false;
      } else if (action === 'signIn') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      authError.textContent = error.message;
      authError.hidden = false;
    }
  });
}

function renderDashboard() {
  // Already rendered by HTML, just attach event listeners
  signOutBtn.addEventListener('click', async () => {
    const sb = await supabase;
    teardownRealtime();
    await sb.auth.signOut();
  });

  workoutForm.addEventListener('submit', submitWorkout);
}

async function submitWorkout(e) {
  e.preventDefault();
  formError.hidden = true;
  formError.textContent = '';

  const type = document.getElementById('type').value.trim();
  const duration = parseInt(document.getElementById('duration').value, 10);
  const intensity = document.getElementById('intensity').value || null;
  const notes = document.getElementById('notes').value.trim() || null;

  if (!type || !duration) {
    formError.textContent = 'Please fill in required fields.';
    formError.hidden = false;
    return;
  }

  try {
    const sb = await supabase;
    const response = await fetch('/api/workouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sb.auth.getSession().data.session.access_token}`
      },
      body: JSON.stringify({ type, duration, intensity, notes })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save workout');
    }

    // Reset form
    workoutForm.reset();
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  }
}

async function loadWorkouts() {
  try {
    const sb = await supabase;
    const response = await fetch('/api/workouts', {
      headers: {
        'Authorization': `Bearer ${sb.auth.getSession().data.session.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load workouts');
    }

    const workouts = await response.json();

    // Sort by created_at descending
    workouts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Render list
    workoutList.innerHTML = '';
    if (workouts.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      workouts.forEach(work => {
        const li = document.createElement('li');
        li.className = 'workout-item fade-in';
        li.innerHTML = `
          <h4>${escapeHtml(work.type)}</h4>
          <p>${work.duration} min • ${capitalize(work.intensity || 'unknown')} • ${formatDate(work.created_at)}</p>
          ${work.notes ? `<p><em>${escapeHtml(work.notes)}</em></p>` : ''}
        `;
        workoutList.appendChild(li);
      });
    }

    // Update stats
    updateStats(workouts);
  } catch (error) {
    console.error('Failed to load workouts:', error);
    formError.textContent = 'Failed to load workout history.';
    formError.hidden = false;
  }
}

function updateStats(workouts) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const thisWeek = workouts.filter(w => new Date(w.created_at) >= startOfWeek);
  const count = thisWeek.length;
  const total = thisWeek.reduce((sum, w) => sum + w.duration, 0);

  workoutCount.textContent = count;
  totalDuration.textContent = total;

  // Calculate streak (simplified: consecutive days with at least one workout)
  // Group by date
  const workoutDates = [...new Set(workouts.map(w => w.created_at.split('T')[0]))]
    .map(d => new Date(d))
    .sort((a, b) => b - a); // descending

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < workoutDates.length; i++) {
    const d = new Date(workoutDates[i]);
    d.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - d.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === currentStreak) {
      currentStreak++;
    } else if (diffDays > currentStreak + 1) {
      break;
    }
  }

  streak.textContent = currentStreak;
}

function handleRealtimeChange(payload) {
  console.log('Realtime change:', payload);
  loadWorkouts();
}

// Utility functions
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start the app
init();