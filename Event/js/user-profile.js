// User Profile Execution Engine (js/user-profile.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    async function loadData() {
        const { data: profile } = await supabase.from('profiles').select('full_name, phone, business_name').eq('id', user.id).single();
        if(profile) {
            document.getElementById('pName').value = profile.full_name || '';
            document.getElementById('pPhone').value = profile.phone || '';
            document.getElementById('pBiz').value = profile.business_name || 'Admin Controlled Entity';
        }
    }

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSavePro');
        btn.disabled = true;

        const phone = document.getElementById('pPhone').value.trim();
        const { error } = await supabase.from('profiles').update({ phone }).eq('id', user.id);

        if(error) Utils.showToast(error.message, "error");
        else Utils.showToast("Contact array physically securely updated globally!", "success");

        btn.disabled = false;
    });

    document.getElementById('passForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSavePas');
        btn.disabled = true;

        const p = document.getElementById('pPass').value;
        const { error } = await supabase.auth.updateUser({ password: p });

        if(error) Utils.showToast(error.message, "error");
        else {
            Utils.showToast("Authentication string successfully forcefully rotated globally!", "success");
            document.getElementById('passForm').reset();
        }

        btn.disabled = false;
    });

    loadData();
});
