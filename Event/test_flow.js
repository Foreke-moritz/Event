const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://iauygoepkkwqmzairuvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdXlnb2Vwa2t3cW16YWlydXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjU0MjEsImV4cCI6MjA5NTg0MTQyMX0.dWDLJwb9NiUVVxp1GNS17OnKXQiuGXpqDqG0WaLyfc4';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
    console.log("Creating admin account via SDK...");
    const email = `admin_inv_${Date.now()}@gmail.com`;
    // 1. Create an admin
    let { data: adminAuth, error: adminErr } = await supabase.auth.signUp({
        email: email,
        password: 'password123',
        options: {
            data: { full_name: 'Admin User', business_name: 'Test Biz', phone: '123123', role: 'admin' }
        }
    });

    if (adminErr) {
        console.error("Failed to create admin:", adminErr);
        return;
    }
    console.log("Admin created! Session:", !!adminAuth.session, "Admin ID:", adminAuth.user?.id);

    // If signup doesn't return session directly (e.g. email confirmations enabled), we'd need to mock it if possible, but let's see.
    // If we have no session, we can't query profiles easily via client due to RLS, but let's see what happens.
    
    // 2. Emulate admin-users.js logic by calling the REST API exactly!
    const staffEmail = `staff_inv_${Date.now()}@gmail.com`;
    console.log("Registering staff natively...");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            email: staffEmail,
            password: 'password123',
            data: {
                full_name: 'A Staff Worker',
                phone: '123456',
                role: 'staff',
                admin_id: adminAuth.user.id
            }
        })
    });
    
    const staffResult = await response.json();
    console.log("Staff signup response info:", response.ok, staffResult.id ? "Success" : staffResult);

    // 4. Fetch the staff list as the Admin (Requires a session)
    if(adminAuth.session) {
        const { data: staffList, error: sError } = await supabase.from('profiles').select('*').eq('admin_id', adminAuth.user.id).eq('role', 'staff');
        console.log("Fetched Staff List Check (admin_users.js emulation):");
        console.log(staffList, sError);
    } else {
        console.log("Cannot query because admin is not signed in automatically! Attempting sign-in...");
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: email, password: 'password123'
        });
        if(signInErr) {
             console.log("Could not sign in manually:", signInErr);
        } else {
             const { data: staffList, error: sError } = await supabase.from('profiles').select('*').eq('admin_id', signInData.user.id).eq('role', 'staff');
             console.log("Fetched Staff List Check (admin_users.js emulation with later sign in):");
             console.log(staffList, sError);
        }
    }
}
runTest();
