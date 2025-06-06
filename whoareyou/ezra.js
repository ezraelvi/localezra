const config = {
  maxAttempts: 3,
  workerEndpoint: 'https://auth-logs.ezvvel.workers.dev/',
  supabaseUrl: 'https://hjmosjvfrycamxowfurq.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM',
  dashboardUrl: 'dashboard/index.html',
  vfilesUrl: 'vfiles/index.html',
  elviUrl: 'elvi/index.html',
  lockdownUrl: 'whoareyou/index.html',
  authTimeout: 30000
};

const elements = {
  scanLine: document.getElementById('scanLine'),
  status: document.getElementById('status'),
  ipDisplay: document.getElementById('ipDisplay'),
  visitBtn: document.getElementById('visitBtn'),
  fallbackBtn: document.getElementById('fallbackBtn'),
  webauthnBtn: document.getElementById('webauthnBtn'),
  btnContainer: document.getElementById('btnContainer'),
  loginForm: document.getElementById('loginForm'),
  emailInput: document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  submitLogin: document.getElementById('submitLogin'),
  loadingSpinner: document.getElementById('loadingSpinner'),
  container: document.querySelector('.container')
};

let state = {
  isScanning: false,
  isLocked: false,
  attemptCount: 0,
  audioCtx: null,
  userIp: null,
  browserId: null,
  authTimeout: null,
  supabase: null,
  loginSecurity: new LoginSecurity()
};

class LoginSecurity {
  constructor() {
    this.attempts = 0;
    this.maxAttempts = 3;
    this.blockDuration = 5 * 60 * 1000; // 5 minutes
  }

  isBlocked() {
    const lastAttempt = localStorage.getItem('lastFailedAttempt');
    if (!lastAttempt) return false;
    return Date.now() < (parseInt(lastAttempt) + this.blockDuration);
  }

  getRemainingBlockTime() {
    const lastAttempt = localStorage.getItem('lastFailedAttempt');
    return Math.max(0, (parseInt(lastAttempt) + this.blockDuration) - Date.now());
  }

  recordFailedAttempt() {
    this.attempts++;
    localStorage.setItem('lastFailedAttempt', Date.now().toString());
    state.attemptCount = this.attempts;
  }

  resetAttempts() {
    this.attempts = 0;
    localStorage.removeItem('lastFailedAttempt');
    state.attemptCount = 0;
  }
}

// Initialize Supabase
function initSupabase() {
  state.supabase = supabase.createClient(config.supabaseUrl, config.supabaseKey);
}

// Authentication functions
async function handleWebAuthnLogin() {
  if (state.loginSecurity.isBlocked()) {
    handleLockout();
    return;
  }

  try {
    const { data, error } = await state.supabase.auth.signInWithWebAuthn();
    if (error) throw error;
    if (data.user) {
      handleAuthSuccess(data.user.email);
    }
  } catch (error) {
    console.error('WebAuthn error:', error);
    handleAuthFailure();
  }
}

async function handleEmailLogin(email, password) {
  if (state.loginSecurity.isBlocked()) {
    handleLockout();
    return;
  }

  elements.loadingSpinner.style.display = 'block';
  elements.submitLogin.disabled = true;
  elements.status.textContent = "VERIFYING CREDENTIALS...";

  try {
    const response = await fetch(config.workerEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        username: email, 
        password 
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      sessionStorage.setItem('authToken', data.token || 'dummy-token');
      sessionStorage.setItem('loggedInUser', email);
      state.loginSecurity.resetAttempts();
      handleAuthSuccess(email, data.redirectUrl);
    } else {
      throw new Error(data.error || 'Invalid credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    state.loginSecurity.recordFailedAttempt();
    elements.status.textContent = error.message || "Login failed";
    handleAuthFailure();
  } finally {
    elements.loadingSpinner.style.display = 'none';
    elements.submitLogin.disabled = false;
  }
}

function handleAuthSuccess(email, redirectUrl = null) {
  clearTimeout(state.authTimeout);
  
  elements.scanLine.style.opacity = '0';
  elements.status.textContent = `AUTH SUCCESS: ${email}`;

  const targetUrl = redirectUrl || 
                   (email === 'ezvvel@gmail.com' ? config.vfilesUrl :
                   email === 'ezra' ? config.dashboardUrl :
                   email === 'elvi' ? config.elviUrl : config.dashboardUrl);

  setTimeout(() => {
    window.location.href = targetUrl;
  }, 1000);
}

function handleAuthFailure() {
  if (state.loginSecurity.isBlocked()) {
    const remainingMinutes = Math.ceil(state.loginSecurity.getRemainingBlockTime() / 60000);
    elements.status.textContent = `Too many attempts. Try again in ${remainingMinutes} minutes.`;
    handleLockout();
    return;
  }

  elements.status.textContent = `Attempt ${state.attemptCount}/${config.maxAttempts}`;
  elements.fallbackBtn.style.display = 'block';
  elements.webauthnBtn.style.display = 'block';
}

function handleLockout() {
  state.isLocked = true;
  elements.container.classList.add('error-state');
  
  document.cookie = "blocked=true; max-age=3600; path=/";
  setTimeout(() => {
    window.location.href = config.lockdownUrl;
  }, 3000);
}

// Initialize the application
async function init() {
  if (document.cookie.includes('blocked=true')) {
    window.location.href = config.lockdownUrl;
    return;
  }

  initSupabase();
  setupEventListeners();

  try {
    const hasWebAuthn = await checkFingerprintSupport();
    if (hasWebAuthn) {
      elements.status.textContent = "BIOMETRIC READY";
      await handleWebAuthnLogin();
    } else {
      elements.status.textContent = "USE EMAIL LOGIN";
      elements.btnContainer.style.display = 'block';
      elements.fallbackBtn.style.display = 'block';
    }
  } catch (error) {
    console.error('Init error:', error);
    elements.status.textContent = "SYSTEM ERROR";
    elements.btnContainer.style.display = 'block';
    elements.fallbackBtn.style.display = 'block';
  }
}

// WebAuthn support check
async function checkFingerprintSupport() {
  return window.PublicKeyCredential && 
         PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
         await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}

// Event listeners
function setupEventListeners() {
  elements.fallbackBtn.addEventListener('click', () => {
    elements.loginForm.style.display = 'block';
    elements.btnContainer.style.display = 'none';
  });

  elements.webauthnBtn.addEventListener('click', handleWebAuthnLogin);

  elements.submitLogin.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleEmailLogin(elements.emailInput.value.trim(), elements.passwordInput.value);
  });

  elements.passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.submitLogin.click();
    }
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
