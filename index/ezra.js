// Configuration
const config = {
  cloudflareWorkerUrl: 'https://auth-logs.ezvvel.workers.dev/',
  supabaseUrl: 'https://hjmosjvfrycamxowfurq.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM',
  rateLimit: {
    attempts: 3,
    windowMinutes: 5
  },
  redirects: {
    dashboard: 'dashboard/index.html',
    vfiles: 'vfiles/index.html',
    webauthnInfo: 'https://webauthn.me/browser-support'
  }
};

// Supabase Client
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

class AuthSystem {
  constructor() {
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
      webauthnSection: document.getElementById('webauthnSection'),
      registerWebauthnBtn: document.getElementById('registerWebauthnBtn'),
      webauthnInfo: document.getElementById('webauthnInfo')
    };

    this.security = {
      attempts: 0,
      lastAttempt: null,
      blockedUntil: null
    };

    this.supportsWebAuthn = false;
    this.init();
  }

  async init() {
    this.checkWebAuthnSupport();
    this.setupEventListeners();
    this.getClientInfo();
    this.startBiometricAnimation();
    
    // Check existing session
    const session = localStorage.getItem('authSession');
    if (session) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          this.redirectAuthenticatedUser(data.session.user);
        }
      } catch (e) {
        console.error('Session check error:', e);
      }
    }
  }

  async checkWebAuthnSupport() {
    if (window.PublicKeyCredential && 
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && 
        PublicKeyCredential.isConditionalMediationAvailable) {
      try {
        const [isUVPAA, isCMA] = await Promise.all([
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
          PublicKeyCredential.isConditionalMediationAvailable()
        ]);
        
        this.supportsWebAuthn = isUVPAA && isCMA;
        
        if (this.supportsWebAuthn) {
          this.elements.webauthnBtn.disabled = false;
          this.updateStatus('Biometric authentication available', 'success');
          this.setupWebAuthnAutoFill();
        } else {
          this.disableWebAuthnFeatures();
        }
      } catch (e) {
        console.error('WebAuthn check failed:', e);
        this.disableWebAuthnFeatures();
      }
    } else {
      this.disableWebAuthnFeatures();
    }
  }

  disableWebAuthnFeatures() {
    this.supportsWebAuthn = false;
    this.elements.webauthnBtn.disabled = true;
    this.elements.webauthnBtn.innerHTML = '<span class="icon">❌</span> Biometric Not Supported';
    this.updateStatus('Biometric auth not supported', 'warning');
  }

  async setupWebAuthnAutoFill() {
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'webauthn',
        options: {
          shouldCreateUser: false,
          skipBrowserRedirect: true
        }
      });
      
      if (data && data.session) {
        this.handleSuccessfulAuth(data.session);
      }
    } catch (e) {
      console.log('Auto-fill attempt failed or no credentials found');
    }
  }

  setupEventListeners() {
    // Form submission
    this.elements.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormLogin();
    });

    // Button events
    this.elements.fallbackBtn.addEventListener('click', () => this.showLoginForm());
    this.elements.visitBtn.addEventListener('click', () => window.location.href = config.redirects.dashboard);
    this.elements.webauthnBtn.addEventListener('click', () => this.handleWebAuthnLogin());
    this.elements.registerWebauthnBtn.addEventListener('click', () => this.registerWebAuthn());
    this.elements.togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
  }

  async handleFormLogin() {
    if (this.isBlocked()) {
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
      // Cloudflare Worker authentication
      const response = await fetch(config.cloudflareWorkerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-IP': this.clientIp || '',
          'X-User-Agent': navigator.userAgent
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.handleSuccessfulAuth(data);
        
        // Special case for "ezra" user
        if (email.toLowerCase() === 'ezra' && password === 'admin') {
          window.location.href = config.redirects.dashboard;
          return;
        }
        
        // Default redirect
        window.location.href = data.redirectUrl || config.redirects.vfiles;
      } else {
        this.handleFailedLogin(data.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.handleFailedLogin('Network error. Please try again.');
    } finally {
      this.setLoadingState(false);
    }
  }

  async handleWebAuthnLogin() {
    if (!this.supportsWebAuthn) {
      window.open(config.redirects.webauthnInfo, '_blank');
      return;
    }

    this.setLoadingState(true, 'Authenticating with biometric...');

    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'webauthn',
        options: {
          shouldCreateUser: false,
          skipBrowserRedirect: true
        }
      });

      if (error) throw error;
      
      if (data && data.session) {
        this.handleSuccessfulAuth(data.session);
        window.location.href = config.redirects.vfiles;
      } else {
        this.showWebAuthnSection();
        this.elements.webauthnInfo.textContent = 'No biometric credentials found. Please register.';
      }
    } catch (error) {
      console.error('WebAuthn error:', error);
      this.showError('Biometric authentication failed');
      this.showWebAuthnSection();
    } finally {
      this.setLoadingState(false);
    }
  }

  async registerWebAuthn() {
    this.setLoadingState(true, 'Registering biometric...');

    try {
      const email = this.elements.emailInput.value.trim();
      if (!email) {
        throw new Error('Please enter your email first');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        options: {
          webauthn: {
            skipBrowserRedirect: true,
            shouldCreateUser: true
          }
        }
      });

      if (error) throw error;
      
      if (data && data.session) {
        this.handleSuccessfulAuth(data.session);
        this.updateStatus('Biometric registration successful!', 'success');
        setTimeout(() => {
          window.location.href = config.redirects.vfiles;
        }, 1500);
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.showError(error.message || 'Biometric registration failed');
    } finally {
      this.setLoadingState(false);
    }
  }

  handleSuccessfulAuth(authData) {
    this.resetSecurityCounters();
    
    // Store session
    localStorage.setItem('authSession', JSON.stringify(authData));
    
    // Update UI
    this.updateStatus('Authentication successful!', 'success');
    this.elements.errorMsg.textContent = '';
  }

  handleFailedLogin(error) {
    this.recordFailedAttempt();
    
    const attemptsLeft = config.rateLimit.attempts - this.security.attempts;
    const errorMessage = `${error} (${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left)`;
    
    this.showError(errorMessage);
    
    if (this.isBlocked()) {
      this.showBlockedMessage();
    }
    
    this.elements.passwordInput.value = '';
    this.elements.loginForm.classList.add('shake');
    setTimeout(() => {
      this.elements.loginForm.classList.remove('shake');
    }, 500);
  }

  redirectAuthenticatedUser(user) {
    this.updateStatus(`Welcome back, ${user.email}! Redirecting...`, 'success');
    setTimeout(() => {
      window.location.href = config.redirects.vfiles;
    }, 1000);
  }

  showWebAuthnSection() {
    this.elements.loginForm.style.display = 'none';
    this.elements.webauthnSection.style.display = 'block';
  }

  showLoginForm() {
    this.elements.btnContainer.style.display = 'none';
    this.elements.loginForm.style.display = 'block';
    this.elements.emailInput.focus();
    this.updateStatus('Enter your credentials', 'info');
  }

  // Security methods
  isBlocked() {
    if (!this.security.blockedUntil) return false;
    return new Date() < new Date(this.security.blockedUntil);
  }

  recordFailedAttempt() {
    const now = new Date();
    this.security.attempts++;
    this.security.lastAttempt = now;

    if (this.security.attempts >= config.rateLimit.attempts) {
      const blockUntil = new Date(now.getTime() + config.rateLimit.windowMinutes * 60000);
      this.security.blockedUntil = blockUntil;
    }
  }

  resetSecurityCounters() {
    this.security = {
      attempts: 0,
      lastAttempt: null,
      blockedUntil: null
    };
  }

  showBlockedMessage() {
    const remainingMs = new Date(this.security.blockedUntil) - new Date();
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    
    this.showError(`Too many attempts. Please wait ${minutes}m ${seconds}s.`);
    this.elements.submitLogin.disabled = true;
    
    const countdown = setInterval(() => {
      const newRemaining = new Date(this.security.blockedUntil) - new Date();
      if (newRemaining <= 0) {
        clearInterval(countdown);
        this.resetSecurityCounters();
        this.elements.errorMsg.textContent = '';
        this.elements.submitLogin.disabled = false;
        return;
      }
      
      const newMinutes = Math.floor(newRemaining / 60000);
      const newSeconds = Math.floor((newRemaining % 60000) / 1000);
      this.elements.errorMsg.textContent = `Too many attempts. Please wait ${newMinutes}m ${newSeconds}s.`;
    }, 1000);
  }

  // UI Helpers
  updateStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    if (type) this.elements.status.classList.add(type);
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

  setLoadingState(isLoading, text = 'Authenticating...') {
    if (isLoading) {
      this.elements.submitLogin.disabled = true;
      this.elements.loadingSpinner.style.display = 'inline-block';
      this.elements.submitLogin.querySelector('.btn-text').textContent = text;
    } else {
      this.elements.submitLogin.disabled = false;
      this.elements.loadingSpinner.style.display = 'none';
      this.elements.submitLogin.querySelector('.btn-text').textContent = 'Login';
    }
  }

  togglePasswordVisibility() {
    const isPassword = this.elements.passwordInput.type === 'password';
    this.elements.passwordInput.type = isPassword ? 'text' : 'password';
    this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
    this.elements.togglePassword.setAttribute('aria-label', 
      isPassword ? 'Hide password' : 'Show password');
  }

  startBiometricAnimation() {
    this.elements.scanLine.style.opacity = '1';
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.elements.btnContainer.style.display = 'flex';
    }, 3000);
  }

  async getClientInfo() {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      this.clientIp = ipData.ip;
      this.elements.ipDisplay.textContent = `IP: ${ipData.ip} • Browser: ${navigator.userAgent.split(' ')[0]}`;
    } catch (error) {
      console.error('Error fetching IP:', error);
      this.elements.ipDisplay.textContent = 'Network: Secure • Private';
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AuthSystem();
});
