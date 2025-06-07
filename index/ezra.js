// Supabase Configuration
const supabaseUrl = 'https://hjmosjvfrycamxowfurq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Cloudflare Worker Endpoint
const CLOUDFLARE_WORKER_URL = 'https://auth-logs.ezvvel.workers.dev/';

class BioAuthSystem {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.checkWebAuthnSupport();
    this.startBiometricAnimation();
  }

  initElements() {
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
      registerWebauthn: document.getElementById('registerWebauthn'),
      webauthnOptions: document.getElementById('webauthnOptions'),
      unsupportedBrowser: document.getElementById('unsupportedBrowser'),
      togglePassword: document.querySelector('.toggle-password')
    };
  }

  initEventListeners() {
    this.elements.fallbackBtn.addEventListener('click', () => this.showLoginForm());
    this.elements.visitBtn.addEventListener('click', () => window.location.href = '/dashboard/index.html');
    this.elements.webauthnBtn.addEventListener('click', () => this.handleWebAuthnLogin());
    this.elements.loginForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    this.elements.registerWebauthn.addEventListener('click', () => this.registerWebAuthn());
    this.elements.togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
  }

  startBiometricAnimation() {
    this.elements.scanLine.style.opacity = '1';
    this.updateStatus('Initializing security protocols...', 'info');
    
    setTimeout(() => {
      this.elements.scanLine.style.opacity = '0';
      this.updateStatus('Ready for authentication', 'success');
    }, 3000);
  }

  updateStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = 'status';
    if (type) this.elements.status.classList.add(type);
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

  async checkWebAuthnSupport() {
    if (!window.PublicKeyCredential) {
      this.elements.unsupportedBrowser.style.display = 'block';
      this.elements.webauthnBtn.disabled = true;
      return false;
    }
    
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        this.updateStatus('Biometric authenticator not available', 'warning');
        this.elements.webauthnBtn.disabled = true;
      }
      return available;
    } catch (error) {
      console.error('WebAuthn check failed:', error);
      return false;
    }
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const email = this.elements.emailInput.value.trim();
    const password = this.elements.passwordInput.value;
    
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.setLoadingState(true);
    
    try {
      // Send credentials to Cloudflare Worker for validation
      const response = await fetch(CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const result = await response.json();
      
      if (response.ok && result.valid) {
        // Special case for ezra/admin
        if (email === 'ezra' && password === 'admin') {
          window.location.href = '/dashboard/index.html';
          return;
        }
        
        // For other users, check if they have WebAuthn registered
        const { data: webauthnUser, error } = await supabase
          .from('webauthn_users')
          .select('*')
          .eq('email', email)
          .single();
          
        if (!error && webauthnUser) {
          this.updateStatus('Biometric authentication available', 'success');
          this.elements.webauthnOptions.style.display = 'block';
        } else {
          window.location.href = '/vfiles/index.html';
        }
      } else {
        this.showError(result.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError('Network error. Please try again.');
    } finally {
      this.setLoadingState(false);
    }
  }

  async handleWebAuthnLogin() {
    try {
      this.updateStatus('Preparing biometric authentication...', 'info');
      
      // Get challenge from Supabase
      const { data: challenge, error } = await supabase
        .from('webauthn_challenges')
        .insert({})
        .select()
        .single();
      
      if (error) throw error;
      
      // Get authentication options from Supabase
      const { data: options } = await supabase
        .rpc('get_authentication_options', { challenge: challenge.id });
      
      // Start WebAuthn authentication
      const credential = await SimpleWebAuthnBrowser.startAuthentication(options);
      
      // Verify authentication with Supabase
      const { data: verification } = await supabase
        .rpc('verify_authentication', {
          credential: JSON.stringify(credential),
          challenge_id: challenge.id
        });
      
      if (verification.verified) {
        this.updateStatus('Biometric authentication successful!', 'success');
        window.location.href = '/vfiles/index.html';
      } else {
        this.showError('Biometric authentication failed');
      }
    } catch (error) {
      console.error('WebAuthn error:', error);
      this.showError('Biometric authentication error. Please try again.');
    }
  }

  async registerWebAuthn() {
    const email = this.elements.emailInput.value.trim();
    if (!email) {
      this.showError('Please enter your email first');
      return;
    }
    
    try {
      this.updateStatus('Preparing biometric registration...', 'info');
      
      // Get challenge from Supabase
      const { data: challenge, error: challengeError } = await supabase
        .from('webauthn_challenges')
        .insert({})
        .select()
        .single();
      
      if (challengeError) throw challengeError;
      
      // Get registration options from Supabase
      const { data: options } = await supabase
        .rpc('get_registration_options', {
          user_email: email,
          challenge: challenge.id
        });
      
      // Start WebAuthn registration
      const credential = await SimpleWebAuthnBrowser.startRegistration(options);
      
      // Verify registration with Supabase
      const { data: verification } = await supabase
        .rpc('verify_registration', {
          credential: JSON.stringify(credential),
          challenge_id: challenge.id,
          user_email: email
        });
      
      if (verification.verified) {
        this.updateStatus('Biometric registration successful!', 'success');
        this.elements.webauthnOptions.style.display = 'none';
      } else {
        this.showError('Biometric registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.showError('Registration failed. Please try again.');
    }
  }

  setLoadingState(isLoading) {
    this.elements.submitLogin.disabled = isLoading;
    this.elements.loadingSpinner.style.display = isLoading ? 'inline-block' : 'none';
    this.elements.submitLogin.querySelector('.btn-text').textContent = 
      isLoading ? 'Authenticating...' : 'Login';
  }

  showError(message) {
    this.elements.errorMsg.textContent = message;
    this.elements.loginForm.classList.add('shake');
    setTimeout(() => {
      this.elements.loginForm.classList.remove('shake');
    }, 500);
  }
}

// Initialize the system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BioAuthSystem();
});
