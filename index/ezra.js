/**
 * BioVAuth - Secure Authentication System
 * Main Application Script
 */

class BioVAuth {
  constructor() {
    // Environment variables (would be replaced by build process in real app)
    this.env = {
      WORKER_URL: 'https://auth-logs.ezvvel.workers.dev/',
      RATE_LIMIT_WINDOW: 5 * 60 * 1000, // 5 minutes
      RATE_LIMIT_MAX_ATTEMPTS: 5
    };

    // DOM Elements
    this.elements = {
      scanLine: document.getElementById('scanLine'),
      status: document.getElementById('status'),
      btnContainer: document.getElementById('btnContainer'),
      loginForm: document.getElementById('loginForm'),
      fallbackBtn: document.getElementById('fallbackBtn'),
      visitBtn: document.getElementById('visitBtn'),
      webauthnBtn: document.getElementById('webauthnBtn'),
      emailInput: document.getElementById('email'),
      passwordInput: document.getElementById('password'),
      submitLogin: document.getElementById('submitLogin'),
      loadingSpinner: document.getElementById('loadingSpinner'),
      errorMsg: document.getElementById('errorMsg'),
      ipDisplay: document.getElementById('ipDisplay'),
      togglePassword: document.querySelector('.toggle-password'),
      webauthnUnsupported: document.getElementById('webauthnUnsupported')
    };

    // Security Configuration
    this.securityConfig = {
      maxAttempts: 3,
      blockDuration: 5 * 60 * 1000, // 5 minutes
      cookieName: 'bioVAuthSecurity',
      localStorageKey: 'bioVAuthSession'
    };

    // State
    this.state = {
      webauthnSupported: false,
      clientInfo: {}
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

    // Collect client information
    await this.collectClientInfo();

    // Set up event listeners
    this.setupEventListeners();

    // Check WebAuthn support
    this.checkWebAuthnSupport();

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
   * Collect client information (IP, browser, etc.)
   */
  async collectClientInfo() {
    try {
      // Get IP address
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      this.state.clientInfo = {
        ip: ipData.ip,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timestamp: new Date().toISOString(),
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language
      };

      this.elements.ipDisplay.textContent = `IP: ${ipData.ip} • ${navigator.platform}`;
    } catch (error) {
      console.error('Error collecting client info:', error);
      this.state.clientInfo = {
        ip: 'unknown',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
      this.elements.ipDisplay.textContent = 'Network: Secure • Private';
    }
  }

  /**
   * Start biometric scanning animation
   */
  startBiometricAnimation() {
    this.elements.scanLine.style.opacity = '1';
    this.updateStatus('Initializing security protocols...', 'info');
    
    // Simulate biometric scan completion
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('System ready, is better if you use desktop site', 'success');
      this.elements.btnContainer.style.display = 'flex';
    }, 2000);
  }

  /**
   * Update status message
   */
  updateStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    if (type) this.elements.status.classList.add(type);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Fallback to email login
    this.elements.fallbackBtn.addEventListener('click', () => {
      this.showLoginForm();
    });

    // Visit dashboard
    this.elements.visitBtn.addEventListener('click', () => {
      window.location.href = 'dashboard/index.html';
    });

    // Check WebAuthn support
    this.elements.webauthnBtn.addEventListener('click', () => {
      if (this.state.webauthnSupported) {
        this.initiateWebAuthn();
      } else {
        this.elements.webauthnUnsupported.style.display = 'block';
      }
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
   * Check WebAuthn support
   */
  checkWebAuthnSupport() {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          this.state.webauthnSupported = available;
          if (!available) {
            this.elements.webauthnUnsupported.style.display = 'block';
          }
        })
        .catch(() => {
          this.state.webauthnSupported = false;
          this.elements.webauthnUnsupported.style.display = 'block';
        });
    } else {
      this.state.webauthnSupported = false;
      this.elements.webauthnBtn.disabled = true;
      this.elements.webauthnUnsupported.style.display = 'block';
    }
  }

  /**
   * Show login form
   */
  showLoginForm() {
    this.elements.btnContainer.style.display = 'none';
    this.elements.loginForm.style.display = 'block';
    this.elements.emailInput.focus();
    this.updateStatus('Enter your credentials', 'info');
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
      const response = await this.sendAuthRequest(email, password);
      
      if (response.success) {
        this.handleSuccessfulLogin(response.token, email);
      } else {
        this.handleFailedLogin(response.error);
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
   * Send authentication request to Cloudflare Worker
   */
  async sendAuthRequest(email, password) {
    const requestData = {
      email,
      password,
      clientInfo: this.state.clientInfo
    };

    const response = await fetch(this.env.WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-IP': this.state.clientInfo.ip,
        'X-Client-UA': this.state.clientInfo.userAgent
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Handle successful login
   */
  handleSuccessfulLogin(token, email) {
    // Store token
    localStorage.setItem(this.securityConfig.localStorageKey, token);
    
    // Reset security attempts
    this.securitySystem.resetAttempts();
    
    // Update UI
    this.updateStatus('Authentication successful!', 'success');
    this.elements.errorMsg.textContent = '';
    
    // Redirect to dashboard
    window.location.href = 'vfiles';
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
   * Initiate WebAuthn authentication
   */
  initiateWebAuthn() {
    if (!this.state.webauthnSupported) return;
    
    this.updateStatus('Initiating biometric authentication...', 'info');
    // Here you would implement actual WebAuthn authentication
    // For now, we'll simulate it
    setTimeout(() => {
      this.updateStatus('Please use your device biometric authenticator', 'info');
    }, 1000);
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

  getDefaultData() {
    return {
      attempts: 0,
      lastAttempt: null,
      blockUntil: null
    };
  }

  validateData(data) {
    return data && typeof data === 'object' && 
           'attempts' in data && 'lastAttempt' in data && 'blockUntil' in data;
  }

  saveAttemptData() {
    const expires = new Date();
    expires.setDate(expires.getDate() + 1);
    const data = encodeURIComponent(JSON.stringify(this.attemptData));
    document.cookie = `${this.cookieName}=${data}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure`;
  }

  getCookie(name) {
    return document.cookie.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(name + '='))
      ?.substring(name.length + 1);
  }

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

  resetAttempts() {
    this.attemptData = this.getDefaultData();
    this.saveAttemptData();
  }

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
