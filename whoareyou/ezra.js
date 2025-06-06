const config = {
  maxAttempts: 3,
  cloudflareEndpoint: 'https://auth-logs.ezvvel.workers.dev/',
  webauthnEndpoint: 'https://your-api.com/webauthn',
  dashboardUrl: 'dashboard/index.html',
  lockdownUrl: 'whoareyou/index.html',
  webauthnSupportUrl: 'https://webauthn.me/browser-support',
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
  deviceInfo: null,
  authTimeout: null,
  audioInitialized: false
};

// Audio System
function initAudio() {
  if (state.audioInitialized || !window.AudioContext) return;
  
  try {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.audioInitialized = true;
  } catch (e) {
    console.warn('Audio initialization failed:', e);
  }
}

function playBeep(type) {
  if (!state.audioInitialized) return;
  
  const oscillator = state.audioCtx.createOscillator();
  const gainNode = state.audioCtx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(state.audioCtx.destination);
  oscillator.type = 'sine';
  
  const frequencies = {
    scan: 800,
    success: 1200,
    error: 400,
    fail: 300
  };
  
  oscillator.frequency.value = frequencies[type] || 800;
  gainNode.gain.value = 0.1;
  
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };
  
  oscillator.start();
  oscillator.stop(state.audioCtx.currentTime + 0.3);
}

// Security Utilities
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateBrowserId() {
  let id = localStorage.getItem('browserId');
  if (!id) {
    id = 'id-' + crypto.randomUUID();
    localStorage.setItem('browserId', id);
  }
  state.browserId = id;
  return id;
}

function collectDeviceInfo() {
  state.deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browserId: state.browserId,
    timestamp: new Date().toISOString(),
    ipAddress: state.userIp
  };
  return state.deviceInfo;
}

// WebAuthn Functions
function isWebAuthnSupported() {
  return window.PublicKeyCredential !== undefined && 
         typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
}

async function isFingerprintSupported() {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    console.error('WebAuthn check failed:', error);
    return false;
  }
}

