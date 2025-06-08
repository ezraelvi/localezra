// Configuration
const config = {
  cloudflareWorkerUrl: 'https://auth-logs.ezvvel.workers.dev/',
  supabaseUrl: 'https://hjmosjvfrycamxowfurq.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM',
  rateLimit: {
    attempts: 3,
    window: 5 * 60 * 1000 // 5 minutes
  },
  defaultRedirects: {
    ezra: 'dashboard/index.html',
    default: 'vfiles/index.html'
  }
};

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

class BioAuthSystem {
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
      registerWebauthn: document.getElementById('registerWebauthn'),
      unsupportedBrowser: document.getElementById('unsupportedBrowser')
    };

    this.security = {
      attempts: 0,
      lastAttempt: null,
      blockedUntil: null
    };

    this.init();
  }

  async init() {
    this.startBiometricAnimation();
    this.setupEventListeners();
    this.checkBrowserSupport();
    this.getClientInfo();
    this.checkExistingSession();
  }

  startBiometricAnimation() {
    this.elements.scanLine.style.opacity = '1';
    this.updateStatus('Initializing security protocols...');
    
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('Ready for authentication');
      this.elements.btnContainer.style.display = 'flex';
    }, 3000);
  }

  updateStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    if (type) this.elements.status.classList.add(type);
  }

  setupEventListeners() {
    // Form toggle
    this.elements.fallbackBtn.addEventListener('click', () => this.showLoginForm());
    this.elements.visitBtn.addEventListener('click', () => window.location.href = 'dashboard/index.html');
    
    // WebAuthn
    this.elements.webauthnBtn.addEventListener('click', () => this.handleWebAuthn());
    this.elements.registerWebauthn.addEventListener('click', () => this.registerWebAuthn());
    
    // Form submission
    this.elements.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
    
    // Password toggle
    this.elements.togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
  }

  async checkBrowserSupport() {
    if (!window.PublicKeyCredential) {
      this.elements.webauthnBtn.disabled = true;
      this.elements.unsupportedBrowser.style.display = 'block';
      return false;
    }
    
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        this.updateStatus('Biometric authenticator not found', 'warning');
        this.elements.webauthnBtn.disabled = true;
      }
      return available;
    } catch (error) {
      console.error('WebAuthn check failed:', error);
      return false;
    }
  }

  async handleWebAuthn() {
    if (this.isBlocked()) {
      this.showBlockedMessage();
      return;
    }

    this.setLoadingState(true, this.elements.webauthnBtn);
    
    try {
      // Check if user has registered WebAuthn
      const { data: user, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        this.updateStatus('Please login first to use biometric', 'warning');
        this.showLoginForm();
        return;
      }

      // Get challenge from Supabase
      const { data: challenge, error: challengeError } = await supabase
        .from('auth_challenges')
        .insert({ user_id: user.id, type: 'webauthn_get' })
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Get credentials from authenticator
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: Uint8Array.from(challenge.challenge, c => c.charCodeAt(0)),
          allowCredentials: [{
            type: 'public-key',
            id: Uint8Array.from(user.webauthn_id, c => c.charCodeAt(0)),
            transports: ['internal']
          }],
          userVerification: 'required'
        }
      });

      // Verify with Supabase
      const { data: verification, error: verifyError } = await supabase
        .rpc('verify_webauthn', {
          credential: JSON.stringify(credential),
          user_id: user.id
        });

      if (verifyError) throw verifyError;

      if (verification.verified) {
        this.handleSuccessfulAuth(user);
      } else {
        throw new Error('Biometric verification failed');
      }
    } catch (error) {
      console.error('WebAuthn error:', error);
      this.security.attempts++;
      this.updateStatus('Biometric login failed', 'error');
      this.elements.webauthnOptions.style.display = 'block';
    } finally {
      this.setLoadingState(false, this.elements.webauthnBtn);
    }
  }

  async registerWebAuthn() {
    try {
      const email = this.elements.emailInput.value.trim();
      if (!email) {
        this.updateStatus('Please enter your email first', 'warning');
        return;
      }

      this.setLoadingState(true, this.elements.registerWebauthn);
      
      // Get user from Supabase
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !user) throw new Error('User not found');

      // Get registration challenge from Supabase
      const { data: challenge, error: challengeError } = await supabase
        .from('auth_challenges')
        .insert({ user_id: user.id, type: 'webauthn_create' })
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Create new credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: Uint8Array.from(challenge.challenge, c => c.charCodeAt(0)),
          rp: { name: 'BioVAuth' },
          user: {
            id: Uint8Array.from(user.id, c => c.charCodeAt(0)),
            name: email,
            displayName: email
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 } // RS256
          ],
          authenticatorSelection: {
            userVerification: 'required',
            requireResidentKey: true
          }
        }
      });

      // Register credential with Supabase
      const { error: registerError } = await supabase
        .from('webauthn_credentials')
        .insert({
          user_id: user.id,
          credential_id: Array.from(new Uint8Array(credential.rawId)).join(','),
          public_key: JSON.stringify(credential.response.getPublicKey()),
          sign_count: credential.response.signCount
        });

      if (registerError) throw registerError;

      this.updateStatus('Biometric registration successful!', 'success');
      this.elements.webauthnOptions.style.display = 'none';
    } catch (error) {
      console.error('Registration error:', error);
      this.updateStatus('Failed to register biometric', 'error');
    } finally {
      this.setLoadingState(false, this.elements.registerWebauthn);
    }
  }

  async handleLogin() {
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
      // Send to Cloudflare Worker for validation
      const response = await fetch(config.cloudflareWorkerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-IP': await this.getClientIP(),
          'X-User-Agent': navigator.userAgent
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // If using Supabase auth
      if (data.supabase_token) {
        const { error } = await supabase.auth.setSession({
          access_token: data.supabase_token,
          refresh_token: data.refresh_token
        });

        if (error) throw error;
      }

      // Redirect based on user
      const redirectPath = config.defaultRedirects[email.split('@')[0]] || 
                         config.defaultRedirects.default;
      window.location.href = redirectPath;

    } catch (error) {
      console.error('Login error:', error);
      this.handleFailedLogin(error.message);
    } finally {
      this.setLoadingState(false);
    }
  }

  async checkExistingSession() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (!error && user) {
        this.updateStatus(`Welcome back, ${user.email}`, 'success');
        this.elements.visitBtn.disabled = false;
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      this.elements.ipDisplay.textContent = `IP: ${data.ip} • ${navigator.platform}`;
      return data.ip;
    } catch (error) {
      console.error('IP detection failed:', error);
      this.elements.ipDisplay.textContent = 'Network: Secure • Private';
      return 'unknown';
    }
  }

  isBlocked() {
    if (!this.security.blockedUntil) return false;
    return new Date() < new Date(this.security.blockedUntil);
  }

  showBlockedMessage() {
    const remaining = Math.ceil((new Date(this.security.blockedUntil) - new Date()) / 1000 / 60);
    this.showError(`Too many attempts. Try again in ${remaining} minutes.`);
  }

  showLoginForm() {
    this.elements.btnContainer.style.display = 'none';
    this.elements.loginForm.style.display = 'block';
    this.elements.emailInput.focus();
  }

  togglePasswordVisibility() {
    const isPassword = this.elements.passwordInput.type === 'password';
    this.elements.passwordInput.type = isPassword ? 'text' : 'password';
    this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
    this.elements.togglePassword.setAttribute('aria-label', 
      isPassword ? 'Hide password' : 'Show password');
  }

  setLoadingState(isLoading, element = null) {
    const target = element || this.elements.submitLogin;
    if (isLoading) {
      target.disabled = true;
      if (target.querySelector('.btn-text')) {
        target.querySelector('.btn-text').textContent = 'Processing...';
      }
      if (target.querySelector('.loading-spinner')) {
        target.querySelector('.loading-spinner').style.display = 'inline-block';
      }
    } else {
      target.disabled = false;
      if (target.querySelector('.btn-text')) {
        target.querySelector('.btn-text').textContent = target === this.elements.submitLogin ? 'Login' : 
                                                     target === this.elements.webauthnBtn ? 'Biometric Login' : 
                                                     'Register Biometric';
      }
      if (target.querySelector('.loading-spinner')) {
        target.querySelector('.loading-spinner').style.display = 'none';
      }
    }
  }

  showError(message) {
    this.elements.errorMsg.textContent = message;
    this.elements.loginForm.classList.add('shake');
    setTimeout(() => {
      this.elements.loginForm.classList.remove('shake');
    }, 500);
  }

  handleSuccessfulAuth(user) {
    this.updateStatus(`Welcome, ${user.email}!`, 'success');
    setTimeout(() => {
      const redirectPath = config.defaultRedirects[user.email.split('@')[0]] || 
                         config.defaultRedirects.default;
      window.location.href = redirectPath;
    }, 1000);
  }

  handleFailedLogin(message) {
    this.security.attempts++;
    this.security.lastAttempt = new Date().toISOString();
    
    if (this.security.attempts >= config.rateLimit.attempts) {
      this.security.blockedUntil = new Date(Date.now() + config.rateLimit.window).toISOString();
      this.showBlockedMessage();
    } else {
      const remaining = config.rateLimit.attempts - this.security.attempts;
      this.showError(`${message} (${remaining} ${remaining === 1 ? 'try' : 'tries'} left)`);
    }
    
    this.elements.passwordInput.value = '';
    this.elements.passwordInput.focus();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BioAuthSystem();
});
