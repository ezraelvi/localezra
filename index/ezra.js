class AuthSystem {
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
      usernameInput: document.getElementById('username'),
      passwordInput: document.getElementById('password'),
      submitLogin: document.getElementById('submitLogin'),
      loadingSpinner: document.querySelector('.loading-spinner'),
      errorMsg: document.getElementById('errorMsg'),
      ipDisplay: document.getElementById('ipDisplay'),
      togglePassword: document.querySelector('.toggle-password'),
      browserSupportWarning: document.getElementById('browserSupportWarning')
    };

    // Configuration
    this.config = {
      workerUrl: 'https://auth-logs.ezvvel.workers.dev/',
      maxAttempts: 3,
      blockDuration: 5 * 60 * 1000, // 5 minutes
      cookieName: 'authSecurity'
    };

    // State
    this.state = {
      isWebAuthnSupported: false,
      loginAttempts: 0,
      blockedUntil: null
    };

    // Initialize
    this.init();
  }

  async init() {
    // Start scan animation
    this.startScanAnimation();

    // Check browser capabilities
    this.checkBrowserSupport();

    // Setup event listeners
    this.setupEventListeners();

    // Get client info
    this.getClientInfo();

    // Check if already blocked
    this.checkBlockStatus();
  }

  startScanAnimation() {
    this.elements.scanLine.style.opacity = '1';
    this.updateStatus('Initializing security protocols...');
    
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('Ready for authentication');
      this.elements.btnContainer.style.display = 'flex';
    }, 2500);
  }

  async checkBrowserSupport() {
    // Check WebAuthn support
    this.state.isWebAuthnSupported = await this.checkWebAuthn();
    
    if (this.state.isWebAuthnSupported) {
      this.elements.webauthnBtn.style.display = 'flex';
    } else {
      this.elements.browserSupportWarning.style.display = 'block';
    }
  }

  async checkWebAuthn() {
    if (!window.PublicKeyCredential) return false;
    
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      console.error('WebAuthn check failed:', e);
      return false;
    }
  }

  setupEventListeners() {
    // Fallback to email login
    this.elements.fallbackBtn.addEventListener('click', () => this.showLoginForm());

    // Visit dashboard
    this.elements.visitBtn.addEventListener('click', () => {
      window.location.href = 'dashboard/index.html';
    });

    // WebAuthn button
    this.elements.webauthnBtn.addEventListener('click', () => {
      window.location.href = 'https://webauthn.me/browser-support';
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

  togglePasswordVisibility() {
    const isPassword = this.elements.passwordInput.type === 'password';
    this.elements.passwordInput.type = isPassword ? 'text' : 'password';
    this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
    this.elements.togglePassword.setAttribute('aria-label', 
      isPassword ? 'Hide password' : 'Show password');
  }

  async getClientInfo() {
    try {
      // Get IP address
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      // Get browser info
      const browserInfo = this.parseUserAgent();
      
      this.elements.ipDisplay.textContent = 
        `IP: ${ipData.ip} • Browser: ${browserInfo.name} ${browserInfo.version}`;
      
      // Store in session for audit logging
      sessionStorage.setItem('clientInfo', JSON.stringify({
        ip: ipData.ip,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting client info:', error);
      this.elements.ipDisplay.textContent = 'Secure connection established';
    }
  }

  parseUserAgent() {
    const ua = navigator.userAgent;
    let name = 'Unknown';
    let version = '';
    
    // Check Chrome
    if (ua.includes('Chrome')) {
      name = 'Chrome';
      version = ua.match(/Chrome\/(\d+)/)[1];
    } 
    // Check Firefox
    else if (ua.includes('Firefox')) {
      name = 'Firefox';
      version = ua.match(/Firefox\/(\d+)/)[1];
    }
    // Check Safari
    else if (ua.includes('Safari')) {
      name = 'Safari';
      version = ua.match(/Version\/(\d+)/)[1];
    }
    // Check Edge
    else if (ua.includes('Edg')) {
      name = 'Edge';
      version = ua.match(/Edg\/(\d+)/)[1];
    }
    
    return { name, version };
  }

  checkBlockStatus() {
    const blockData = this.getBlockData();
    
    if (blockData && blockData.blockedUntil > Date.now()) {
      this.state.blockedUntil = blockData.blockedUntil;
      this.state.loginAttempts = blockData.attempts;
      this.disableLogin(true);
      this.startBlockCountdown();
      return true;
    }
    
    return false;
  }

  getBlockData() {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${this.config.cookieName}=`));
    
    if (!cookie) return null;
    
    try {
      return JSON.parse(decodeURIComponent(cookie.split('=')[1]));
    } catch (e) {
      console.error('Error parsing block data:', e);
      return null;
    }
  }

  disableLogin(disabled) {
    this.elements.usernameInput.disabled = disabled;
    this.elements.passwordInput.disabled = disabled;
    this.elements.submitLogin.disabled = disabled;
    
    if (disabled) {
      this.elements.loginForm.classList.add('disabled');
    } else {
      this.elements.loginForm.classList.remove('disabled');
    }
  }

  startBlockCountdown() {
    const remaining = Math.ceil((this.state.blockedUntil - Date.now()) / 1000);
    
    const updateCountdown = () => {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      
      this.updateStatus(`Too many attempts. Try again in ${minutes}m ${seconds}s`, 'error');
      
      if (remaining <= 0) {
        clearInterval(interval);
        this.state.blockedUntil = null;
        this.state.loginAttempts = 0;
        this.disableLogin(false);
        this.updateStatus('Ready for authentication');
        document.cookie = `${this.config.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure`;
      }
      
      remaining--;
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
  }

  showLoginForm() {
    this.elements.btnContainer.style.display = 'none';
    this.elements.loginForm.style.display = 'block';
    this.elements.usernameInput.focus();
    this.updateStatus('Enter your credentials');
  }

  async handleLogin() {
    // Check if blocked
    if (this.state.blockedUntil && this.state.blockedUntil > Date.now()) {
      this.startBlockCountdown();
      return;
    }
    
    const username = this.elements.usernameInput.value.trim();
    const password = this.elements.passwordInput.value;
    
    // Basic validation
    if (!username || !password) {
      this.showError('Please fill in all fields');
      return;
    }
    
    // Show loading state
    this.setLoadingState(true);
    
    try {
      // Send to Cloudflare Worker
      const response = await this.sendAuthRequest(username, password);
      
      if (response.success) {
        this.handleSuccess(response);
      } else {
        this.handleFailure(response.error);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.showError('Network error. Please try again.');
      this.recordFailedAttempt();
    } finally {
      this.setLoadingState(false);
    }
  }

  async sendAuthRequest(username, password) {
    const clientInfo = JSON.parse(sessionStorage.getItem('clientInfo') || {};
    
    const response = await fetch(this.config.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-IP': clientInfo.ip || '',
        'X-User-Agent': clientInfo.userAgent || ''
      },
      body: JSON.stringify({ username, password })
    });
    
    return response.json();
  }

  handleSuccess(response) {
    // Reset attempts
    this.state.loginAttempts = 0;
    document.cookie = `${this.config.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure`;
    
    // Store session token
    sessionStorage.setItem('authToken', response.token);
    
    // Update UI
    this.updateStatus('Authentication successful!', 'success');
    this.elements.errorMsg.textContent = '';
    
    // Redirect based on username
    setTimeout(() => {
      if (response.username === 'ezra') {
        window.location.href = 'dashboard/index.html';
      } else {
        window.location.href = 'dashboard/general.html';
      }
    }, 1000);
  }

  handleFailure(error) {
    this.recordFailedAttempt();
    
    const attemptsLeft = this.config.maxAttempts - this.state.loginAttempts;
    const errorMsg = attemptsLeft > 0 
      ? `${error} (${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left)`
      : 'Too many failed attempts. Account temporarily locked.';
    
    this.showError(errorMsg);
    
    if (this.state.loginAttempts >= this.config.maxAttempts) {
      this.disableLogin(true);
      this.startBlockCountdown();
    }
    
    // Shake form for visual feedback
    this.elements.loginForm.classList.add('shake');
    setTimeout(() => {
      this.elements.loginForm.classList.remove('shake');
    }, 500);
  }

  recordFailedAttempt() {
    this.state.loginAttempts++;
    
    if (this.state.loginAttempts >= this.config.maxAttempts) {
      this.state.blockedUntil = Date.now() + this.config.blockDuration;
      
      // Set cookie with block info
      const blockData = {
        attempts: this.state.loginAttempts,
        blockedUntil: this.state.blockedUntil,
        timestamp: new Date().toISOString()
      };
      
      document.cookie = `${this.config.cookieName}=${encodeURIComponent(JSON.stringify(blockData))}; ` +
        `max-age=${this.config.blockDuration / 1000}; path=/; Secure; SameSite=Strict`;
    }
  }

  setLoadingState(isLoading) {
    if (isLoading) {
      this.elements.submitLogin.disabled = true;
      this.elements.loadingSpinner.style.display = 'inline-block';
      this.elements.submitLogin.querySelector('.btn-text').textContent = 'Verifying...';
    } else {
      this.elements.submitLogin.disabled = false;
      this.elements.loadingSpinner.style.display = 'none';
      this.elements.submitLogin.querySelector('.btn-text').textContent = 'Authenticate';
    }
  }

  updateStatus(message, type) {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    
    if (type) {
      this.elements.status.classList.add(type);
    }
  }

  showError(message) {
    this.elements.errorMsg.textContent = message;
    this.elements.errorMsg.style.display = 'block';
    
    setTimeout(() => {
      if (this.elements.errorMsg.textContent === message) {
        this.elements.errorMsg.style.display = 'none';
      }
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AuthSystem();
});
