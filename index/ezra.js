/**
 * BioVAuth - Enhanced Authentication System
 * ezra.js - Main Application Script
 */

class BioVAuth {
  constructor() {
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
      togglePassword: document.querySelector('.toggle-password')
    };

    // Security Configuration
    this.securityConfig = {
      maxAttempts: 3,
      blockDuration: 5 * 60 * 1000, // 5 minutes
      cookieName: 'bioVAuthSecurity',
      localStorageKey: 'bioVAuthSession',
      guestRedirect: 'dashboard.html?mode=guest',
      authRedirect: 'dashboard.html?mode=user'
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

    // Check authentication status
    await this.checkAuthentication();

    // Get client IP address
    this.getClientIP();

    // Initialize security system
    this.securitySystem = new SecuritySystem(
      this.securityConfig.maxAttempts,
      this.securityConfig.blockDuration,
      this.securityConfig.cookieName
    );

    // Initialize placeholder rotation
    this.initPlaceholderRotation();

    // Initialize password toggle
    this.initPasswordToggle();

    // Check WebAuthn support
    this.checkWebAuthnSupport();
  }

  /**
   * Start biometric scanning animation
   */
  startBiometricAnimation() {
    this.elements.scanLine.style.opacity = '1';
    this.updateStatus('Initializing biometric scan...', 'info');
    
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('Biometric ready', 'success');
      this.elements.btnContainer.style.display = 'flex';
    }, 3000);
  }

  /**
   * Update status message
   */
  updateStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    this.elements.status.classList.add(type);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Fallback to email login
    this.elements.fallbackBtn.addEventListener('click', () => {
      this.showLoginForm();
    });

    // Visit dashboard (always clickable)
    this.elements.visitBtn.addEventListener('click', () => {
      this.redirectToDashboard();
    });

    // Check WebAuthn support
    this.elements.webauthnBtn.addEventListener('click', () => {
      this.checkWebAuthnSupport(true);
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

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.activeElement === this.elements.passwordInput) {
        this.elements.passwordInput.blur();
      }
    });
  }

  /**
   * Redirect to appropriate dashboard version
   */
  redirectToDashboard() {
    const isAuthenticated = !!localStorage.getItem(this.securityConfig.localStorageKey);
    const redirectUrl = isAuthenticated 
      ? this.securityConfig.authRedirect 
      : this.securityConfig.guestRedirect;
    
    // Add fade-out effect
    document.body.style.opacity = '0.8';
    document.body.style.transition = 'opacity 0.3s ease';
    
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 300);
  }

  /**
   * Check authentication status
   */
  async checkAuthentication() {
    const authToken = localStorage.getItem(this.securityConfig.localStorageKey);
    
    if (authToken) {
      try {
        const isValid = await this.validateAuthToken(authToken);
        if (isValid) {
          this.updateStatus('Welcome back!', 'success');
          this.updateDashboardButton(true);
        } else {
          localStorage.removeItem(this.securityConfig.localStorageKey);
          this.updateDashboardButton(false);
        }
      } catch (error) {
        console.error('Token validation error:', error);
      }
    }
  }

  /**
   * Update dashboard button appearance
   */
  updateDashboardButton(isAuthenticated) {
    const btn = this.elements.visitBtn;
    if (isAuthenticated) {
      btn.innerHTML = '<span class="icon">🚀</span> My Dashboard';
      btn.classList.add('authenticated');
      btn.classList.remove('guest');
    } else {
      btn.innerHTML = '<span class="icon">👀</span> Guest Dashboard';
      btn.classList.add('guest');
      btn.classList.remove('authenticated');
    }
  }

  /**
   * Handle login form submission
   */
  async handleLogin() {
    if (this.securitySystem.isBlocked()) {
      this.showBlockedMessage();
      return;
    }

    const email = this.elements.emailInput.value.trim();
    const password = this.elements.passwordInput.value;

    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.setLoadingState(true);

    try {
      const response = await this.mockLoginAPI(email, password);
      
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
   * Handle successful login
   */
  handleSuccessfulLogin(token, email) {
    localStorage.setItem(this.securityConfig.localStorageKey, token);
    this.securitySystem.resetAttempts();
    this.updateStatus('Login successful!', 'success');
    this.updateDashboardButton(true);
    
    // Optional: Auto-redirect after delay
    setTimeout(() => {
      this.redirectToDashboard();
    }, 1500);
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
   * Get client IP address
   */
  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      this.elements.ipDisplay.textContent = `IP: ${data.ip} • ${navigator.userAgent.split(' ')[0]}`;
    } catch (error) {
      console.error('Error fetching IP:', error);
      this.elements.ipDisplay.textContent = 'Network: Secure • Private';
    }
  }
}

// Security System Class (unchanged from previous)
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
      return cookieData ? JSON.parse(decodeURIComponent(cookieData)) : this.getDefaultData();
    } catch (e) {
      return this.getDefaultData();
    }
  }

  getDefaultData() {
    return { attempts: 0, lastAttempt: null, blockUntil: null };
  }

  saveAttemptData() {
    const expires = new Date();
    expires.setDate(expires.getDate() + 1);
    document.cookie = `${this.cookieName}=${encodeURIComponent(JSON.stringify(this.attemptData))}; expires=${expires.toUTCString()}; path=/; Secure`;
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
    return new Date() < blockUntil;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize particles.js if available
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: '#00a8ff' },
        opacity: { value: 0.3, random: true },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#00a8ff', opacity: 0.2, width: 1 },
        move: { enable: true, speed: 2, random: true, straight: false }
      },
      interactivity: {
        events: {
          onhover: { enable: true, mode: 'repulse' },
          onclick: { enable: true, mode: 'push' }
        }
      }
    });
  }

  // Initialize BioVAuth
  new BioVAuth();
});

// Easter Egg (Konami Code)
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
  if (e.key === konamiCode[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konamiCode.length) {
      konamiIndex = 0;
      activateEasterEgg();
    }
  } else {
    konamiIndex = 0;
  }
});

function activateEasterEgg() {
  if (confirm('🎉 Secret mode activated! Enable party mode?')) {
    document.body.classList.add('party-mode');
    setTimeout(() => {
      document.body.classList.remove('party-mode');
    }, 10000);
  }
}
