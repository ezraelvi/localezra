// Configuration
const config = {
  maxAttempts: 3,
  scanDuration: 3000,
  supabaseUrl: 'https://hjmosjvfrycamxowfurq.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM',
  cloudflareEndpoint: 'https://your-cloudflare-worker.endpoint'
};

// DOM Elements
const scanner = document.getElementById('scanner');
const scanLine = document.getElementById('scanLine');
const progressBar = document.getElementById('progressBar');
const status = document.getElementById('status');
const visitBtn = document.getElementById('visitBtn');
const ipDisplay = document.getElementById('ipDisplay');

// State Variables
let isScanning = false;
let isLocked = false;
let audioCtx;
let scanProgress = 0;
let supabaseClient;
let failedAttempts = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  checkDeviceCapabilities();
  fetchIPAddress();
  setupEventListeners();
});

// Supabase Initialization
function initSupabase() {
  supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseKey);
}

// Event Listeners
function setupEventListeners() {
  scanner.addEventListener('click', handleFingerprintAuth);
  visitBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
}

// Fingerprint Authentication
async function handleFingerprintAuth() {
  if (isScanning || isLocked) return;
  
  try {
    startScan();
    
    if (!window.PublicKeyCredential) {
      throw new Error("Biometric authentication not supported");
    }

    const credentials = await getStoredCredentials();
    if (!credentials || credentials.length === 0) {
      throw new Error("No registered fingerprints");
    }

    const assertion = await navigator.credentials.get({
      publicKey: getAuthOptions(credentials)
    });

    await verifyAssertion(assertion);
    finishScan(true);
    status.textContent = "AUTHENTICATION SUCCESS";
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
    
  } catch (error) {
    console.error("Authentication error:", error);
    handleAuthError(error);
  }
}

// Helper Functions
async function getStoredCredentials() {
  const { data, error } = await supabaseClient
    .from('user_credentials')
    .select('credential_id');
  
  if (error) throw error;
  return data;
}

function getAuthOptions(credentials) {
  return {
    challenge: Uint8Array.from(
      window.crypto.getRandomValues(new Uint8Array(32))).buffer,
    allowCredentials: credentials.map(cred => ({
      id: Uint8Array.from(cred.credential_id),
      type: 'public-key',
      transports: ['internal']
    })),
    userVerification: "required",
    timeout: 60000
  };
}

async function verifyAssertion(assertion) {
  const { data, error } = await supabaseClient
    .from('user_credentials')
    .select('user_id')
    .eq('credential_id', Array.from(new Uint8Array(assertion.rawId)))
    .single();
  
  if (error) throw error;
  return data;
}

// Scan Animation
function startScan() {
  isScanning = true;
  scanProgress = 0;
  status.textContent = "SCANNING FINGERPRINT...";
  scanLine.style.opacity = "1";
  playBeep(800, 0.2);
  
  const progressInterval = setInterval(() => {
    scanProgress += 1;
    progressBar.style.width = `${scanProgress}%`;
    
    if (scanProgress >= 100) {
      clearInterval(progressInterval);
    }
  }, config.scanDuration / 100);
}

function finishScan(success) {
  isScanning = false;
  scanLine.style.opacity = "0";
  progressBar.style.width = "0%";
  
  if (success) {
    playBeep(1200, 0.3);
    resetFailedAttempts();
  } else {
    playBeep(400, 0.5);
  }
}

// Error Handling
function handleAuthError(error) {
  finishScan(false);
  failedAttempts++;
  
  // Send failed attempt to Supabase
  supabaseClient
    .from('login_attempts')
    .insert([{
      ip: ipDisplay.textContent.replace('IP: ', ''),
      success: false,
      timestamp: new Date().toISOString()
    }]);
  
  if (failedAttempts >= config.maxAttempts) {
    lockSystem();
  } else {
    status.textContent = `AUTH FAILED (${failedAttempts}/${config.maxAttempts})`;
    if (failedAttempts === 1) {
      visitBtn.style.display = 'inline-block';
    }
    setTimeout(() => {
      status.textContent = "TRY AGAIN";
    }, 1500);
  }
}

function lockSystem() {
  isLocked = true;
  status.textContent = "SYSTEM LOCKED";
  
  // Send to Cloudflare
  sendToCloudflare({
    ip: ipDisplay.textContent.replace('IP: ', ''),
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    reason: "Too many failed attempts"
  });
  
  setTimeout(() => {
    window.location.href = 'whoareyou/index.html';
  }, 2000);
}

function resetFailedAttempts() {
  failedAttempts = 0;
  visitBtn.style.display = 'none';
}

// Device and Network Info
function checkDeviceCapabilities() {
  if (!window.PublicKeyCredential) {
    status.textContent = "BIOMETRICS NOT SUPPORTED";
    visitBtn.style.display = 'inline-block';
  }
}

function fetchIPAddress() {
  fetch('https://api.ipify.org?format=json')
    .then(res => res.json())
    .then(data => {
      ipDisplay.textContent = `IP: ${data.ip}`;
    })
    .catch(() => {
      ipDisplay.textContent = 'IP: Unknown';
    });
}

async function sendToCloudflare(data) {
  try {
    await fetch(config.cloudflareEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error("Failed to send data to Cloudflare:", error);
  }
}

// Audio Functions
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playBeep(freq, dur, type='sine') {
  initAudio();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  osc.stop(audioCtx.currentTime + dur);
}

// Initialize audio on first interaction
document.addEventListener('mousedown', initAudio, { once: true });
