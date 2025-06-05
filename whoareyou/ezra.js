const config = {
  maxAttempts: 3,
  cloudflareEndpoint: 'https://auth-logs.ezvvel.workers.dev/',
  dashboardUrl: 'dashboard/index.html',
  lockdownUrl: 'whoareyou/index.html',
  webauthnSupportUrl: 'https://webauthn.me/browser-support',
  authTimeout: 30000 // 30 seconds
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
  authTimeout: null
};

// Audio feedback functions
function initAudio() {
  try {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.error('Web Audio API not supported');
  }
}

function playBeep(type) {
  if (!state.audioCtx) return;
  
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
  gainNode.gain.exponentialRampToValueAtTime(0.1, state.audioCtx.currentTime + 0.1);
  oscillator.start();
  oscillator.stop(state.audioCtx.currentTime + 0.3);
}

// Device identification
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
    deviceMemory: navigator.deviceMemory || 'unknown',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    colorDepth: window.screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browserId: state.browserId,
    timestamp: new Date().toISOString(),
    ipAddress: state.userIp
  };
  return state.deviceInfo;
}

// WebAuthn functions
function isWebAuthnSupported() {
  return window.PublicKeyCredential !== undefined && 
         typeof PublicKeyCredential === 'function' &&
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

async function submitLogin() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  
  if (!email || !password) {
    elements.status.textContent = "PLEASE ENTER BOTH EMAIL AND PASSWORD";
    playBeep('error');
    return;
  }
  
  elements.status.textContent = "VERIFYING CREDENTIALS...";
  
  try {
    // Send credentials to Cloudflare Worker for verification
    const response = await fetch(config.cloudflareEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        deviceInfo: collectDeviceInfo(),
        browserId: state.browserId
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Store user info in localStorage for the next page
      localStorage.setItem('authData', JSON.stringify({
        email,
        userType: result.userType,
        ip: state.userIp,
        timestamp: new Date().toISOString(),
        deviceInfo: state.deviceInfo
      }));
      
      // Redirect to the appropriate page
      window.location.href = result.redirectUrl;
    } else {
      elements.status.textContent = result.message || "INVALID CREDENTIALS";
      playBeep('fail');
      handleAuthFailure();
    }
  } catch (error) {
    console.error('Login error:', error);
    elements.status.textContent = "LOGIN SERVICE UNAVAILABLE";
    playBeep('error');
  }
}

async function startFingerprintDetection() {
  if (state.isLocked) return;
  
  clearTimeout(state.authTimeout);
  state.authTimeout = setTimeout(() => {
    handleAuthTimeout();
  }, config.authTimeout);
  
  elements.status.textContent = "SCANNING FINGERPRINT...";
  elements.scanLine.style.opacity = '1';
  state.isScanning = true;
  playBeep('scan');
  
  try {
    const supported = await isFingerprintSupported();
    if (!supported) {
      handleFingerprintUnsupported();
      return;
    }
    
    await authenticateWithFingerprint();
  } catch (error) {
    console.error('Fingerprint authentication error:', error);
    handleAuthFailure();
  }
}

async function authenticateWithFingerprint() {
  try {
    // Prepare WebAuthn options
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    const publicKeyCredentialRequestOptions = {
      challenge: challenge,
      allowCredentials: [],
      userVerification: 'required',
      timeout: 60000
    };
    
    // Start WebAuthn authentication
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });
    
    // In a real implementation, you would verify the assertion with your server
    handleAuthSuccess();
  } catch (error) {
    console.error('WebAuthn authentication failed:', error);
    handleAuthFailure();
  }
}

// Authentication state handlers
function handleAuthSuccess() {
  clearTimeout(state.authTimeout);
  state.isScanning = false;
  state.attemptCount = 0;
  
  elements.scanLine.style.opacity = '0';
  elements.status.textContent = "AUTHENTICATION SUCCESSFUL";
  playBeep('success');
  
  elements.btnContainer.style.display = 'block';
  elements.visitBtn.style.display = 'inline-block';
  elements.fallbackBtn.style.display = 'none';
  elements.webauthnBtn.style.display = 'none';
  
  // Redirect to dashboard after short delay
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
  elements.visitBtn.style.display = 'none';
  elements.webauthnBtn.style.display = 'inline-block';
  
  setTimeout(() => {
    if (!state.isLocked) {
      startFingerprintDetection();
    }
  }, 2000);
}

function handleAuthTimeout() {
  state.isScanning = false;
  elements.scanLine.style.opacity = '0';
  elements.status.textContent = "AUTHENTICATION TIMED OUT";
  playBeep('error');
  handleAuthFailure();
}

function handleFingerprintUnsupported() {
  state.isScanning = false;
  elements.scanLine.style.opacity = '0';
  elements.status.textContent = "FINGERPRINT AUTHENTICATION NOT SUPPORTED";
  playBeep('error');
  
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
  
  // Set lockout cookie (1 hour)
  document.cookie = "blocked=true; max-age=3600; path=/";
  
  // Redirect to lockdown page
  setTimeout(() => {
    window.location.href = config.lockdownUrl;
  }, 3000);
}

// Email login functions
function showLoginForm() {
  elements.loginForm.style.display = 'block';
  elements.btnContainer.style.display = 'none';
  elements.status.textContent = "PLEASE ENTER YOUR CREDENTIALS";
}

async function submitLogin() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  
  if (!email || !password) {
    elements.status.textContent = "PLEASE ENTER BOTH EMAIL AND PASSWORD";
    playBeep('error');
    return;
  }
  
  elements.status.textContent = "VERIFYING CREDENTIALS...";
  
  try {
    // Send credentials to Cloudflare Worker for verification
    const response = await fetch(config.cloudflareEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        deviceInfo: collectDeviceInfo(),
        browserId: state.browserId
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      handleAuthSuccess();
    } else {
      elements.status.textContent = result.message || "INVALID CREDENTIALS";
      playBeep('fail');
      handleAuthFailure();
    }
  } catch (error) {
    console.error('Login error:', error);
    elements.status.textContent = "LOGIN SERVICE UNAVAILABLE";
    playBeep('error');
  }
}

// Utility functions
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
    elements.ipDisplay.textContent = 'IP: Unknown | ' + new Date().toLocaleString();
  }
}

// Event listeners
function setupEventListeners() {
  elements.fallbackBtn.addEventListener('click', showLoginForm);
  elements.visitBtn.addEventListener('click', () => {
    window.location.href = config.dashboardUrl;
  });
  elements.webauthnBtn.addEventListener('click', () => {
    window.open(config.webauthnSupportUrl, '_blank');
  });
  elements.submitLogin.addEventListener('click', submitLogin);
  elements.passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitLogin();
    }
  });
}

// Main initialization
async function init() {
  try {
    // Check if user is blocked
    if (getCookie('blocked') === 'true') {
      window.location.href = config.lockdownUrl;
      return;
    }
    
    // Initialize systems
    initAudio();
    await detectIp();
    generateBrowserId();
    collectDeviceInfo();
    
    // Check WebAuthn support
    if (!isWebAuthnSupported()) {
      handleFingerprintUnsupported();
      return;
    }
    
    setupEventListeners();
    
    // Check fingerprint support and start auth
    const supported = await isFingerprintSupported();
    if (supported) {
      startFingerprintDetection();
    } else {
      handleFingerprintUnsupported();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    elements.status.textContent = "SYSTEM INITIALIZATION FAILED";
    elements.btnContainer.style.display = 'block';
    elements.fallbackBtn.style.display = 'inline-block';
    elements.webauthnBtn.style.display = 'inline-block';
    playBeep('error');
  }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
