// Initialize Supabase client
const initializeSupabase = () => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@supabase/supabase-js@2';
    script.onload = () => {
      const { createClient } = supabase;
      
      const supabaseUrl = process.env.SUPABASE_URL || 'https://hjmosjvfrycamxowfurq.supabase.co';
      const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbW9zanZmcnljYW14b3dmdXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTU1MTQsImV4cCI6MjA2NDQzMTUxNH0.8KNrzHleB62I4x7kjF-aR41vAmbbpJLgAkhhcZVwSSM';
      
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          flowType: 'pkce',
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        }
      });
      
      resolve(supabaseClient);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// WebAuthn Registration
const registerWebAuthn = async (supabaseClient, userId, email) => {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: 'temporary-password-for-webauthn' // This should be handled securely
    });
    
    if (error) throw error;
    
    const { data: webauthnData, error: webauthnError } = await supabaseClient.auth.signInWithWebAuthn({
      domain: window.location.hostname,
      callbackUrl: window.location.origin + '/vfiles/index.html'
    });
    
    if (webauthnError) throw webauthnError;
    
    return webauthnData;
  } catch (error) {
    console.error('WebAuthn registration error:', error);
    throw error;
  }
};

// WebAuthn Authentication
const authenticateWithWebAuthn = async (supabaseClient) => {
  try {
    const { data, error } = await supabaseClient.auth.signInWithWebAuthn({
      domain: window.location.hostname,
      callbackUrl: window.location.origin + '/vfiles/index.html'
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('WebAuthn authentication error:', error);
    throw error;
  }
};

export { initializeSupabase, registerWebAuthn, authenticateWithWebAuthn };
