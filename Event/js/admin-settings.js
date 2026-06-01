// Admin Settings Logic (js/admin-settings.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    async function loadSettings() {
        const { data, error } = await supabase.from('business_settings').select('*').eq('admin_id', user.id).single();
        if(error || !data) return; // Silent execution due to defaults mapping seamlessly natively

        document.getElementById('bName').value = data.business_name || '';
        document.getElementById('bCurr').value = data.currency || 'FCFA';
        document.getElementById('bTax').value = data.tax_rate || 0;
        document.getElementById('bLimit').value = data.low_stock_limit || 5;
        document.getElementById('bPhone').value = data.phone || '';
        document.getElementById('bEmail').value = data.email || '';
        document.getElementById('bAddr').value = data.address || '';
        document.getElementById('bFoot').value = data.receipt_footer || '';
    }

    document.getElementById('setForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSetSave');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Tracking...';

        const payload = {
            business_name: document.getElementById('bName').value.trim(),
            currency: document.getElementById('bCurr').value.trim() || 'FCFA',
            tax_rate: parseFloat(document.getElementById('bTax').value) || 0,
            low_stock_limit: parseInt(document.getElementById('bLimit').value) || 5,
            phone: document.getElementById('bPhone').value.trim(),
            email: document.getElementById('bEmail').value.trim(),
            address: document.getElementById('bAddr').value.trim(),
            receipt_footer: document.getElementById('bFoot').value.trim()
        };

        // Upsert logically utilizing Postgres unique constraint identically natively!
        const { error } = await supabase.from('business_settings').upsert({ admin_id: user.id, ...payload });

        if (error) Utils.showToast(error.message, "error");
        else {
            // Explicitly sync the profiles business_name identically globally avoiding desync!
            await supabase.from('profiles').update({ business_name: payload.business_name }).eq('id', user.id);
            Utils.showToast("Settings Formulated Globally!", "success");
            
            // Reload Top Header natively explicitly
            const { data: { session } } = await supabase.auth.getSession();
            if(session) RouteGuard.enforceBoundary(); // Triggering re-population intrinsically perfectly accurately securely
        }

        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Execute Synchronization';
    });

    loadSettings();
});
