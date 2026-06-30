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


    // Bypass SDK Session Overlap Explicitly!
    // Since Supabase JS v2 logs the current user out upon `signUp`, we bypass the SDK completely 
    // and manually fire a REST API request to `/auth/v1/signup` explicitly maintaining session integrity locally!
    document.getElementById('staffForm').addEventListener('submit', async(e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSaveStaff');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Routing API Bypass...';

        const name = document.getElementById('sName').value.trim();
        const email = document.getElementById('sEmail').value.trim();
        const phone = document.getElementById('sPhone').value.trim();
        const pass = document.getElementById('sPass').value;

        try {
            // Backup the admin's session before SDK overrides it
            const { data: { session } } = await supabase.auth.getSession();

            // Provision staff securely via core SDK handling metadata perfectly natively
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: pass,
                options: {
                    data: {
                        full_name: name,
                        phone: phone,
                        role: 'staff',
                        admin_id: session.user.id
                    }
                }
            });

            if (error) {
                Utils.showToast(error.message, "error");
            } else {
                Utils.showToast("Staff Member provisioned flawlessly!", "success");
                document.getElementById('staffForm').reset();
                document.getElementById('modalStaff').style.display = 'none';
                
                // Immediately restore the Admin's session natively to prevent redirect overlaps!
                if (session) {
                    await supabase.auth.setSession({
                        access_token: session.access_token,
                        refresh_token: session.refresh_token
                    });
                }
                
                loadStaff();
            }
        } catch (err) {
            Utils.showToast("Critical execution failure: " + err.message, "error");
        }

        btn.disabled = false; btn.innerHTML = 'Execute Profile Registration';
    });


    loadStaff();
});
