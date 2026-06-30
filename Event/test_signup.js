const SUPABASE_URL = 'https://iauygoepkkwqmzairuvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdXlnb2Vwa2t3cW16YWlydXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjU0MjEsImV4cCI6MjA5NTg0MTQyMX0.dWDLJwb9NiUVVxp1GNS17OnKXQiuGXpqDqG0WaLyfc4';

async function testSignup() {
    console.log("Starting signup test...");
    const email = `teststaff_${Date.now()}@test.com`;
    console.log("Email:", email);
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            email: email,
            password: 'password123',
            data: {
                full_name: 'Test Staff',
                phone: '123456789',
                role: 'staff',
                admin_id: 'b6f4e1f0-4567-4632-1234-abcdef123456' // fake uuid
            }
        })
    });
    
    const result = await response.json();
    console.log("Signup Result API response:");
    console.log(JSON.stringify(result, null, 2));
}
testSignup();
