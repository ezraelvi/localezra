// Supabase Configuration
const SUPABASE_URL = 'https://hjmosjvfrycamxowfurq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Cloudflare Worker Endpoint
const WORKER_URL = 'https://auth-logs.ezvvel.workers.dev/';

class BioVAuth {
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
      webauthnOptions: document.getElementById('webauthnOptions'),
      registerWebauthn: document.getElementById('registerWebauthn')
    };

    this.securityConfig = {
      maxAttempts: 3,
      blockDuration: 5 * 60 * 1000,
      cookieName: 'bioVAuthSecurity'
    };

    this.init();
  }

  async init() {
    this.startBiometricAnimation();
    this.setupEventListeners();
    this.getClientIP();
    this.securitySystem = new SecuritySystem(
      this.securityConfig.maxAttempts,
      this.securityConfig.blockDuration,
      this.securityConfig.cookieName
    );
    this.initPasswordToggle();
    this.checkWebAuthnSupport();
  }

  startBiometricAnimation() {
    this.elements.scanLine.style.opacity = '1';
    this.updateStatus('Initializing security protocols...', 'info');
    
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('Ready for authentication', 'success');
      this.elements.btnContainer.style.display = 'flex';
    }, 3000);
  }

  updateStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    this.elements.status.classList.add(type);
  }

  setupEventListeners() {
    // Fallback to email login
    this.elements.fallbackBtn.addEventListener('click', () => {
      this.showLoginForm();
    });

    // Visit dashboard
    this.elements.visitBtn.addEventListener('click', () => {
      window.location.href = 'dashboard/index.html';
    });

    // WebAuthn login
    this.elements.webauthnBtn.addEventListener('click', async () => {
      await this.handleWebAuthnLogin();
    });

    // Form submission
    this.elements.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Register WebAuthn
    this.elements.registerWebauthn.addEventListener('click', async () => {
      await this.registerWebAuthn();
    });

    // Password toggle
    this.elements.togglePassword.addEventListener('click', () => {
      this.togglePasswordVisibility();
    });
  }

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
      const response = await fetch(`${WORKER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.handleSuccessfulLogin(data.redirect);
      } else {
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

  async handleWebAuthnLogin() {
    this.updateStatus('Initiating biometric authentication...', 'info');
    
    try {
      // Check if user has registered WebAuthn
      const { data: user, error } = await supabase
        .from('users')
        .select('webauthn_id')
        .eq('email', this.elements.emailInput.value.trim())
        .single();

      if (error || !user?.webauthn_id) {
        this.showError('No biometric credentials found. Please register first.');
        this.elements.webauthnOptions.style.display = 'block';
        return;
      }

      // Get challenge from Supabase
      const { data: challengeData, error: challengeError } = await supabase
        .rpc('create_webauthn_challenge')
        .single();

      if (challengeError) throw challengeError;

      // Perform authentication
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: Uint8Array.from(challengeData.challenge, c => c.charCodeAt(0)),
          allowCredentials: [{
            id: Uint8Array.from(atob(user.webauthn_id), c => c.charCodeAt(0)),
            type: 'public-key'
          }],
          timeout: 60000,
          userVerification: 'required'
        }
      });

      // Verify with Supabase
      const { data: verifyData, error: verifyError } = await supabase
        .rpc('verify_webauthn_authentication', {
          credential_id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          authenticator_data: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))),
          client_data_json: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
          signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature))),
          user_id: user.id
        });

      if (verifyError) throw verifyError;

      if (verifyData.verified) {
        window.location.href = 'vfiles/index.html';
      } else {
        this.showError('Biometric verification failed');
      }
    } catch (error) {
      console.error('WebAuthn error:', error);
      this.showError('Biometric authentication failed. Try email login.');
      this.elements.webauthnOptions.style.display = 'block';
    }
  }

  async registerWebAuthn() {
    const email = this.elements.emailInput.value.trim();
    const password = this.elements.passwordInput.value;

    if (!email || !password) {
      this.showError('Please fill in email and password first');
      return;
    }

    this.updateStatus('Registering biometric credentials...', 'info');

    try {
      // First verify credentials with Cloudflare Worker
      const verifyResponse = await fetch(`${WORKER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        throw new Error('Invalid credentials');
      }

      // Get challenge from Supabase
      const { data: challengeData, error: challengeError } = await supabase
        .rpc('create_webauthn_challenge')
        .single();

      if (challengeError) throw challengeError;

      // Create new credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: Uint8Array.from(challengeData.challenge, c => c.charCodeAt(0)),
          rp: { name: "BioVAuth" },
          user: {
            id: Uint8Array.from(crypto.getRandomValues(new Uint8Array(32))),
            name: email,
            displayName: email
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },  // ES256
            { type: "public-key", alg: -257 }  // RS256
          ],
          timeout: 60000,
          attestation: "direct"
        }
      });

      // Register with Supabase
      const { error: registerError } = await supabase
        .from('users')
        .upsert({
          email: email,
          webauthn_id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          public_key: credential.response.getPublicKey(),
          sign_count: credential.response.signCount
        });

      if (registerError) throw registerError;

      this.updateStatus('Biometric registration successful!', 'success');
      this.elements.webauthnOptions.style.display = 'none';
    } catch (error) {
      console.error('Registration error:', error);
      this.showError('Biometric registration failed: ' + error.message);
    }
  }

  handleSuccessfulLogin(redirectPath) {
    this.securitySystem.resetAttempts();
    this.updateStatus('Authentication successful!', 'success');
    this.elements.errorMsg.textContent = '';
    
    setTimeout(() => {
      window.location.href = redirectPath || 'dashboard/index.html';
    }, 1000);
  }

  handleFailedLogin(error) {
    this.securitySystem.recordFailedAttempt();
    const attemptsLeft = this.securitySystem.maxAttempts - this.securitySystem.attemptData.attempts;
    const errorMessage = `${error} (${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left)`;
    
    this.showError(errorMessage);
    
    if (this.securitySystem.isBlocked()) {
      this.showBlockedMessage();
    }
    
    this.elements.passwordInput.value = '';
    this.elements.passwordInput.focus();
    this.elements.loginForm.classList.add('shake');
    setTimeout(() => {
      this.elements.loginForm.classList.remove('shake');
    }, 500);
  }

  showBlockedMessage() {
    const remainingTime = this.securitySystem.getRemainingBlockTime();
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    
    this.showError(`Too many attempts. Please wait ${minutes}m ${seconds}s.`);
    this.setLoadingState(false);
    this.elements.submitLogin.disabled = true;
    
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

  showError(message) {
    this.elements.errorMsg.textContent = message;
    this.elements.errorMsg.style.display = 'block';
    
    setTimeout(() => {
      if (this.elements.errorMsg.textContent === message) {
        this.elements.errorMsg.style.display = 'none';
      }
    }, 5000);
  }

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

  showLoginForm() {
    this.elements.btnContainer.style.display = 'none';
    this.elements.loginForm.style.display = 'block';
    this.elements.emailInput.focus();
    this.updateStatus('Enter your credentials', 'info');
  }

  initPasswordToggle() {
    this.elements.togglePassword.addEventListener('click', () => {
      const isPassword = this.elements.passwordInput.type === 'password';
      this.elements.passwordInput.type = isPassword ? 'text' : 'password';
      this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
      this.elements.togglePassword.setAttribute('aria-label', 
        isPassword ? 'Hide password' : 'Show password');
    });
  }

  togglePasswordVisibility() {
    const isPassword = this.elements.passwordInput.type === 'password';
    this.elements.passwordInput.type = isPassword ? 'text' : 'password';
    this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
    this.elements.togglePassword.setAttribute('aria-label', 
      isPassword ? 'Hide password' : 'Show password');
  }

  async checkWebAuthnSupport() {
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          this.updateStatus('Biometric authentication available', 'success');
        } else {
          this.updateStatus('No biometric authenticator detected', 'warning');
        }
      } catch (error) {
        this.updateStatus('Error checking biometric support', 'error');
      }
    } else {
      this.updateStatus('Biometric authentication not supported', 'error');
    }
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      this.elements.ipDisplay.textContent = `Your IP: ${data.ip}`;
    } catch (error) {
      console.error('Error fetching IP:', error);
      this.elements.ipDisplay.textContent = 'Network: Secure • Private';
    }
  }
}

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BioVAuth();
});
