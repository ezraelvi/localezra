// Configuration
const config = {
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseKey: 'YOUR_SUPABASE_KEY',
  maxAttempts: 3,
  cloudflareEndpoint: 'YOUR_CLOUDFLARE_WORKER_ENDPOINT',
  dashboardUrl: 'dashboard.html',
  lockdownUrl: 'whoareyou/index.html'
};

// DOM Elements
const elements = {
  scanLine: document.getElementById('scanLine'),
  status: document.getElementById('status'),
  ipDisplay: document.getElementById('ipDisplay'),
  visitBtn: document.getElementById('visitBtn'),
  container: document.querySelector('.container')
};

// State
let state = {
  isScanning: false,
  isLocked: false,
  attemptCount: 0,
  audioCtx: null,
  supabase: null,
  userIp: null,
  browserId: null
};

// Initialize the application
async function init() {
  // Check if already locked out
  if (getCookie('blocked') === 'true') {
    window.location.href = config.lockdownUrl;
    return;
  }

  // Initialize services
  initSupabase();
  initAudio();
  await detectIp();
  generateBrowserId();
  
  // Check device capabilities
  if (!isWebAuthnSupported()) {
    handleUnsupportedDevice();
    return;
  }

  // Setup event listeners
  setupEventListeners();
  
  // Start fingerprint detection
  startFingerprintDetection();
}

// Initialize Supabase client
function initSupabase() {
  state.supabase = supabase.createClient(config.supabaseUrl, config.supabaseKey);
}

// Initialize Web Audio
function initAudio() {
  state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// Play beep sound
function playBeep(frequency, duration, type = 'sine') {
  const oscillator = state.audioCtx.createOscillator();
  const gainNode = state.audioCtx.createGain();
  
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gainNode);
  gainNode.connect(state.audioCtx.destination);
  
  gainNode.gain.setValueAtTime(0.3, state.audioCtx.currentTime);
  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + duration);
  oscillator.stop(state.audioCtx.currentTime + duration);
}

// Detect user IP
async function detectIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    state.userIp = data.ip;
    elements.ipDisplay.textContent = `IP: ${data.ip}`;
  } catch (error) {
    console.error('IP detection failed:', error);
    state.userIp = 'unknown';
    elements.ipDisplay.textContent = 'IP: Unknown';
  }
}

// Generate unique browser ID
function generateBrowserId() {
  state.browserId = 'br-' + Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);
}

// Check WebAuthn support
function isWebAuthnSupported() {
  return window.PublicKeyCredential && 
         typeof window.PublicKeyCredential === 'function' &&
         navigator.credentials && 
         navigator.credentials.create;
}

// Handle unsupported devices
function handleUnsupportedDevice() {
  elements.status.textContent = "DEVICE NOT SUPPORTED";
  elements.visitBtn.style.display = 'block';
  elements.visitBtn.textContent = "CONTINUE WITHOUT AUTH";
}

// Setup event listeners
function setupEventListeners() {
  elements.visitBtn.addEventListener('click', () => {
    window.location.href = config.dashboardUrl;
  });
}

// Start fingerprint detection
function startFingerprintDetection() {
  // This would be replaced with actual hardware detection
  // For demo purposes, we'll simulate hardware detection
  setTimeout(() => {
    simulateHardwareDetection();
  }, 1000);
}

// Simulate hardware fingerprint detection
function simulateHardwareDetection() {
  // In a real app, this would be triggered by actual hardware
  document.addEventListener('fingerprintHardwareDetected', () => {
    if (!state.isScanning && !state.isLocked) {
      startAuthentication();
    }
  });
  
  // For demo: Trigger after 2 seconds
  setTimeout(() => {
    const event = new Event('fingerprintHardwareDetected');
    document.dispatchEvent(event);
  }, 2000);
}

