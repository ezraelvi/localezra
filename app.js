// CONFIGURATION
const config = {
  maxAttempts: 3,
  scanDuration: 3000,
  secretCode: "LOCALLIFE",
  attemptCookieExpiry: 10, // minutes
  supabaseUrl: 'https://hjmosjvfrycamxowfurq.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM'
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

function getPublicKeyCredentialOptions(userId) {
  return {
    challenge: Uint8Array.from(
      window.crypto.getRandomValues(new Uint8Array(32))).buffer,
    rp: {
      name: "Secure V Local",
      id: window.location.hostname,
    },
    user: {
      id: Uint8Array.from(userId, c => c.charCodeAt(0)),
      name: userId,
      displayName: "Secure User",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },  // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
    },
    timeout: 60000,
    attestation: "direct"
  };
}

async function saveCredentialToSupabase(credential, userId) {
  const attestationObject = new Uint8Array(credential.response.attestationObject);
  const clientDataJSON = new Uint8Array(credential.response.clientDataJSON);
  const rawId = new Uint8Array(credential.rawId);
  
  const { data, error } = await supabaseClient
    .from('user_credentials')
    .insert([{
      user_id: userId,
      credential_id: rawId,
      public_key: credential.id,
      attestation_object: attestationObject,
      client_data_json: clientDataJSON,
      device_type: getDeviceType()
    }]);
  
  if (error) throw error;
  return data;
}

function getAuthOptions(credentials) {
  const allowedCredentials = credentials.map(cred => ({
    id: Uint8Array.from(cred.credential_id),
    type: 'public-key',
    transports: ['internal']
  }));

  return {
    challenge: Uint8Array.from(
      window.crypto.getRandomValues(new Uint8Array(32))).buffer,
    allowCredentials: allowedCredentials,
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

function handleAuthError(error) {
  finishScan(false);
  const attemptCount = updateAttemptCount();
  
  if (attemptCount >= config.maxAttempts) {
    triggerLockdown();
  } else {
    status.textContent = `AUTH FAILED (${attemptCount}/${config.maxAttempts})`;
    setTimeout(() => {
      status.textContent = "READY FOR AUTHENTICATION";
      registerBtn.style.display = 'block';
    }, 1500);
  }
}

function resetScanElements() {
  scanLine.style.opacity = "0";
  scanHighlight.style.opacity = "0";
  scanHighlight.style.animation = "none";
  scanDots.style.opacity = "0";
  scanDots.style.animation = "none";
  progressBar.style.width = "0%";
  scanner.style.background = `url('data:image/svg+xml;utf8,...') center/contain no-repeat`;
}

function getRandomScanPoint() {
  const points = [
    {x: 30, y: 20},
    {x: 70, y: 40},
    {x: 20, y: 60},
    {x: 80, y: 80},
    {x: 50, y: 50}
  ];
  return points[Math.floor(Math.random() * points.length)];
}

function getFingerprintBackground(point) {
  return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><path d="M15,20 Q50,0 85,20 Q95,40 85,60 Q75,80 50,90 Q25,80 15,60 Q5,40 15,20" fill="none" stroke="%2300ff88" stroke-width="0.5" stroke-dasharray="2,1"/></svg>') center/contain no-repeat, 
          radial-gradient(circle at ${point.x}% ${point.y}%, rgba(0,255,136,0.3) 0%, transparent 70%)`;
}
