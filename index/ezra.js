/**
 * BioVAuth - Secure Authentication System
 * With Cloudflare Workers and Supabase WebAuthn Integration
 */

// Supabase configuration
const SUPABASE_URL = 'https://hjmosjvfrycamxowfurq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Cloudflare Worker endpoint
const CLOUDFLARE_WORKER_URL = 'https://auth-logs.ezvvel.workers.dev/';

class BioVAuth {
  constructor() {
    // DOM Elements
    this.elements = {
      scanLine: document.getElementById('scanLine'),
      status: document.getElementById('status'),
      btnContainer: document.getElementById('btnContainer'),
      loginForm: document.getElementById('loginForm'),
      fallbackBtn: document.getElementById('fallbackBtn'),
      webauthnBtn: document.getElementById('webauthnBtn'),
      emailInput: document.getElementById('email'),
      passwordInput: document.getElementById('password'),
      submitLogin: document.getElementById('submitLogin'),
      loadingSpinner: document.getElementById('loadingSpinner'),
      errorMsg: document.getElementById('errorMsg'),
      ipDisplay: document.getElementById('ipDisplay'),
      togglePassword: document.querySelector('.toggle-password'),
      webauthnSection: document.getElementById('webauthnSection'),
      registerWebauthnBtn: document.getElementById('registerWebauthnBtn'),
      webauthnInfo: document.getElementById('webauthnInfo')
    };

    // Security Configuration
    this.securityConfig = {
      maxAttempts: 3,
      blockDuration: 5 * 60 * 1000, // 5 minutes in milliseconds
      cookieName: 'bioVAuthSecurity',
      localStorageKey: 'bioVAuthSession'
    };

    // Initialize
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    // Start biometric animation
    this.startBiometricAnimation();

    // Set up event listeners
    this.setupEventListeners();

    // Check if user is already authenticated
    await this.checkAuthentication();

    // Get client IP address
    this.getClientIP();

    // Initialize security system
    this.securitySystem = new SecuritySystem(
      this.securityConfig.maxAttempts,
      this.securityConfig.blockDuration,
      this.securityConfig.cookieName
    );

    // Initialize password toggle
    this.initPasswordToggle();
  }

