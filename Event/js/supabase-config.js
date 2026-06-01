// Configuration Binding - Supabase (js/supabase-config.js)

// IMPORTANT: Replace these strictly with your specific Supabase credentials natively directly extracted safely.
const SUPABASE_URL = 'https://iauygoepkkwqmzairuvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdXlnb2Vwa2t3cW16YWlydXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjU0MjEsImV4cCI6MjA5NTg0MTQyMX0.dWDLJwb9NiUVVxp1GNS17OnKXQiuGXpqDqG0WaLyfc4';

if(typeof supabase !== 'undefined') {
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("Supabase CDN failed strictly. Cannot mount database securely!");
}
