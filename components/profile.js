// Profile management component for FitTrack
// Handles user profile viewing and editing with security and validation

import { setupRealtime, teardownRealtime } from '../realtime.js';

class ProfileComponent {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  async init() {
    try {
      // Get current user
      const sb = await supabase;
      const { data: { user }, error } = await sb.auth.getUser();
      
      if (error) throw error;
      this.currentUser = user;
      
      // Load profile data
      await this.loadProfile();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup realtime updates
      this.setupRealtimeUpdates();
      
      // Track page view
      trackEvent('page_view', { page: 'profile' });
    } catch (error) {
      console.error('Profile initialization failed:', error);
      this.showError('Failed to load profile');
    }
  }

  async loadProfile() {
    try {
      const sb = await supabase;
      const { data, error } = await sb
        .from('app_e2e1_profiles')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // No rows returned
        throw error;
      }
      
      this.render(data || {});
    } catch (error) {
      console.error('Failed to load profile:', error);
      this.showError('Failed to load profile data');
    }
  }

  render(profile = {}) {
    appEl.innerHTML = `
      <div class="profile-container">
        <header class="profile-header">
          <h1>Profile Settings</h1>
          <button id="backToDashboard" class="btn btn-text">← Back to Dashboard</button>
        </header>

        <div class="card">
          <form id="profileForm" novalidate>
            <div class="form-group">
              <label for="fullName">Full Name</label>
              <input 
                type="text" 
                id="fullName" 
                name="fullName" 
                value="${profile.full_name || ''}"
                autocomplete="name" />
            </div>

            <div class="form-group">
              <label for="avatarUrl">Avatar URL</label>
              <input 
                type="url" 
                id="avatarUrl" 
                name="avatarUrl" 
                value="${profile.avatar_url || ''}"
                autocomplete="photo"
                placeholder="https://example.com/avatar.jpg" />
            </div>

            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value="${this.currentUser.email}"
                disabled
                aria-describedby="email-help" />
              <small id="email-help" class="form-hint">Email cannot be changed</small>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save Changes</button>
              <button type="button" id="cancelBtn" class="btn btn-outline">Cancel</button>
            </div>
            <div id="formError" class="error" role="alert" hidden></div>
          </form>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const form = document.getElementById('profileForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const backBtn = document.getElementById('backToDashboard');
    const formError = document.getElementById('formError');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError.hidden = true;
      formError.textContent = '';

      const fullName = document.getElementById('fullName').value.trim();
      const avatarUrl = document.getElementById('avatarUrl').value.trim() || null;

      // Validate URL if provided
      if (avatarUrl && !this.isValidUrl(avatarUrl)) {
        formError.textContent = 'Please enter a valid URL';
        formError.hidden = false;
        return;
      }

      try {
        const sb = await supabase;
        const { data, error } = await sb
          .from('app_e2e1_profiles')
          .upsert({
            user_id: this.currentUser.id,
            full_name: fullName || null,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;

        // Show success message
        formError.textContent = 'Profile updated successfully!';
        formError.style.backgroundColor = '#dcfce7';
        formError.style.color = '#166534';
        formError.hidden = false;

        // Track profile update
        trackEvent('profile_update', { 
          success: true, 
          fields_changed: [
            fullName !== (document.getElementById('fullName').dataset.initial || '') ? 'name' : null,
            avatarUrl !== (document.getElementById('avatarUrl').dataset.initial || '') ? 'avatar' : null
          ].filter(Boolean)
        });

        // Refresh profile data
        setTimeout(() => this.loadProfile(), 1000);
      } catch (error) {
        formError.textContent = error.message;
        formError.hidden = false;

        // Track failed update
        trackEvent('profile_update', { success: false, reason: error.message });
      }
    });

    cancelBtn.addEventListener('click', () => {
      history.back();
    });

    backBtn.addEventListener('click', () => {
      history.back();
    });
  }

  setupRealtimeUpdates() {
    const sb = supabase;
    
    // Listen for profile updates
    const channel = sb
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_e2e1_profiles',
          filter: `user_id=eq.${this.currentUser.id}`
        },
        (payload) => {
          console.log('Profile updated in real-time', payload);
          // Refresh current profile data
          this.loadProfile();
        }
      )
      .subscribe();

    // Store channel reference for cleanup
    this.realtimeChannel = channel;
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  showError(message) {
    appEl.innerHTML = `
      <div class="profile-container">
        <header class="profile-header">
          <h1>Profile Settings</h1>
          <button id="backToDashboard" class="btn btn-text">← Back to Dashboard</button>
        </header>
        <div class="card">
          <div class="error">${message}</div>
          <button onclick="history.back()" class="btn btn-primary" style="margin-top: 1rem;">Back</button>
        </div>
      </div>
    `;

    document.getElementById('backToDashboard').addEventListener('click', () => {
      history.back();
    });
  }

  destroy() {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('profile')) {
    new ProfileComponent();
  }
});

export default ProfileComponent;