/**
 * BioVAuth - Secure Biometric Authentication System
 * Main Application Script
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
    this.updateStatus('Scanning biometric patterns...', 'info');
    
    // Simulate biometric scan completion
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('Biometric scan complete <> Tap Your Fingerprint', 'success');
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

    // Visit dashboard (initially disabled)
    this.elements.visitBtn.addEventListener('click', () => {
      window.location.href = 'dashboard/index.html';
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
          this.elements.visitBtn.disabled = false;
          
          // Enable dashboard button for 5 seconds
          setTimeout(() => {
            window.location.href = 'dashboard/index.html';
          }, 5000);
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
   * @param {string} token - Authentication token
   */
  async validateAuthToken(token) {
    // In a real app, this would call your backend API
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate token validation
        resolve(Math.random() > 0.3); // 70% chance of valid token for demo
      }, 500);
    });
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
      // Simulate API call
      const response = await this.mockLoginAPI(email, password);
      
      if (response.success) {
        // Successful login
        this.handleSuccessfulLogin(response.token, email);
      } else {
        // Failed login
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
   * Mock login API (replace with real API call)
   */
  async mockLoginAPI(email, password) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate API response
        const isValid = password.length >= 8 && email.includes('@');
        
        if (isValid) {
          resolve({
            success: true,
            token: this.generateAuthToken(),
            user: { email }
          });
        } else {
          resolve({
            success: false,
            error: 'Invalid credentials'
          });
        }
      }, 1500);
    });
  }

  /**
   * Generate mock auth token
   */
  generateAuthToken() {
    return 'mock-token-' + Math.random().toString(36).substring(2) + 
           '-' + Date.now().toString(36);
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
    
    // Redirect to dashboard after delay
    setTimeout(() => {
      window.location.href = 'dashboard/index.html';
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
   * Initialize placeholder rotation
   */
  initPlaceholderRotation() {
    const placeholders = [
      "Enter your email",
      "username@example.com",
      "your.login@domain.com",
      "user.name@company.org"
    ];
    
    let currentIndex = 0;
    
    setInterval(() => {
      this.elements.emailInput.placeholder = placeholders[currentIndex];
      currentIndex = (currentIndex + 1) % placeholders.length;
    }, 3000);
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
   * Check WebAuthn support
   */
  checkWebAuthnSupport(showAlert = false) {
    if (window.PublicKeyCredential) {
      const isSupported = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      isSupported.then((available) => {
        if (available) {
          if (showAlert) {
            alert('WebAuthn is supported! You can use biometric authentication.');
          }
          this.updateStatus('WebAuthn/biometric authentication available', 'success');
        } else {
          if (showAlert) {
            alert('WebAuthn is supported but no biometric authenticator found.');
          }
          this.updateStatus('No biometric authenticator detected', 'warning');
        }
      }).catch(() => {
        if (showAlert) {
          alert('Error checking WebAuthn support.');
        }
        this.updateStatus('Error checking WebAuthn', 'error');
      });
    } else {
      if (showAlert) {
        alert('WebAuthn is not supported in your browser.');
      }
      this.updateStatus('WebAuthn not supported', 'error');
    }
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
  // Initialize particles.js
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: '#00a8ff' },
        shape: { type: 'circle' },
        opacity: { value: 0.3, random: true },
        size: { value: 3, random: true },
        line_linked: { 
          enable: true, 
          distance: 150, 
          color: '#00a8ff', 
          opacity: 0.2, 
          width: 1 
        },
        move: { 
          enable: true, 
          speed: 2, 
          direction: 'none', 
          random: true, 
          straight: false, 
          out_mode: 'out' 
        }
      },
      interactivity: {
        detect_on: 'canvas',
        events: {
          onhover: { enable: true, mode: 'repulse' },
          onclick: { enable: true, mode: 'push' }
        }
      }
    });
  }

  // Initialize BioVAuth application
  new BioVAuth();
});

// Easter egg - Secret gesture detection
let gestureCount = 0;
let lastGestureTime = 0;

window.addEventListener('keydown', (e) => {
  const now = Date.now();
  
  // Detect Konami code sequence
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
      e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (now - lastGestureTime > 1000) {
      gestureCount = 0;
    }
    
    gestureCount++;
    lastGestureTime = now;
    
    if (gestureCount >= 6) {
      gestureCount = 0;
      this.activateEasterEgg();
    }
  }
});

/**
 * Activate easter egg
 */
function activateEasterEgg() {
  if (confirm('🎉 You found a secret! Activate party mode?')) {
    particlesJS('particles-js', {
      particles: {
        number: { value: 30, density: { enable: false } },
        color: { value: '#ff69b4' },
        shape: {
          type: 'image',
          image: {
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 29.6"><path fill="%23ff69b4" d="M23.6 0c-2.7 0-5 1.7-6 4.1C16.4 1.7 14.1 0 11.4 0 6.4 0 2.4 4 2.4 9c0 7.1 9.6 13.6 13.6 20.6 4-7 13.6-13.5 13.6-20.6 0-5-4-9-9-9z"/></svg>',
            width: 32,
            height: 29.6
          }
        },
        opacity: { value: 0.8, random: true, anim: { enable: true, speed: 1, opacity_min: 0, sync: false } },
        size: { value: 15, random: true, anim: { enable: true, speed: 5, size_min: 5, sync: false } },
        move: { enable: true, speed: 3, direction: 'top', random: true, straight: false, out_mode: 'out', bounce: false }
      },
      interactivity: {
        detect_on: 'canvas',
        events: { onhover: { enable: false }, onclick: { enable: false } }
      },
      retina_detect: true
    });
    
    document.body.style.background = 'linear-gradient(135deg, #ff69b4, #8a2be2)';
    document.querySelector('.container').style.animation = 'rainbowBorder 2s linear infinite';
    
    // Add rainbow border animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes rainbowBorder {
        0% { box-shadow: 0 0 20px 5px #ff0000; }
        14% { box-shadow: 0 0 20px 5px #ff7f00; }
        28% { box-shadow: 0 0 20px 5px #ffff00; }
        42% { box-shadow: 0 0 20px 5px #00ff00; }
        57% { box-shadow: 0 0 20px 5px #0000ff; }
        71% { box-shadow: 0 0 20px 5px #4b0082; }
        85% { box-shadow: 0 0 20px 5px #9400d3; }
        100% { box-shadow: 0 0 20px 5px #ff0000; }
      }
    `;
    document.head.appendChild(style);
    
    // Play celebration sound if available
    if (typeof Audio !== 'undefined') {
      const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  }
}
