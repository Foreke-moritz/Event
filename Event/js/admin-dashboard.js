// Admin Dashboard Logic (js/admin-dashboard.js)

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Guard resolves it

    let currency = 'FCFA';
    const { data: bset } = await supabase.from('business_settings').select('currency').eq('admin_id', user.id).single();
    if (bset && bset.currency) currency = bset.currency;

    // Load Metrics
    async function loadMetrics() {
        try {
            // 1. Products & Stock
            const { data: products } = await supabase.from('products').select('quantity, low_stock_limit');
            let totalProd = products?.length || 0;
            let totalStock = 0;
            let lowStock = 0;
            let outStock = 0;

            if (products) {
                products.forEach(p => {
                    totalStock += p.quantity;
                    if (p.quantity === 0) outStock++;
                    else if (p.quantity <= p.low_stock_limit) lowStock++;
                });
            }

            // 2. Sales & Profits
            const { data: sales } = await supabase.from('sales').select('total_amount, total_profit, sale_date');
            let totalSalesAmount = 0;
            let totalProfitAmount = 0;
            let todaySales = 0;
            let monthSales = 0;

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const monthStr = todayStr.substring(0, 7); // YYYY-MM

            if (sales) {
                sales.forEach(s => {
                    totalSalesAmount += Number(s.total_amount);
                    totalProfitAmount += Number(s.total_profit);
                    
                    const sDateStr = s.sale_date.split('T')[0];
                    if (sDateStr === todayStr) todaySales += Number(s.total_amount);
                    if (sDateStr.startsWith(monthStr)) monthSales += Number(s.total_amount);
                });
            }

            // 3. Staff Users
            const { count: staffCount } = await supabase.from('profiles').select('id', { count: 'exact' }).eq('admin_id', user.id).eq('role', 'staff');

            // Render Tops
            const mTop = document.getElementById('topMetrics');
            mTop.innerHTML = `
                <div class="metric"><i class="fa-solid fa-box-open icon"></i><h4>Total Products</h4><div class="val">${totalProd}</div></div>
                <div class="metric" style="border-color: var(--info)"><i class="fa-solid fa-cubes icon"></i><h4>Total Stock</h4><div class="val">${totalStock}</div></div>
                <div class="metric" style="border-color: var(--success)"><i class="fa-solid fa-sack-dollar icon"></i><h4>Total Sales</h4><div class="val">${Utils.formatCurrency(totalSalesAmount, currency)}</div></div>
                <div class="metric" style="border-color: var(--success)"><i class="fa-solid fa-piggy-bank icon"></i><h4>Total Profit</h4><div class="val">${Utils.formatCurrency(totalProfitAmount, currency)}</div></div>
            `;

            const mBot = document.getElementById('bottomMetrics');
            mBot.innerHTML = `
                <div class="metric"><i class="fa-solid fa-calendar-day icon"></i><h4>Today's Sales</h4><div class="val">${Utils.formatCurrency(todaySales, currency)}</div></div>
                <div class="metric"><i class="fa-solid fa-calendar-days icon"></i><h4>This Month's Sales</h4><div class="val">${Utils.formatCurrency(monthSales, currency)}</div></div>
                <div class="metric" style="border-color: var(--warning)"><i class="fa-solid fa-triangle-exclamation icon"></i><h4>Low Stock</h4><div class="val">${lowStock}</div></div>
                <div class="metric" style="border-color: var(--danger)"><i class="fa-solid fa-circle-exclamation icon"></i><h4>Out of Stock</h4><div class="val">${outStock}</div></div>
                <div class="metric" style="border-color: var(--info)"><i class="fa-solid fa-user-tie icon"></i><h4>Staff Users</h4><div class="val">${staffCount || 0}</div></div>
            `;

        } catch (e) {
            console.error("Metric Error API:", e);
        }
    }

    // Load Recent Sales Table
    async function loadRecentSales() {
        // Query leveraging staff_id relational map manually
        const { data: sales, error } = await supabase
            .from('sales')
            .select(`*`)
            .order('sale_date', { ascending: false })
            .limit(5);

        const tbody = document.getElementById('recentSalesTbody');
        if (error || !sales || sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent sales.</td></tr>';
            return;
        }

        // We will fetch Staff names locally to avoid complex joins for simple Vanilla JS scope
        const staffIds = [...new Set(sales.map(s => s.staff_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', staffIds);
        const staffMap = {};
        if(profiles) profiles.forEach(p => staffMap[p.id] = p.full_name);

        tbody.innerHTML = sales.map(s => `
            <tr>
                <td style="font-weight: 600;">${s.receipt_number}</td>
                <td>${staffMap[s.staff_id] || 'Unknown Staff'}</td>
                <td style="color: var(--success); font-weight:600;">${Utils.formatCurrency(s.total_amount, currency)}</td>
                <td>${Utils.formatDate(s.sale_date)}</td>
            </tr>
        `).join('');
    }

    // Load Alerts
    async function loadAlerts() {
        const { data: lowProducts } = await supabase
            .from('products')
            .select('name, quantity')
            .lte('quantity', 5) // Simplification for dashboard logic
            .order('quantity', { ascending: true })
            .limit(5);

        const container = document.getElementById('alertsContainer');
        if (!lowProducts || lowProducts.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; color: var(--success); text-align: center;"><i class="fa-solid fa-check-circle"></i> All stock levels are healthy!</div>';
            return;
        }

        container.innerHTML = lowProducts.map(p => {
            const isOut = p.quantity === 0;
            return `
                <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-weight: 500;">${p.name}</span>
                    <span class="badge ${isOut ? 'badge-danger' : 'badge-warning'}">${p.quantity} left</span>
                </div>
            `;
        }).join('');
    }

    // Execute globally
    loadMetrics();
    loadRecentSales();
    loadAlerts();
});
