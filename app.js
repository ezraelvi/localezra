import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Konfigurasi
const CONFIG = {
  supabaseUrl: "https://hjmosjvfrycamxowfurq.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM",
  secretPassword: "rahasia123", // Ganti dengan password yang lebih aman
  rpName: "Aplikasi Sidik Jari Saya"
};

// Inisialisasi Supabase
const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// Fungsi Utility
const utils = {
  arrayToBase64: (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))),
  base64ToArray: (base64) => Uint8Array.from(atob(base64), c => c.charCodeAt(0)),
  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  showError: (element, message) => {
    element.textContent = message;
    element.style.color = "#ff0033";
  },
  showSuccess: (element, message) => {
    element.textContent = message;
    element.style.color = "#00ff88";
  }
};

// WebAuthn Service
const webauthnService = {
  isSupported: () => window.PublicKeyCredential !== undefined,
  
  register: async (email) => {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const publicKey = {
        challenge,
        rp: { name: CONFIG.rpName },
        user: {
          id: new TextEncoder().encode(email),
          name: email,
          displayName: email
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },  // ES256
          { type: "public-key", alg: -257 } // RS256
        ],
        timeout: 60000,
        attestation: "direct",
        authenticatorSelection: {
          userVerification: "required"
        }
      };

      const credential = await navigator.credentials.create({ publicKey });
      
      return {
        rawId: utils.arrayToBase64(credential.rawId),
        attestationObject: utils.arrayToBase64(credential.response.attestationObject),
        clientDataJSON: utils.arrayToBase64(credential.response.clientDataJSON)
      };
    } catch (error) {
      throw new Error(`Registrasi gagal: ${error.message}`);
    }
  },

  authenticate: async (email) => {
    try {
      const { data: creds, error } = await supabase
        .from("user_credentials")
        .select("credential_id")
        .eq("user_id", email);

      if (error || !creds?.length) throw new Error("Tidak ada credential terdaftar");

      const allowCredentials = creds.map(c => ({
        id: utils.base64ToArray(c.credential_id),
        type: "public-key",
        transports: ["internal"]
      }));

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const publicKey = {
        challenge,
        allowCredentials,
        timeout: 60000,
        userVerification: "required"
      };

      const assertion = await navigator.credentials.get({ publicKey });
      return !!assertion; // Return true jika berhasil
    } catch (error) {
      throw new Error(`Autentikasi gagal: ${error.message}`);
    }
  }
};

// Main Application
document.addEventListener("DOMContentLoaded", () => {
  // Inisialisasi DOM elements
  const elements = {
    accessPassword: document.getElementById("accessPassword"),
    accessBtn: document.getElementById("accessBtn"),
    accessStatus: document.getElementById("accessStatus"),
    registerContainer: document.getElementById("registerContainer"),
    userEmail: document.getElementById("userEmail"),
    registerBtn: document.getElementById("registerFingerprintBtn"),
    registerStatus: document.getElementById("registerStatus"),
    loginEmail: document.getElementById("loginEmail"),
    loginBtn: document.getElementById("loginFingerprintBtn"),
    loginStatus: document.getElementById("loginStatus")
  };

  // Event Listeners
  elements.accessBtn.addEventListener("click", handleAccess);
  elements.registerBtn.addEventListener("click", handleRegister);
  elements.loginBtn.addEventListener("click", handleLogin);

  // Handler Functions
  async function handleAccess() {
    const password = elements.accessPassword.value.trim();
    if (password === CONFIG.secretPassword) {
      elements.accessStatus.textContent = "Akses diberikan!";
      document.getElementById("access-register").classList.add("hidden");
      elements.registerContainer.classList.remove("hidden");
    } else {
      utils.showError(elements.accessStatus, "Password salah!");
    }
  }

  async function handleRegister() {
    const email = elements.userEmail.value.trim().toLowerCase();
    
    if (!utils.validateEmail(email)) {
      utils.showError(elements.registerStatus, "Email tidak valid");
      return;
    }

    if (!webauthnService.isSupported()) {
      utils.showError(elements.registerStatus, "Browser tidak mendukung WebAuthn");
      return;
    }

    try {
      utils.showSuccess(elements.registerStatus, "Mempersiapkan pendaftaran...");
      
      const credential = await webauthnService.register(email);
      
      const { error } = await supabase.from("user_credentials").insert([{
        user_id: email,
        credential_id: credential.rawId,
        public_key: credential.attestationObject,
        attestation_object: credential.attestationObject,
        client_data_json: credential.clientDataJSON,
        device_type: navigator.userAgent
      }]);

      if (error) throw error;
      
      utils.showSuccess(elements.registerStatus, "Pendaftaran berhasil!");
      elements.registerContainer.classList.add("hidden");
    } catch (error) {
      utils.showError(elements.registerStatus, error.message);
    }
  }

  async function handleLogin() {
    const email = elements.loginEmail.value.trim().toLowerCase();
    
    if (!utils.validateEmail(email)) {
      utils.showError(elements.loginStatus, "Email tidak valid");
      return;
    }

    if (!webauthnService.isSupported()) {
      utils.showError(elements.loginStatus, "Browser tidak mendukung WebAuthn");
      return;
    }

    try {
      utils.showSuccess(elements.loginStatus, "Memverifikasi sidik jari...");
      
      const isAuthenticated = await webauthnService.authenticate(email);
      
      if (isAuthenticated) {
        utils.showSuccess(elements.loginStatus, "Login berhasil! Mengarahkan...");
        // Redirect setelah 1 detik
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1000);
      } else {
        throw new Error("Autentikasi gagal");
      }
    } catch (error) {
      utils.showError(elements.loginStatus, error.message);
    }
  }
});