  /**
   * Start biometric scanning animation
   */
  startBiometricAnimation() {
    this.elements.scanLine.style.opacity = '1';
    this.updateStatus('Initializing authentication system...', 'info');
    
    // Simulate biometric scan completion
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('Ready for authentication', 'success');
      this.elements.btnContainer.style.display = 'flex';
    }, 3000);
  }

  /**
   * Update status message
   * @param {string} message - Status message
   * @param {string} type - Message type (info, success, error)
   */
  updateStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    
    // Reset classes
    this.elements.status.className = 'status';
    
    // Add type class
    if (type) {
      this.elements.status.classList.add(type);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Fallback to email login
    this.elements.fallbackBtn.addEventListener('click', () => {
      this.showLoginForm();
    });

    // WebAuthn/Biometric login
    this.elements.webauthnBtn.addEventListener('click', async () => {
      await this.handleWebAuthnLogin();
    });

    // Register WebAuthn credential
    this.elements.registerWebauthnBtn.addEventListener('click', async () => {
      await this.registerWebAuthn();
    });

    // Form submission
    this.elements.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Password toggle
    this.elements.togglePassword.addEventListener('click', () => {
      this.togglePasswordVisibility();
    });
  }

  /**
   * Show login form
   */
  showLoginForm() {
    this.elements.btnContainer.style.display = 'none';
    this.elements.loginForm.style.display = 'block';
    this.elements.webauthnSection.style.display = 'none';
    this.elements.emailInput.focus();
    this.updateStatus('Enter your credentials', 'info');
  }

  /**
   * Show WebAuthn section
   */
  showWebAuthnSection() {
    this.elements.btnContainer.style.display = 'none';
    this.elements.loginForm.style.display = 'none';
    this.elements.webauthnSection.style.display = 'block';
    this.updateStatus('Use your biometric credential', 'info');
  }

  /**
   * Handle login form submission
   */
  async handleLogin() {
    // Check if user is blocked
    if (this.securitySystem.isBlocked()) {
      this.showBlockedMessage();
      return;
    }

    const email = this.elements.emailInput.value.trim();
    const password = this.elements.passwordInput.value;

    // Basic validation
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    // Show loading state
    this.setLoadingState(true);

    try {
      // Send credentials to Cloudflare Worker
      const response = await fetch(CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Successful login
        this.handleSuccessfulLogin(data.token, email, data.redirectUrl);
      } else {
        // Failed login
        this.handleFailedLogin(data.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError('Network error. Please try again.');
      this.securitySystem.recordFailedAttempt();
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * Handle WebAuthn login
   */
  async handleWebAuthnLogin() {
    this.showWebAuthnSection();
    this.elements.webauthnInfo.textContent = 'Preparing biometric authentication...';

    try {
      // Get the user's email (optional, could be skipped for true passwordless)
      const email = prompt('Please enter your email for biometric login:');
      if (!email) return;

      // Get authentication options from Supabase
      const { data: options, error: optionsError } = await supabase.auth.signInWithSSO({
        domain: 'yourdomain.com', // Replace with your domain
        options: {
          redirectTo: `${window.location.origin}/vfiles/index.html`
        }
      });

      if (optionsError) throw optionsError;

      // Start WebAuthn authentication
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        type: 'webauthn',
        token: options.provider_token,
        email
      });

      if (authError) throw authError;

      // Successful WebAuthn login
      this.handleSuccessfulLogin(authData.session.access_token, email, '/vfiles/index.html');
    } catch (error) {
      console.error('WebAuthn login error:', error);
      this.elements.webauthnInfo.textContent = 'Biometric login failed. You can register your biometric below.';
      this.elements.registerWebauthnBtn.style.display = 'block';
    }
  }

  /**
   * Register WebAuthn credential
   */
  async registerWebAuthn() {
    this.elements.webauthnInfo.textContent = 'Preparing to register your biometric...';

    try {
      // Get the user's email
      const email = prompt('Please enter your email to register biometric:');
      if (!email) return;

      // First verify the user with password
      const password = prompt('Please enter your password to verify:');
      if (!password) return;

      // Verify credentials with Cloudflare Worker
      const verifyResponse = await fetch(CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        throw new Error('Invalid credentials');
      }

      // Register WebAuthn with Supabase
      const { data: registrationData, error: registrationError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          webauthn: true
        }
      });

      if (registrationError) throw registrationError;

      this.elements.webauthnInfo.textContent = 'Biometric registration successful! You can now login with your fingerprint or face.';
      this.elements.registerWebauthnBtn.style.display = 'none';
    } catch (error) {
      console.error('WebAuthn registration error:', error);
      this.elements.webauthnInfo.textContent = `Registration failed: ${error.message}`;
    }
  }

  /**
   * Handle successful login
   */
  handleSuccessfulLogin(token, email, redirectUrl) {
    // Store token
    localStorage.setItem(this.securityConfig.localStorageKey, token);
    
    // Reset security attempts
    this.securitySystem.resetAttempts();
    
    // Update UI
    this.updateStatus('Authentication successful!', 'success');
    this.elements.errorMsg.textContent = '';
    
    // Redirect to appropriate dashboard
    setTimeout(() => {
      window.location.href = redirectUrl || 'dashboard/index.html';
    }, 1000);
  }

  /**
   * Handle failed login
   */
  handleFailedLogin(error) {
    // Record failed attempt
    this.securitySystem.recordFailedAttempt();
    
    // Show error message
    const attemptsLeft = this.securitySystem.maxAttempts - this.securitySystem.attemptData.attempts;
    const errorMessage = `${error} (${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left)`;
    
    this.showError(errorMessage);
    
    // Check if user is now blocked
    if (this.securitySystem.isBlocked()) {
      this.showBlockedMessage();
    }
    
    // Clear password field
    this.elements.passwordInput.value = '';
    this.elements.passwordInput.focus();
    
    // Shake form for visual feedback
    this.elements.loginForm.classList.add('shake');
    setTimeout(() => {
      this.elements.loginForm.classList.remove('shake');
    }, 500);
  }

  /**
   * Show blocked message
   */
  showBlockedMessage() {
    const remainingTime = this.securitySystem.getRemainingBlockTime();
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    
    this.showError(`Too many attempts. Please wait ${minutes}m ${seconds}s.`);
    this.setLoadingState(false);
    this.elements.submitLogin.disabled = true;
    
    // Update countdown
    const countdownInterval = setInterval(() => {
      const newRemainingTime = this.securitySystem.getRemainingBlockTime();
      
      if (newRemainingTime <= 0) {
        clearInterval(countdownInterval);
        this.elements.errorMsg.textContent = '';
        this.elements.submitLogin.disabled = false;
        return;
      }
      
      const newMinutes = Math.floor(newRemainingTime / 60);
      const newSeconds = newRemainingTime % 60;
      this.elements.errorMsg.textContent = `Too many attempts. Please wait ${newMinutes}m ${newSeconds}s.`;
    }, 1000);
  }

  /**
   * Show error message
   */
  showError(message) {
    this.elements.errorMsg.textContent = message;
    this.elements.errorMsg.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
      if (this.elements.errorMsg.textContent === message) {
        this.elements.errorMsg.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Set loading state
   */
  setLoadingState(isLoading) {
    if (isLoading) {
      this.elements.submitLogin.disabled = true;
      this.elements.loadingSpinner.style.display = 'inline-block';
      this.elements.submitLogin.querySelector('.btn-text').textContent = 'Authenticating...';
    } else {
      this.elements.submitLogin.disabled = false;
      this.elements.loadingSpinner.style.display = 'none';
      this.elements.submitLogin.querySelector('.btn-text').textContent = 'Login';
    }
  }

  /**
   * Check if user is already authenticated
   */
  async checkAuthentication() {
    const authToken = localStorage.getItem(this.securityConfig.localStorageKey);
    
    if (authToken) {
      try {
        // Validate token with server
        const isValid = await this.validateAuthToken(authToken);
        
        if (isValid) {
          this.updateStatus('Welcome back! Redirecting to dashboard...', 'success');
          
          // Redirect to dashboard after delay
          setTimeout(() => {
            window.location.href = 'dashboard/index.html';
          }, 2000);
        } else {
          localStorage.removeItem(this.securityConfig.localStorageKey);
        }
      } catch (error) {
        console.error('Token validation error:', error);
      }
    }
  }

  /**
   * Validate authentication token with server
   */
  async validateAuthToken(token) {
    try {
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Initialize password toggle
   */
  initPasswordToggle() {
    this.elements.togglePassword.addEventListener('click', () => {
      const isPassword = this.elements.passwordInput.type === 'password';
      this.elements.passwordInput.type = isPassword ? 'text' : 'password';
      this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
      this.elements.togglePassword.setAttribute('aria-label', 
        isPassword ? 'Hide password' : 'Show password');
    });
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility() {
    const isPassword = this.elements.passwordInput.type === 'password';
    this.elements.passwordInput.type = isPassword ? 'text' : 'password';
    this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
    this.elements.togglePassword.setAttribute('aria-label', 
      isPassword ? 'Hide password' : 'Show password');
  }

  /**
   * Get client IP address
   */
  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      this.elements.ipDisplay.textContent = `Your IP: ${data.ip} • ${navigator.userAgent.split(' ')[0]}`;
    } catch (error) {
      console.error('Error fetching IP:', error);
      this.elements.ipDisplay.textContent = 'Network: Secure • Private';
    }
  }
}

/**
 * Security System Class
 */
class SecuritySystem {
  constructor(maxAttempts, blockDuration, cookieName) {
    this.maxAttempts = maxAttempts;
    this.blockDuration = blockDuration;
    this.cookieName = cookieName;
    this.attemptData = this.loadAttemptData();
  }

  /**
   * Load attempt data from cookie
   */
  loadAttemptData() {
    try {
      const cookieData = this.getCookie(this.cookieName);
      if (!cookieData) return this.getDefaultData();
      
      const data = JSON.parse(decodeURIComponent(cookieData));
      return this.validateData(data) ? data : this.getDefaultData();
    } catch (e) {
      console.error('Failed to parse cookie data:', e);
      return this.getDefaultData();
    }
  }

  /**
   * Get default attempt data
   */
  getDefaultData() {
    return {
      attempts: 0,
      lastAttempt: null,
      blockUntil: null
    };
  }

  /**
   * Validate attempt data
   */
  validateData(data) {
    return data && typeof data === 'object' && 
           'attempts' in data && 'lastAttempt' in data && 'blockUntil' in data;
  }

  /**
   * Save attempt data to cookie
   */
  saveAttemptData() {
    const expires = new Date();
    expires.setDate(expires.getDate() + 1); // 1 day expiration
    const data = encodeURIComponent(JSON.stringify(this.attemptData));
    document.cookie = `${this.cookieName}=${data}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure`;
  }

  /**
   * Get cookie value
   */
  getCookie(name) {
    return document.cookie.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(name + '='))
      ?.substring(name.length + 1);
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt() {
    const now = new Date();
    this.attemptData.attempts++;
    this.attemptData.lastAttempt = now.toISOString();

    if (this.attemptData.attempts >= this.maxAttempts) {
      const blockUntil = new Date(now.getTime() + this.blockDuration);
      this.attemptData.blockUntil = blockUntil.toISOString();
    }

    this.saveAttemptData();
  }

  /**
   * Reset login attempts
   */
  resetAttempts() {
    this.attemptData = this.getDefaultData();
    this.saveAttemptData();
  }

  /**
   * Check if user is blocked
   */
  isBlocked() {
    if (!this.attemptData.blockUntil) return false;
    
    const blockUntil = new Date(this.attemptData.blockUntil);
    const now = new Date();
    
    if (now > blockUntil) {
      this.resetAttempts();
      return false;
    }
    
    return true;
  }

  /**
   * Get remaining block time in seconds
   */
  getRemainingBlockTime() {
    if (!this.isBlocked()) return 0;
    
    const blockUntil = new Date(this.attemptData.blockUntil);
    const now = new Date();
    return Math.round((blockUntil - now) / 1000);
  }
}

// Initialize BioVAuth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BioVAuth();
});