// Start authentication process
async function startAuthentication() {
  state.isScanning = true;
  startScanAnimation();
  playBeep(800, 0.3);
  
  try {
    // Check if credentials exist
    const { data: credentials, error } = await state.supabase
      .from('user_credentials')
      .select('*');
    
    if (error || !credentials || credentials.length === 0) {
      throw new Error("No credentials found");
    }
    
    // Prepare authentication options
    const authOptions = {
      challenge: new Uint8Array(32),
      allowCredentials: credentials.map(cred => ({
        id: Uint8Array.from(cred.credential_id),
        type: 'public-key',
        transports: ['internal']
      })),
      userVerification: 'required'
    };
    
    // Authenticate with WebAuthn
    const assertion = await navigator.credentials.get({
      publicKey: authOptions
    });
    
    // Verify assertion with Supabase
    await verifyAssertion(assertion);
    
    // Authentication successful
    authenticationSuccess();
    
  } catch (error) {
    console.error("Authentication error:", error);
    authenticationFailed();
  } finally {
    state.isScanning = false;
    stopScanAnimation();
  }
}

// Verify assertion with Supabase
async function verifyAssertion(assertion) {
  const { data, error } = await state.supabase
    .from('user_credentials')
    .select('user_id')
    .eq('credential_id', Array.from(new Uint8Array(assertion.rawId)))
    .single();
  
  if (error) throw error;
  return data;
}

// Handle successful authentication
function authenticationSuccess() {
  playBeep(1000, 0.5);
  elements.status.textContent = "AUTHENTICATION SUCCESS";
  resetAttempts();
  logAuthSuccess();
  
  setTimeout(() => {
    window.location.href = config.dashboardUrl;
  }, 1000);
}

// Handle failed authentication
function authenticationFailed() {
  state.attemptCount++;
  updateAttemptCookie();
  
  playBeep(400, 0.2);
  
  if (state.attemptCount >= config.maxAttempts) {
    triggerLockdown();
  } else {
    elements.status.textContent = `AUTH FAILED (${state.attemptCount}/${config.maxAttempts})`;
    
    if (state.attemptCount === 1) {
      elements.visitBtn.style.display = 'block';
    }
    
    logAuthFailure();
  }
}

// Trigger lockdown
function triggerLockdown() {
  state.isLocked = true;
  elements.container.classList.add('error-state');
  elements.status.textContent = "SECURITY LOCKDOWN";
  setCookie('blocked', 'true', 1440); // 24 hours
  
  playBeep(200, 0.2, 'square');
  setTimeout(() => playBeep(150, 0.3, 'square'), 100);
  setTimeout(() => playBeep(100, 0.4, 'square'), 200);
  
  logLockout();
  
  setTimeout(() => {
    window.location.href = config.lockdownUrl;
  }, 1000);
}

// Start scan animation
function startScanAnimation() {
  elements.scanLine.style.opacity = "1";
}

// Stop scan animation
function stopScanAnimation() {
  elements.scanLine.style.opacity = "0";
}

// Cookie management
function setCookie(name, value, minutes) {
  const date = new Date();
  date.setTime(date.getTime() + (minutes * 60 * 1000));
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

function getCookie(name) {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) return cookieValue;
  }
  return null;
}

function updateAttemptCookie() {
  setCookie('login_attempts', state.attemptCount, 1440);
}

function resetAttempts() {
  state.attemptCount = 0;
  setCookie('login_attempts', '0', 1440);
}

// Logging functions
async function logAuthSuccess() {
  await sendToCloudflare('auth_success');
}

async function logAuthFailure() {
  await sendToCloudflare('auth_failure');
}

async function logLockout() {
  await sendToCloudflare('lockout');
}

async function sendToCloudflare(eventType) {
  try {
    const logData = {
      event: eventType,
      ip: state.userIp,
      browserId: state.browserId,
      timestamp: new Date().toISOString(),
      attempts: state.attemptCount
    };
    
    await fetch(config.cloudflareEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logData)
    });
    
    // Also send to Supabase
    await state.supabase
      .from('auth_logs')
      .insert([{
        event_type: eventType,
        user_ip: state.userIp,
        browser_id: state.browserId,
        attempt_count: state.attemptCount
      }]);
    
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
