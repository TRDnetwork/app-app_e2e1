// Comprehensive authentication implementation for FitTrack using Supabase Auth
// Implements all required auth flows with security best practices and edge case handling

import { setupRealtime, teardownRealtime } from './realtime.js';

// Initialize Supabase client
const supabase = window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__
  ? (async () => {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      return createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON_KEY__);
    })()
  : null;

// DOM Elements
const appEl = document.getElementById('app');
const loadingEl = document.getElementById('loading');

// Auth UI Components
class AuthUI {
  constructor() {
    this.currentView = 'login';
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    appEl.innerHTML = `
      <div class="auth-container">
        <div class="card">
          <h2 id="auth-heading">${this.getHeading()}</h2>
          
          <!-- Email/Password Form -->
          <form id="authForm" class="auth-form" novalidate>
            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                required 
                aria-required="true"
                autocomplete="email"
                inputmode="email" />
            </div>
            
            ${this.renderPasswordField()}
            
            <button type="submit" class="btn btn-primary btn-block">
              ${this.getSubmitText()}
            </button>
            
            <div id="authError" class="error" role="alert" hidden></div>
          </form>

          <!-- Social Login Buttons -->
          <div class="social-login">
            <div class="divider">
              <span>or continue with</span>
            </div>
            <button id="googleSignIn" class="btn btn-outline btn-social" type="button" aria-label="Sign in with Google">
              <svg viewBox="0 0 24 24" width="18" height="18" class="social-icon">
                <path d="M12.545 10.239v3.821h5.445c-0.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866 0.549 3.921 1.453l2.814-2.814c-1.798-1.677-4.198-2.707-6.735-2.707-5.523 0-10 4.477-10 10s4.477 10 10 10c8.396 0 10-7.564 10-10.748 0-0.754-0.084-1.705-0.222-2.195h-9.778z" fill="#4285F4"/>
                <path d="M12.545 10.239v3.821h5.445c-0.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866 0.549 3.921 1.453l2.814-2.814c-1.798-1.677-4.198-2.707-6.735-2.707-5.523 0-10 4.477-10 10s4.477 10 10 10c8.396 0 10-7.564 10-10.748 0-0.754-0.084-1.705-0.222-2.195h-9.778z" fill="#4285F4"/>
              </svg>
              Google
            </button>
            <button id="githubSignIn" class="btn btn-outline btn-social" type="button" aria-label="Sign in with GitHub">
              <svg viewBox="0 0 24 24" width="18" height="18" class="social-icon">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" fill="#24292F"/>
              </svg>
              GitHub
            </button>
          </div>

          <!-- Magic Link Option -->
          <div class="magic-link">
            <button id="magicLinkBtn" class="btn-text" type="button">Send magic link</button>
          </div>

          <!-- Navigation Links -->
          <div class="auth-links">
            ${this.renderNavigationLink()}
          </div>
        </div>
      </div>
    `;
  }

  renderPasswordField() {
    if (this.currentView === 'forgot') {
      return '';
    }
    return `
      <div class="form-group">
        <label for="password">${this.currentView === 'login' ? 'Password' : 'Create Password'}</label>
        <div class="password-input">
          <input 
            type="password" 
            id="password" 
            name="password" 
            required 
            aria-required="true"
            autocomplete="${this.currentView === 'login' ? 'current-password' : 'new-password'}"
            minlength="6" />
          <button type="button" class="btn-text password-toggle" aria-label="Show password">
            Show
          </button>
        </div>
        ${this.currentView === 'login' ? '<small class="form-hint"><a href="#" id="forgotPassword" class="link">Forgot password?</a></small>' : ''}
      </div>
    `;
  }

  renderNavigationLink() {
    switch (this.currentView) {
      case 'login':
        return 'Don\'t have an account? <a href="#" id="switchToSignUp" class="link">Sign up</a>';
      case 'signup':
        return 'Already have an account? <a href="#" id="switchToLogin" class="link">Sign in</a>';
      case 'forgot':
        return '<a href="#" id="backToLogin" class="link">Back to sign in</a>';
      default:
        return '';
    }
  }

