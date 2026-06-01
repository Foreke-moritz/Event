// Staff Dashboard Execution (js/user-dashboard.js)

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; 

    // Retrieve relational config accurately pulling parent admin_id properly
    const { data: profile } = await supabase.from('profiles').select('admin_id').eq('id', user.id).single();
    if (!profile) return;
    const adminId = profile.admin_id;

    let currency = 'FCFA';
    const { data: bset } = await supabase.from('business_settings').select('currency').eq('admin_id', adminId).single();
    if (bset && bset.currency) currency = bset.currency;

    // Build Interfaces
    async function loadMetrics() {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // 1. Fetch Sales mapping only this user's transactions today strictly!
        const { data: sales } = await supabase.from('sales')
            .select('total_amount, sale_date')
            .eq('staff_id', user.id)
            .gte('sale_date', todayStr + 'T00:00:00');

        let trxToday = 0;
        let revToday = 0;

        if (sales) {
            trxToday = sales.length;
            sales.forEach(s => revToday += Number(s.total_amount));
        }

        // 2. Fetch Generic Available Products under Admin Limit natively encapsulating constraints
        const { count: prodCount } = await supabase.from('products')
            .select('id', { count: 'exact' })
            .eq('admin_id', adminId)
            .eq('is_active', true);

        const mTop = document.getElementById('topMetrics');
        mTop.innerHTML = `
            <div class="metric"><i class="fa-solid fa-receipt icon"></i><h4>Transactions Today</h4><div class="val">${trxToday}</div></div>
            <div class="metric" style="border-color: var(--success)"><i class="fa-solid fa-coins icon"></i><h4>Gross Generated Today</h4><div class="val">${Utils.formatCurrency(revToday, currency)}</div></div>
            <div class="metric" style="border-color: var(--info)"><i class="fa-solid fa-layer-group icon"></i><h4>Products Available</h4><div class="val">${prodCount || 0}</div></div>
        `;
    }

    async function loadRecentLog() {
        const tbody = document.getElementById('recentSalesTbody');
        const { data: rSales, error } = await supabase.from('sales')
            .select('receipt_number, sale_date, payment_method, total_amount')
            .eq('staff_id', user.id)
            .order('sale_date', { ascending: false })
            .limit(5);

        if (error || !rSales || rSales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent sale logs. Open the register!</td></tr>';
            return;
        }

        tbody.innerHTML = rSales.map(s => {
            const time = new Date(s.sale_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            return `<tr>
                <td style="font-weight:600;">${s.receipt_number}</td>
                <td>${time}</td>
                <td><span class="badge" style="background:var(--bg-color); color:var(--text-main);">${s.payment_method}</span></td>
                <td style="color:var(--success); font-weight:600;">${Utils.formatCurrency(s.total_amount, currency)}</td>
            </tr>`;
        }).join('');
    }

    async function loadAlerts() {
        // Staff can only view alerts
        const { data: lows } = await supabase.from('products').select('name, quantity')
            .eq('admin_id', adminId).eq('is_active', true).lte('quantity', 5).order('quantity', { ascending: true }).limit(5);
        
        const container = document.getElementById('alertsContainer');
        if (!lows || lows.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; color: var(--success); text-align: center;"><i class="fa-solid fa-check-circle"></i> Stock inventory looks stable.</div>';
            return;
        }

        container.innerHTML = lows.map(p => {
            const out = p.quantity === 0;
            return `
                <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px dashed var(--border-color);">
                    <span style="font-weight: 500; font-size: 0.9rem;">${p.name}</span>
                    <span class="badge ${out ? 'badge-danger' : 'badge-warning'}" style="font-size:0.75rem;">${p.quantity} units</span>
                </div>
            `;
        }).join('');
    }

    loadMetrics();
    loadRecentLog();
    loadAlerts();
});
