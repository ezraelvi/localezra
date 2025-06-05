const config = {
  supabaseUrl: 'https://hjmosjvfrycamxowfurq.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM',
  maxAttempts: 3,
  cloudflareEndpoint: 'https://auth-logs.ezvvel.workers.dev/',
  dashboardUrl: 'dashboard/index.html',
  lockdownUrl: 'whoareyou/index.html',
  webauthnSupportUrl: 'https://webauthn.me/browser-support'
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
  supabase: null,
  userIp: null,
  browserId: null,
  deviceInfo: null
};
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
  switch(type) {
    case 'scan':
      oscillator.frequency.value = 800;
      break;
    case 'success':
      oscillator.frequency.value = 1200;
      break;
    case 'error':
      oscillator.frequency.value = 400;
      break;
    case 'fail':
      oscillator.frequency.value = 300;
      break;
  }
  gainNode.gain.exponentialRampToValueAtTime(0.1, state.audioCtx.currentTime + 0.1);
  oscillator.start();
  oscillator.stop(state.audioCtx.currentTime + 0.3);
}
function generateBrowserId() {
  let id = localStorage.getItem('browserId');
  if (!id) {
    id = 'id-' + Math.random().toString(36).substr(2, 9) + 
         '-' + Date.now().toString(36);
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
    timestamp: new Date().toISOString()
  };
  return state.deviceInfo;
}
function isWebAuthnSupported() {
  return window.PublicKeyCredential !== undefined && 
         typeof PublicKeyCredential === 'function' &&
         typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
}
function isFingerprintSupported() {
  if (!isWebAuthnSupported()) return false;
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    .then(available => available)
    .catch(() => false);
}
function startFingerprintDetection() {
  if (state.isLocked) return;
  elements.status.textContent = "SCANNING FINGERPRINT...";
  elements.scanLine.style.opacity = '1';
  state.isScanning = true;
  playBeep('scan');
  setTimeout(() => {
    authenticateWithFingerprint();
  }, 3000);
}
function authenticateWithFingerprint() {
  isFingerprintSupported().then(supported => {
    if (!supported) {
      handleFingerprintUnsupported();
      return;
    }
    const isAuthenticated = Math.random() > 0.3;
    if (isAuthenticated) {
      handleAuthSuccess();
    } else {
      handleAuthFailure();
    }
  }).catch(() => {
    handleFingerprintUnsupported();
  });
}
function handleAuthSuccess() {
  state.isScanning = false;
  elements.scanLine.style.opacity = '0';
  elements.status.textContent = "AUTHENTICATION SUCCESSFUL";
  playBeep('success');
  elements.btnContainer.style.display = 'block';
  elements.visitBtn.style.display = 'inline-block';
  elements.fallbackBtn.style.display = 'none';
  elements.webauthnBtn.style.display = 'none';
  logAuthAttempt(true);
}
function handleAuthFailure() {
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
  logAuthAttempt(false);
  setTimeout(() => {
    if (!state.isLocked) {
      startFingerprintDetection();
    }
  }, 2000);
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
function handleWebAuthnUnsupported() {
  elements.status.textContent = "WEBAUTHN NOT SUPPORTED BY YOUR BROWSER";
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
  document.cookie = "blocked=true; max-age=3600; path=/";
  setTimeout(() => {
    window.location.href = config.lockdownUrl;
  }, 3000);
}
function showLoginForm() {
  elements.loginForm.style.display = 'block';
  elements.btnContainer.style.display = 'none';
  elements.status.textContent = "PLEASE ENTER YOUR CREDENTIALS";
}
async function submitLogin() {
  const email = elements.emailInput.value;
  const password = elements.passwordInput.value;
  if (!email || !password) {
    elements.status.textContent = "PLEASE ENTER BOTH EMAIL AND PASSWORD";
    playBeep('error');
    return;
  }
  elements.status.textContent = "VERIFYING CREDENTIALS...";
  setTimeout(() => {
    const isAuthenticated = Math.random() > 0.5;
    if (isAuthenticated) {
      handleAuthSuccess();
    } else {
      elements.status.textContent = "INVALID CREDENTIALS";
      playBeep('fail');
    }
  }, 1500);
}
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
function logAuthAttempt(success) {
  const data = {
    success,
    browserId: state.browserId,
    ip: state.userIp,
    timestamp: new Date().toISOString(),
    deviceInfo: collectDeviceInfo()
  };
  console.log('Auth attempt:', data);
}
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
async function init() {
  try {
    if (getCookie('blocked') === 'true') {
      window.location.href = config.lockdownUrl;
      return;
    }
    initAudio();
    await detectIp();
    generateBrowserId();
    collectDeviceInfo();
    if (!isWebAuthnSupported()) {
      handleWebAuthnUnsupported();
      return;
    }
    setupEventListeners();
    startFingerprintDetection();
  } catch (error) {
    console.error('Initialization error:', error);
    elements.status.textContent = "SYSTEM INITIALIZATION FAILED";
    elements.btnContainer.style.display = 'block';
    elements.fallbackBtn.style.display = 'inline-block';
    elements.webauthnBtn.style.display = 'inline-block';
    playBeep('error');
  }
}
document.addEventListener('DOMContentLoaded', init);
