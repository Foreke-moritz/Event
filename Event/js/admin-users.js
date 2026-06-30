// Admin Staff Management Logic (js/admin-users.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    let profilesCore = [];

    async function loadStaff() {
        const tbody = document.getElementById('staffTbody');
        
        // Complex query explicitly checking matching admin_id ensuring multi-tenant limits globally
        const { data, error } = await supabase.from('profiles').select('id, full_name, phone, is_active, role').eq('admin_id', user.id).eq('role', 'staff');
        if(error) { Utils.showToast("Profile pull failed", "error"); return; }
        
        profilesCore = data || [];

        if(profilesCore.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No subordinate staff generated. Expand your internal ranks!</td></tr>';
            return;
        }

        // Fetch sales count aggressively bridging relational queries cleanly avoiding expensive overheads
        const staffIds = profilesCore.map(p => p.id);
        const { data: salesCount } = await supabase.from('sales').select('staff_id').in('staff_id', staffIds);
        
        const countMap = {};
        if(salesCount) {
            salesCount.forEach(sc => {
                if(!countMap[sc.staff_id]) countMap[sc.staff_id] = 0;
                countMap[sc.staff_id]++;
            });
        }

        tbody.innerHTML = profilesCore.map(p => `
            <tr>
                <td style="font-weight: 500;">${p.full_name}</td>
                <td>${p.phone || '-'}</td>
                <td>${p.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Disabled</span>'}</td>
                <td style="font-weight: 600; color:var(--primary-color);">${countMap[p.id] || 0}</td>
                <td>
                    <button class="btn btn-outline" style="padding: 0.3rem; margin-right: 0.5rem;" onclick="toggleStatus('${p.id}', ${!p.is_active})" title="${p.is_active?'Disable Account':'Enable Account'}">
                        <i class="fa-solid ${p.is_active ? 'fa-user-lock' : 'fa-user-check'}" style="color:${p.is_active ? 'var(--warning)':'var(--success)'};"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    window.toggleStatus = async (id, activateObj) => {
        const { error } = await supabase.from('profiles').update({ is_active: activateObj }).eq('id', id);
        if(error) Utils.showToast(error.message, "error");
        else { Utils.showToast(`User ${activateObj ? 'Enabled' : 'Disabled'} universally!`, "success"); loadStaff(); }
    };


    // Staff Creation Handler
    // Uses REST API to create the auth user (preserving admin session),
    // then explicitly inserts the profile row via the admin's SDK session.
    document.getElementById('staffForm').addEventListener('submit', async(e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSaveStaff');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating Staff Account...';

        const name = document.getElementById('sName').value.trim();
        const email = document.getElementById('sEmail').value.trim();
        const phone = document.getElementById('sPhone').value.trim();
        const pass = document.getElementById('sPass').value;

        try {
            // Step 1: Create auth user via REST to avoid session swap
            const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    email: email,
                    password: pass,
                    data: {
                        full_name: name,
                        phone: phone,
                        role: 'staff',
                        admin_id: user.id
                    }
                })
            });

            const result = await response.json();

            if (!response.ok) {
                Utils.showToast(result.msg || result.error_description || "Failed to create staff auth account.", "error");
                btn.disabled = false; btn.innerHTML = 'Execute Profile Registration';
                return;
            }

            const newUserId = result.id;
            if (!newUserId) {
                Utils.showToast("Account created but no user ID returned. Please try again.", "error");
                btn.disabled = false; btn.innerHTML = 'Execute Profile Registration';
                return;
            }

            // Step 2: Wait briefly for the DB trigger to fire
            await new Promise(r => setTimeout(r, 1500));

            // Step 3: Check if the trigger already created the profile
            const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', newUserId).maybeSingle();

            if (!existingProfile) {
                // Trigger didn't create the profile — insert it manually as the admin
                const { error: insertErr } = await supabase.from('profiles').insert({
                    id: newUserId,
                    full_name: name,
                    phone: phone || null,
                    role: 'staff',
                    admin_id: user.id,
                    is_active: true
                });

                if (insertErr) {
                    console.error("Manual profile insert failed:", insertErr);
                    Utils.showToast("Auth account created, but profile link failed: " + insertErr.message, "error");
                    btn.disabled = false; btn.innerHTML = 'Execute Profile Registration';
                    return;
                }
            }

            Utils.showToast("Staff Member provisioned successfully!", "success");
            document.getElementById('staffForm').reset();
            document.getElementById('modalStaff').style.display = 'none';
            loadStaff();

        } catch (err) {
            Utils.showToast("Critical failure: " + err.message, "error");
        }

        btn.disabled = false; btn.innerHTML = 'Execute Profile Registration';
    });


    loadStaff();
});
