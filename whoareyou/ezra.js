const config = {
  maxAttempts: 3,
  cloudflareEndpoint: 'https://auth-logs.ezvvel.workers.dev/',
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
  supabase: null
};

// Initialize Supabase
function initSupabase() {
  state.supabase = supabase.createClient(config.supabaseUrl, config.supabaseKey);
}

// WebAuthn Support Check
function isWebAuthnSupported() {
  return window.PublicKeyCredential !== undefined && 
         typeof PublicKeyCredential === 'function' &&
         typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
}

async function checkFingerprintSupport() {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    console.error('WebAuthn check failed:', error);
    return false;
  }
}

// Authentication Handlers
async function handleWebAuthnLogin() {
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
  elements.loadingSpinner.style.display = 'block';
  elements.submitLogin.disabled = true;
  
  try {
    const response = await fetch(config.cloudflareEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      handleAuthSuccess(result.email, result.redirectUrl);
    } else {
      throw new Error(result.message || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    elements.status.textContent = "Login failed. Please try again.";
    handleAuthFailure();
  } finally {
    elements.loadingSpinner.style.display = 'none';
    elements.submitLogin.disabled = false;
  }
}

function handleAuthSuccess(email, redirectUrl = null) {
  clearTimeout(state.authTimeout);
  state.attemptCount = 0;
  
  elements.scanLine.style.opacity = '0';
  elements.status.textContent = `AUTH SUCCESS: ${email}`;
  
  if (redirectUrl) {
    window.location.href = redirectUrl;
  } else {
    // Default redirect based on email
    if (email === 'ezvvel@gmail.com') {
      window.location.href = config.vfilesUrl;
    } else if (email === 'ezra') {
      window.location.href = config.dashboardUrl;
    } else if (email === 'elvi') {
      window.location.href = config.elviUrl;
    }
  }
}

function handleAuthFailure() {
  state.attemptCount++;
  
  if (state.attemptCount >= config.maxAttempts) {
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
  elements.status.textContent = "TOO MANY ATTEMPTS. ACCESS DENIED.";
  
  document.cookie = "blocked=true; max-age=3600; path=/";
  setTimeout(() => {
    window.location.href = config.lockdownUrl;
  }, 3000);
}

// Event Listeners
function setupEventListeners() {
  elements.fallbackBtn.addEventListener('click', () => {
    elements.loginForm.style.display = 'block';
    elements.btnContainer.style.display = 'none';
  });
  
  elements.webauthnBtn.addEventListener('click', () => {
    handleWebAuthnLogin();
  });
  
  elements.submitLogin.addEventListener('click', async () => {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;
    
    if (!email || !password) {
      elements.status.textContent = "Please enter both fields";
      return;
    }
    
    await handleEmailLogin(email, password);
  });
  
  elements.passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.submitLogin.click();
    }
  });
}

// Initialization
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

// Start the app
document.addEventListener('DOMContentLoaded', init);
