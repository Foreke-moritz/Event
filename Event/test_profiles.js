const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://iauygoepkkwqmzairuvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdXlnb2Vwa2t3cW16YWlydXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjU0MjEsImV4cCI6MjA5NTg0MTQyMX0.dWDLJwb9NiUVVxp1GNS17OnKXQiuGXpqDqG0WaLyfc4';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    const { data, error } = await supabase.from('profiles').select('*');
    console.log("Profiles Data:");
    console.log(JSON.stringify(data, null, 2));
    if (error) console.log("Error:", error);
}
test();
