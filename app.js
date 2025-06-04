// CONFIGURATION
const config = {
  maxAttempts: 3,
  scanDuration: 3000,
  secretCode: "LOCALLIFE",
  attemptCookieExpiry: 10, // minutes
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseKey: 'YOUR_SUPABASE_ANON_KEY'
};

// DOM ELEMENTS
const vault = document.getElementById('vault');
const scanner = document.getElementById('scanner');
const scanLine = document.getElementById('scanLine');
const scanHighlight = document.getElementById('scanHighlight');
const scanDots = document.getElementById('scanDots');
const progressBar = document.getElementById('progressBar');
const status = document.getElementById('status');
const registerBtn = document.getElementById('registerBtn');
const codeDisplay = document.getElementById('codeDisplay');
const ipDisplay = document.getElementById('ipDisplay');

// STATE VARIABLES
let isScanning = false;
let isLocked = false;
let audioCtx;
let scanProgress = 0;
let supabaseClient;

// INITIALIZATION
function init() {
  if (getCookie('blocked')) {
    window.location.href = 'whoareyou/index.html';
    return;
  }

  initSupabase();
  setupEventListeners();
  checkDeviceCapabilities();
  fetchIPAddress();
}

// SUPABASE FUNCTIONS
function initSupabase() {
  supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseKey);
  checkUserRegistration();
}

async function checkUserRegistration() {
  const { data, error } = await supabaseClient
    .from('user_credentials')
    .select('*');
  
  if (!error && data && data.length > 0) {
    status.textContent = "READY FOR AUTHENTICATION";
  } else {
    status.textContent = "REGISTER FINGERPRINT";
    registerBtn.style.display = 'block';
  }
}

// WEBAUTHN FUNCTIONS
async function registerFingerprint() {
  try {
    startScan();
    status.textContent = "READY TO REGISTER FINGERPRINT...";
    
    const userId = generateUserId();
    const publicKeyOptions = getPublicKeyCredentialOptions(userId);
    
    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions
    });
    
    await saveCredentialToSupabase(credential, userId);
    
    finishScan(true);
    status.textContent = "FINGERPRINT REGISTERED!";
    vault.classList.add('success-pulse');
    setTimeout(() => {
      vault.classList.remove('success-pulse');
      status.textContent = "READY FOR AUTHENTICATION";
    }, 2000);
    
  } catch (error) {
    console.error("Registration error:", error);
    handleAuthError(error);
  }
}

async function authenticateFingerprint() {
  try {
    startScan();
    
    const { data: credentials, error } = await supabaseClient
      .from('user_credentials')
      .select('*');
    
    if (error) throw error;
    if (!credentials || credentials.length === 0) {
      registerBtn.style.display = 'block';
      throw new Error("No credentials found");
    }
    
    const assertion = await navigator.credentials.get({
      publicKey: getAuthOptions(credentials)
    });
    
    await verifyAssertion(assertion);
    
    finishScan(true);
    status.textContent = "AUTHENTICATION SUCCESS!";
    vault.classList.add('success-pulse');
    
    setTimeout(() => {
      window.location.href = 'dashboard/index.html';
    }, 1000);
    
  } catch (error) {
    console.error("Authentication error:", error);
    handleAuthError(error);
  }
}

// HELPER FUNCTIONS
function setupEventListeners() {
  scanner.addEventListener('click', () => {
    if (!isScanning && !isLocked) {
      authenticateFingerprint();
    }
  });
  
  registerBtn.addEventListener('click', registerFingerprint);
  
  // Developer mode secret code
  let keyBuffer = [];
  document.addEventListener('keydown', (e) => {
    keyBuffer.push(e.key.toUpperCase());
    if (keyBuffer.length > config.secretCode.length) {
      keyBuffer.shift();
    }
    
    if (keyBuffer.join('') === config.secretCode) {
      status.textContent = "DEVELOPER MODE ACTIVATED";
      vault.style.borderColor = "#ff00ff";
      playBeep(1000, 0.5);
      resetAttempts();
    }
  });
  
  // Initialize audio on first interaction
  scanner.addEventListener('mousedown', initAudio, { once: true });
}

function checkDeviceCapabilities() {
  if (!window.PublicKeyCredential) {
    status.textContent = "FINGERPRINT AUTH NOT SUPPORTED";
    return;
  }
}

function fetchIPAddress() {
  fetch('https://api.ipify.org?format=json')
    .then(res => res.json())
    .then(data => {
      ipDisplay.textContent = `Your IP: ${data.ip}`;
    })
    .catch(() => {
      ipDisplay.textContent = 'Your IP: Unknown';
    });
}

// SCAN ANIMATION FUNCTIONS
function startScan() {
  isScanning = true;
  scanProgress = 0;
  status.textContent = "SCANNING...";
  scanLine.style.opacity = "1";
  scanHighlight.style.opacity = "0.3";
  scanHighlight.style.animation = "highlight-pulse 0.5s infinite";
  scanDots.style.opacity = "0.2";
  scanDots.style.animation = "dots-pulse 0.7s infinite";
  playBeep(800, 0.3);
  
  const progressInterval = setInterval(updateScanProgress, config.scanDuration / 100);
  
  return {
    stop: () => {
      clearInterval(progressInterval);
    }
  };
}

function updateScanProgress() {
  scanProgress += 1;
  progressBar.style.width = `${scanProgress}%`;
  
  if (Math.random() > 0.7) {
    const point = getRandomScanPoint();
    scanner.style.background = getFingerprintBackground(point);
  }
}

function finishScan(success) {
  isScanning = false;
  resetScanElements();
  
  if (success) {
    playBeep(1000, 0.5);
  } else {
    playBeep(400, 0.2);
  }
}

// AUDIO FUNCTIONS
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

// INITIALIZE APP
document.addEventListener('DOMContentLoaded', init);
