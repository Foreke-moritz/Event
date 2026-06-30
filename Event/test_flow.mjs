import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://iauygoepkkwqmzairuvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdXlnb2Vwa2t3cW16YWlydXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjU0MjEsImV4cCI6MjA5NTg0MTQyMX0.dWDLJwb9NiUVVxp1GNS17OnKXQiuGXpqDqG0WaLyfc4';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
    console.log("Creating admin account via SDK...");
    const email = `admin_${Date.now()}@test.com`;
    // 1. Create an admin
    const { data: adminAuth, error: adminErr } = await supabase.auth.signUp({
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

    // 2. Fetch admin profile to confirm trigger worked natively
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*').eq('id', adminAuth.user.id);
    console.log("Admin Profile:", profiles);

    // 3. Emulate admin-users.js logic by calling the REST API exactly!
    const staffEmail = `staff_${Date.now()}@test.com`;
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

    // 4. Fetch the staff list as the Admin
    const { data: staffList, error: sError } = await supabase.from('profiles').select('*').eq('admin_id', adminAuth.user.id).eq('role', 'staff');
    console.log("Fetched Staff List Check (admin_users.js emulation):");
    console.log(staffList, sError);
}
runTest();