async function authenticateWithFingerprint() {
  if (state.isLocked) return;
  
  clearTimeout(state.authTimeout);
  state.authTimeout = setTimeout(handleAuthTimeout, config.authTimeout);
  
  elements.status.textContent = "SCANNING FINGERPRINT...";
  elements.scanLine.style.opacity = '1';
  state.isScanning = true;
  playBeep('scan');
  
  try {
    const challengeResponse = await fetch(`${config.webauthnEndpoint}/challenge`);
    const { challenge, sessionId } = await challengeResponse.json();
    
    const publicKeyCredentialRequestOptions = {
      challenge: Uint8Array.from(challenge, c => c.charCodeAt(0)),
      allowCredentials: [],
      userVerification: 'required',
      timeout: 60000
    };
    
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });
    
    const verificationResponse = await fetch(`${config.webauthnEndpoint}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assertion: {
          id: assertion.id,
          rawId: Array.from(new Uint8Array(assertion.rawId)),
          response: {
            authenticatorData: Array.from(new Uint8Array(assertion.response.authenticatorData)),
            clientDataJSON: Array.from(new Uint8Array(assertion.response.clientDataJSON)),
            signature: Array.from(new Uint8Array(assertion.response.signature))
          },
          type: assertion.type
        },
        sessionId,
        deviceInfo: collectDeviceInfo()
      })
    });
    
    const { verified } = await verificationResponse.json();
    verified ? handleAuthSuccess() : handleAuthFailure();
  } catch (error) {
    console.error('Authentication failed:', error);
    handleAuthFailure();
  }
}

// Auth State Handlers
function handleAuthSuccess() {
  clearTimeout(state.authTimeout);
  state.isScanning = false;
  state.attemptCount = 0;
  
  elements.scanLine.style.opacity = '0';
  elements.status.textContent = "AUTHENTICATION SUCCESSFUL";
  playBeep('success');
  
  setTimeout(() => {
    window.location.href = config.dashboardUrl;
  }, 1000);
}

function handleAuthFailure() {
  clearTimeout(state.authTimeout);
  state.attemptCount++;
  state.isScanning = false;
  
  elements.scanLine.style.opacity = '0';
  
  if (state.attemptCount >= config.maxAttempts) {
    handleLockout();
    return;
  }
  
  elements.status.textContent = `AUTHENTICATION FAILED (${state.attemptCount}/${config.maxAttempts})`;
  playBeep('fail');
  
  elements.btnContainer.style.display = 'block';
  elements.fallbackBtn.style.display = 'inline-block';
  elements.webauthnBtn.style.display = 'inline-block';
  elements.visitBtn.style.display = 'none';
}

function handleLockout() {
  state.isLocked = true;
  elements.container.classList.add('error-state');
  elements.status.textContent = "TOO MANY FAILED ATTEMPTS. ACCESS DENIED.";
  playBeep('fail');
  
  document.cookie = "blocked=true; max-age=3600; path=/";
  setTimeout(() => {
    window.location.href = config.lockdownUrl;
  }, 3000);
}

// Login System
async function submitLogin() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  
  if (!email || !password) {
    elements.status.textContent = "Please enter both email and password";
    playBeep('error');
    return;
  }
  
  elements.submitLogin.disabled = true;
  elements.loadingSpinner.style.display = 'block';
  elements.status.textContent = "VERIFYING CREDENTIALS...";
  
  try {
    const hashedPassword = await hashPassword(password);
    
    const response = await fetch(config.cloudflareEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        passwordHash: hashedPassword,
        deviceInfo: collectDeviceInfo()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      handleAuthSuccess();
    } else {
      elements.status.textContent = result.message || "Invalid credentials";
      playBeep('fail');
      handleAuthFailure();
    }
  } catch (error) {
    console.error('Login error:', error);
    elements.status.textContent = "Service unavailable. Please try later.";
    playBeep('error');
  } finally {
    elements.submitLogin.disabled = false;
    elements.loadingSpinner.style.display = 'none';
  }
}

// Utility Functions
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

async function detectIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    state.userIp = data.ip;
    elements.ipDisplay.textContent = `IP: ${data.ip} | ${new Date().toLocaleString()}`;
  } catch (error) {
    console.error('IP detection failed:', error);
    elements.ipDisplay.textContent = `IP: Unknown | ${new Date().toLocaleString()}`;
  }
}

// Event Listeners
function setupEventListeners() {
  elements.fallbackBtn.addEventListener('click', () => {
    elements.loginForm.style.display = 'block';
    elements.btnContainer.style.display = 'none';
    elements.status.textContent = "PLEASE ENTER YOUR CREDENTIALS";
  });
  
  elements.visitBtn.addEventListener('click', () => {
    window.location.href = config.dashboardUrl;
  });
  
  elements.webauthnBtn.addEventListener('click', () => {
    window.open(config.webauthnSupportUrl, '_blank');
  });
  
  elements.submitLogin.addEventListener('click', submitLogin);
  elements.passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
  
  // Initialize audio on first interaction
  document.body.addEventListener('click', () => {
    if (!state.audioInitialized) initAudio();
  }, { once: true });
}

// Initialization
async function init() {
  if (getCookie('blocked') === 'true') {
    window.location.href = config.lockdownUrl;
    return;
  }
  
  await detectIp();
  generateBrowserId();
  collectDeviceInfo();
  setupEventListeners();
  
  if (!isWebAuthnSupported()) {
    handleFingerprintUnsupported();
    return;
  }
  
  elements.status.textContent = "CLICK ANYWHERE TO START BIOMETRIC SCAN";
}

function handleFingerprintUnsupported() {
  elements.status.textContent = "BIOMETRIC AUTH NOT SUPPORTED IN THIS BROWSER";
  elements.btnContainer.style.display = 'block';
  elements.fallbackBtn.style.display = 'inline-block';
  elements.webauthnBtn.style.display = 'inline-block';
  elements.visitBtn.style.display = 'none';
  playBeep('error');
}

document.addEventListener('DOMContentLoaded', init);