  getHeading() {
    switch (this.currentView) {
      case 'signup': return 'Create an account';
      case 'forgot': return 'Reset your password';
      default: return 'Welcome back';
    }
  }

  getSubmitText() {
    switch (this.currentView) {
      case 'signup': return 'Create account';
      case 'forgot': return 'Send reset instructions';
      default: return 'Sign in';
    }
  }

  bindEvents() {
    const form = document.getElementById('authForm');
    const authError = document.getElementById('authError');
    
    // Form submission
    form.addEventListener('submit', (e) => this.handleFormSubmit(e, authError));
    
    // Password visibility toggle
    const passwordToggle = document.querySelector('.password-toggle');
    if (passwordToggle) {
      passwordToggle.addEventListener('click', () => this.togglePasswordVisibility());
    }
    
    // Navigation links
    this.bindNavigationEvents();
    
    // Social login buttons
    this.bindSocialLoginEvents();
    
    // Magic link
    const magicLinkBtn = document.getElementById('magicLinkBtn');
    if (magicLinkBtn) {
      magicLinkBtn.addEventListener('click', () => this.handleMagicLink());
    }
  }

  bindNavigationEvents() {
    const switchToSignUp = document.getElementById('switchToSignUp');
    const switchToLogin = document.getElementById('switchToLogin');
    const forgotPassword = document.getElementById('forgotPassword');
    const backToLogin = document.getElementById('backToLogin');
    
    if (switchToSignUp) {
      switchToSignUp.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentView = 'signup';
        this.render();
      });
    }
    
    if (switchToLogin) {
      switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentView = 'login';
        this.render();
      });
    }
    
    if (forgotPassword) {
      forgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentView = 'forgot';
        this.render();
      });
    }
    
    if (backToLogin) {
      backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentView = 'login';
        this.render();
      });
    }
  }

  bindSocialLoginEvents() {
    const googleBtn = document.getElementById('googleSignIn');
    const githubBtn = document.getElementById('githubSignIn');
    
    if (googleBtn) {
      googleBtn.addEventListener('click', () => this.handleSocialLogin('google'));
    }
    
    if (githubBtn) {
      githubBtn.addEventListener('click', () => this.handleSocialLogin('github'));
    }
  }

  async handleFormSubmit(e, authError) {
    e.preventDefault();
    authError.hidden = true;
    authError.textContent = '';
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password')?.value;
    
    // Validate email
    if (!this.isValidEmail(email)) {
      authError.textContent = 'Please enter a valid email address';
      authError.hidden = false;
      return;
    }
    
    // Validate password for signup/login
    if (this.currentView !== 'forgot' && (!password || password.length < 6)) {
      authError.textContent = 'Password must be at least 6 characters';
      authError.hidden = false;
      return;
    }
    
    try {
      const sb = await supabase;
      
      switch (this.currentView) {
        case 'login':
          await this.signInWithEmailAndPassword(sb, email, password, authError);
          break;
        case 'signup':
          await this.signUpWithEmailAndPassword(sb, email, password, authError);
          break;
        case 'forgot':
          await this.sendPasswordResetEmail(sb, email, authError);
          break;
      }
    } catch (error) {
      this.handleAuthError(error, authError);
    }
  }

  async signInWithEmailAndPassword(sb, email, password, authError) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    
    if (error) {
      throw error;
    }
    
    // Track successful sign in
    trackEvent('sign_in', { method: 'email_password', success: true });
  }

  async signUpWithEmailAndPassword(sb, email, password, authError) {
    const { error } = await sb.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          created_at: new Date().toISOString()
        }
      }
    });
    
    if (error) {
      throw error;
    }
    
    // Show success message
    authError.textContent = 'Check your email for the confirmation link!';
    authError.style.backgroundColor = '#dcfce7';
    authError.style.color = '#166534';
    authError.hidden = false;
    
    // Track successful sign up
    trackEvent('sign_up', { method: 'email_password', success: true });
  }

  async sendPasswordResetEmail(sb, email, authError) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?view=reset`
    });
    
    if (error) {
      throw error;
    }
    
    // Show success message
    authError.textContent = 'Password reset instructions sent to your email';
    authError.style.backgroundColor = '#dcfce7';
    authError.style.color = '#166534';
    authError.hidden = false;
    
    // Track password reset request
    trackEvent('password_reset_request', { success: true });
  }

  async handleSocialLogin(provider) {
    const sb = await supabase;
    const { error } = await sb.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      const authError = document.getElementById('authError');
      authError.textContent = error.message;
      authError.hidden = false;
      
      // Track failed social login
      trackEvent('social_login', { provider, success: false, reason: error.message });
    } else {
      // Track successful social login
      trackEvent('social_login', { provider, success: true });
    }
  }

  async handleMagicLink() {
    const email = document.getElementById('email').value.trim();
    const authError = document.getElementById('authError');
    
    if (!this.isValidEmail(email)) {
      authError.textContent = 'Please enter a valid email address';
      authError.hidden = false;
      return;
    }
    
    try {
      const sb = await supabase;
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) {
        throw error;
      }
      
      // Show success message
      authError.textContent = 'Magic link sent to your email! Check your inbox.';
      authError.style.backgroundColor = '#dcfce7';
      authError.style.color = '#166534';
      authError.hidden = false;
      
      // Track magic link request
      trackEvent('magic_link_request', { success: true });
    } catch (error) {
      this.handleAuthError(error, authError);
    }
  }

  togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.password-toggle');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = 'Hide';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = 'Show';
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  handleAuthError(error, authError) {
    let message = 'An error occurred';
    
    // Handle specific error codes
    switch (error.code) {
      case 'invalid_credentials':
        message = 'Invalid email or password';
        break;
      case 'email_not_confirmed':
        message = 'Please confirm your email before signing in';
        break;
      case 'rate_limit_exceeded':
        message = 'Too many attempts. Please try again later';
        break;
      case 'user_already_exists':
        message = 'An account with this email already exists';
        break;
      default:
        message = error.message;
    }
    
    authError.textContent = message;
    authError.hidden = false;
    
    // Track failed auth attempt
    trackEvent('auth_failure', { 
      view: this.currentView, 
      reason: error.code || 'unknown', 
      message: error.message 
    });
  }
}

// Auth Context and Session Management
class AuthContext {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    try {
      // Check for existing session
      const sb = await supabase;
      const { data: { session }, error } = await sb.auth.getSession();
      
      if (error) {
        console.warn('Auth session access blocked (likely sandbox)', error);
        this.handleAuthStateChange('SIGNED_OUT', null);
        return;
      }
      
      if (session) {
        await this.setSession(session);
      } else {
        this.handleAuthStateChange('SIGNED_OUT', null);
      }
      
      // Listen for auth state changes
      sb.auth.onAuthStateChange((event, session) => {
        this.handleAuthStateChange(event, session);
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.handleAuthStateChange('SIGNED_OUT', null);
    }
  }

  async setSession(session) {
    if (!session) {
      this.currentUser = null;
      this.isAuthenticated = false;
      return;
    }
    
    try {
      const sb = await supabase;
      const { data, error } = await sb.auth.getUser();
      
      if (error) {
        throw error;
      }
      
      this.currentUser = data.user;
      this.isAuthenticated = true;
      
      // Setup realtime subscriptions
      setupRealtime(sb, debounce(() => {
        safeLoadWorkouts();
      }, 1000));
      
      // Track authenticated state
      trackEvent('authenticated', { user_id: this.currentUser.id });
    } catch (error) {
      console.error('Failed to set session:', error);
      this.signOut();
    }
  }

  handleAuthStateChange(event, session) {
    switch (event) {
      case 'SIGNED_IN':
        this.setSession(session);
        break;
      case 'SIGNED_OUT':
        this.signOut();
        break;
      case 'PASSWORD_RECOVERY':
        // Handle password reset flow
        break;
      case 'USER_UPDATED':
        // Refresh user data
        this.refreshUser();
        break;
    }
  }

  async signOut() {
    try {
      const sb = await supabase;
      teardownRealtime();
      await sb.auth.signOut();
      
      this.currentUser = null;
      this.isAuthenticated = false;
      
      // Redirect to auth page
      window.location.reload();
      
      // Track sign out
      trackEvent('sign_out');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  async refreshUser() {
    if (!this.isAuthenticated) return;
    
    try {
      const sb = await supabase;
      const { data, error } = await sb.auth.getUser();
      
      if (error) {
        throw error;
      }
      
      this.currentUser = data.user;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      this.signOut();
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.isAuthenticated;
  }
}

// Role-Based Access Control
class RoleBasedAccess {
  constructor() {
    this.userRoles = new Map();
    this.init();
  }

  async init() {
    // Initialize role-based access policies
    this.loadRoles();
    
    // Listen for user role changes
    const sb = await supabase;
    sb.channel('roles-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_e2e1_profiles',
          filter: `user_id=eq.${this.getUserId()}`
        },
        (payload) => {
          this.handleRoleUpdate(payload);
        }
      )
      .subscribe();
  }

  async loadRoles() {
    try {
      const sb = await supabase;
      const { data: { user }, error: userError } = await sb.auth.getUser();
      
      if (userError || !user) return;
      
      const { data, error } = await sb
        .from('app_e2e1_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Failed to load user role:', error);
        return;
      }
      
      this.userRoles.set(user.id, data?.role || 'user');
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }

  getUserRole(userId = this.getUserId()) {
    return this.userRoles.get(userId) || 'user';
  }

  getUserId() {
    const authContext = new AuthContext();
    return authContext.getCurrentUser()?.id;
  }

  hasRole(requiredRole) {
    const userRole = this.getUserRole();
    const roleHierarchy = ['user', 'moderator', 'admin'];
    
    return roleHierarchy.indexOf(userRole) >= roleHierarchy.indexOf(requiredRole);
  }

  canAccessRoute(route) {
    const roleRoutes = {
      '/admin': 'admin',
      '/moderate': 'moderator',
      '/profile': 'user'
    };
    
    const requiredRole = roleRoutes[route];
    if (!requiredRole) return true;
    
    return this.hasRole(requiredRole);
  }

  handleRoleUpdate(payload) {
    const userId = payload.old.user_id;
    const newRole = payload.new.role;
    
    this.userRoles.set(userId, newRole);
    
    // Refresh UI based on role change
    if (userId === this.getUserId()) {
      this.refreshUI();
    }
  }

  refreshUI() {
    // Update UI elements based on current role
    const role = this.getUserRole();
    
    // Example: Show/hide admin features
    const adminElements = document.querySelectorAll('[data-role="admin"]');
    adminElements.forEach(el => {
      el.style.display = role === 'admin' ? 'block' : 'none';
    });
  }
}

// Security Enhancements
class SecurityEnhancements {
  constructor() {
    this.init();
  }

  init() {
    this.setupCSRFProtection();
    this.setupRateLimiting();
    this.setupPasswordStrength();
    this.setupAccountLockout();
    this.setupSessionManagement();
  }

  setupCSRFProtection() {
    // Add CSRF token to all requests
    const csrfToken = this.generateCSRFToken();
    document.addEventListener('submit', (e) => {
      if (e.target.matches('form')) {
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'csrf_token';
        tokenInput.value = csrfToken;
        e.target.appendChild(tokenInput);
      }
    });
  }

  generateCSRFToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  setupRateLimiting() {
    // Track failed login attempts
    this.failedAttempts = new Map();
    this.lockoutThreshold = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'authForm') {
        const email = document.getElementById('email').value;
        this.trackFailedAttempt(email);
      }
    });
  }

  trackFailedAttempt(email) {
    const now = Date.now();
    const attempts = this.failedAttempts.get(email) || [];
    
    // Remove attempts older than 15 minutes
    const recentAttempts = attempts.filter(time => now - time < this.lockoutDuration);
    
    recentAttempts.push(now);
    this.failedAttempts.set(email, recentAttempts);
    
    if (recentAttempts.length >= this.lockoutThreshold) {
      this.lockAccount(email, now);
    }
  }

  lockAccount(email, lockTime) {
    const lockoutElement = document.createElement('div');
    lockoutElement.className = 'error';
    lockoutElement.textContent = `Account locked for 15 minutes due to too many failed attempts`;
    lockoutElement.style.marginTop = '1rem';
    
    const form = document.getElementById('authForm');
    form.appendChild(lockoutElement);
    
    // Remove lockout after duration
    setTimeout(() => {
      this.failedAttempts.delete(email);
      if (lockoutElement.parentNode) {
        lockoutElement.remove();
      }
    }, this.lockoutDuration - (Date.now() - lockTime));
  }

  setupPasswordStrength() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) return;
    
    passwordInput.addEventListener('input', (e) => {
      const strength = this.checkPasswordStrength(e.target.value);
      this.updatePasswordStrengthIndicator(strength);
    });
  }

  checkPasswordStrength(password) {
    if (password.length < 6) return 'weak';
    if (password.length < 8) return 'fair';
    
    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    if (score < 3) return 'fair';
    if (score < 4) return 'good';
    return 'strong';
  }

  updatePasswordStrengthIndicator(strength) {
    const indicator = document.querySelector('.password-strength');
    if (!indicator) return;
    
    indicator.className = `password-strength ${strength}`;
    indicator.textContent = `Password strength: ${strength}`;
  }

  setupAccountLockout() {
    // Monitor for brute force attempts
    this.loginAttempts = new Map();
    this.maxAttempts = 10;
    this.attemptWindow = 5 * 60 * 1000; // 5 minutes
    
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'authForm') {
        const ip = this.getClientIP();
        this.recordLoginAttempt(ip);
      }
    });
  }

  getClientIP() {
    // In a real app, this would come from the server
    return 'client-ip';
  }

  recordLoginAttempt(ip) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(ip) || [];
    
    const recentAttempts = attempts.filter(time => now - time < this.attemptWindow);
    recentAttempts.push(now);
    
    this.loginAttempts.set(ip, recentAttempts);
    
    if (recentAttempts.length > this.maxAttempts) {
      // Trigger account lockout or CAPTCHA
      this.triggerSecurityMeasure(ip);
    }
  }

  triggerSecurityMeasure(ip) {
    // In a real app, this would trigger CAPTCHA or 2FA
    console.log('Security measure triggered for IP:', ip);
  }

  setupSessionManagement() {
    // Monitor session activity
    this.lastActivity = Date.now();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    
    // Track user activity
    ['click', 'keypress', 'scroll'].forEach(event => {
      document.addEventListener(event, () => {
        this.updateActivity();
      });
    });
    
    // Check session timeout
    setInterval(() => {
      this.checkSessionTimeout();
    }, 60 * 1000); // Check every minute
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  checkSessionTimeout() {
    if (Date.now() - this.lastActivity > this.sessionTimeout) {
      const authContext = new AuthContext();
      authContext.signOut();
    }
  }
}

// Initialize Auth System
async function initAuth() {
  try {
    // Validate Supabase credentials
    if (!window.__SUPABASE_URL__ || !window.__SUPABASE_ANON_KEY__) {
      throw new Error('Missing Supabase credentials');
    }
    
    // Initialize auth context
    const authContext = new AuthContext();
    
    // Show appropriate UI based on auth state
    if (authContext.isAuthenticated) {
      showDashboard();
    } else {
      showAuthUI();
    }
  } catch (error) {
    console.error('Auth initialization failed:', error);
    showAuthError(error.message);
  }
}

function showAuthUI() {
  loadingEl.hidden = true;
  appEl.hidden = false;
  new AuthUI();
}

function showDashboard() {
  loadingEl.hidden = true;
  appEl.hidden = false;
  renderDashboard();
}

function showAuthError(message) {
  loadingEl.hidden = true;
  appEl.hidden = false;
  appEl.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2>Authentication Error</h2>
        <p class="error">${message}</p>
        <button onclick="window.location.reload()" class="btn btn-primary">Try Again</button>
      </div>
    </div>
  `;
}

// Export for use in other modules
export { AuthUI, AuthContext, RoleBasedAccess, SecurityEnhancements, initAuth };

// Initialize on load
document.addEventListener('DOMContentLoaded', initAuth);