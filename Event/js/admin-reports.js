// Admin Reports Engine (js/admin-reports.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    let businessSettings = { currency: 'FCFA' };
    const { data: bset } = await supabase.from('business_settings').select('*').eq('admin_id', user.id).single();
    if(bset) businessSettings = { ...bset };

    const ph = document.getElementById('reportPlaceholder');
    const tableCont = document.getElementById('reportTableContainer');
    const tHead = document.getElementById('dynamicTableHead');
    const tBody = document.getElementById('dynamicTableBody');
    const title = document.getElementById('reportTitle');
    const sumBox = document.getElementById('reportSummaryBox');

    let currentExportPayload = [];
    let currentExportHeaders = [];

    document.getElementById('btnClear').addEventListener('click', () => {
        document.getElementById('rStart').value = '';
        document.getElementById('rEnd').value = '';
        document.getElementById('rMethod').value = 'all';
    });

    document.getElementById('btnGenerate').addEventListener('click', async () => {
        const type = document.getElementById('rType').value;
        const start = document.getElementById('rStart').value;
        const end = document.getElementById('rEnd').value;
        const method = document.getElementById('rMethod').value;

        const btn = document.getElementById('btnGenerate');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing...';

        try {
            if(type.startsWith('sales_')) await generateSalesReports(type, start, end, method);
            else if(type.startsWith('inv_')) await generateInventories(type);
            else if(type === 'staff_perf') await generateStaffPerf(start, end);
            else if(type === 'stock_moves') await generateStockMoves(start, end);
            
            ph.style.display = 'none';
            tableCont.style.display = 'block';
        } catch (e) {
            Utils.showToast("Report generation failed computationally: " + e.message, "error");
        }
        
        btn.disabled = false; btn.innerHTML = 'Generate Report';
    });

    // 1. Sales Generators
    async function generateSalesReports(type, start, end, method) {
        let query = supabase.from('sales').select('*').eq('admin_id', user.id).order('sale_date', { ascending: false });
        if(start) query = query.gte('sale_date', start + 'T00:00:00');
        if(end) query = query.lte('sale_date', end + 'T23:59:59');
        if(method !== 'all') query = query.eq('payment_method', method);

        const { data } = await query;
        const array = data || [];

        let html = '';
        let totalRev = 0; let totalProf = 0;

        if (type === 'sales_profit') {
            title.textContent = "Net Profit Valuation Ledger";
            currentExportHeaders = ["Receipt", "Date", "Revenue", "Profit Element"];
            currentExportPayload = array.map(s => {
                totalRev += Number(s.total_amount); totalProf += Number(s.total_profit);
                return [s.receipt_number, Utils.formatDate(s.sale_date), s.total_amount, s.total_profit];
            });

            tHead.innerHTML = `<tr><th>Receipt</th><th>Date</th><th>Revenue</th><th>Profit</th></tr>`;
            html = array.map(s => `<tr><td>${s.receipt_number}</td><td>${Utils.formatDate(s.sale_date)}</td><td style="color:var(--info); font-weight:600;">${Utils.formatCurrency(s.total_amount, businessSettings.currency)}</td><td style="color:var(--success); font-weight:600;">${Utils.formatCurrency(s.total_profit, businessSettings.currency)}</td></tr>`).join('');
            
            sumBox.innerHTML = `<div style="padding:1rem; background:rgba(15,23,42,0.05); border-radius:8px;">Total Revenue: <span style="font-size:1.2rem; color:var(--text-main);">${Utils.formatCurrency(totalRev, businessSettings.currency)}</span></div><div style="padding:1rem; background:rgba(16,185,129,0.1); border-radius:8px;">Gross Profit: <span style="font-size:1.2rem; color:var(--success);">${Utils.formatCurrency(totalProf, businessSettings.currency)}</span></div>`;
        } else {
            // General Sales
            title.textContent = type === 'sales_daily' ? "Daily Sales Transaction Tracking" : "Sales History Breakdown";
            currentExportHeaders = ["Receipt", "Date", "Customer", "Method", "Total"];
            currentExportPayload = array.map(s => {
                totalRev += Number(s.total_amount);
                return [s.receipt_number, Utils.formatDate(s.sale_date), s.customer_name||'-', s.payment_method, s.total_amount];
            });

            tHead.innerHTML = `<tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Method</th><th>Total</th></tr>`;
            html = array.map(s => `<tr><td>${s.receipt_number}</td><td>${Utils.formatDate(s.sale_date)}</td><td>${s.customer_name||'-'}</td><td>${s.payment_method}</td><td style="color:var(--success); font-weight:600;">${Utils.formatCurrency(s.total_amount, businessSettings.currency)}</td></tr>`).join('');
            
            sumBox.innerHTML = `<span style="color:var(--primary-color);">Total Transaction Volume: ${array.length}</span> | <span style="color:var(--success);">Gross Captured: ${Utils.formatCurrency(totalRev, businessSettings.currency)}</span>`;
        }
        
        if(array.length===0) html = '<tr><td colspan="5" style="text-align:center;">No data found matching parameters.</td></tr>';
        tBody.innerHTML = html;
    }

    // 2. Inventory Summaries
    async function generateInventories(type) {
        let query = supabase.from('products').select('*').eq('admin_id', user.id).order('name', { ascending: true });
        
        const { data } = await query;
        let array = data || [];

        if(type === 'inv_low') {
            title.textContent = "Low & Out-of-Stock Warning System";
            array = array.filter(p => p.quantity <= (p.low_stock_limit||5));
        } else {
            title.textContent = "Full Inventory Valuation Matrix";
        }

        let totalValue = 0; let totalQty = 0;
        currentExportHeaders = ["Product", "SKU", "Status", "Quantity", "Cost Price", "Sell Price", "Cumulative Val"];
        currentExportPayload = array.map(p => {
            const val = p.quantity * p.cost_price;
            totalValue += val; totalQty += p.quantity;
            let status = 'In Stock';
            if(p.quantity===0) status = 'Out of Stock'; else if (p.quantity <= (p.low_stock_limit||5)) status = 'Low Stock';
            return [p.name, p.sku||'-', status, p.quantity, p.cost_price, p.selling_price, val];
        });

        tHead.innerHTML = `<tr><th>Product</th><th>Status</th><th>Qty Available</th><th>Unit Cost</th><th>Total Asset Val</th></tr>`;
        tBody.innerHTML = array.length === 0 ? '<tr><td colspan="5" style="text-align:center;">All systems green - no flags detected.</td></tr>' : array.map(p => {
            let status = '<span class="badge badge-success">In Stock</span>';
            if(p.quantity===0) status = '<span class="badge badge-danger">Out of Stock</span>'; 
            else if (p.quantity <= (p.low_stock_limit||5)) status = '<span class="badge badge-warning">Low Stock</span>';
            
            return `<tr><td>${p.name}</td><td>${status}</td><td style="font-weight:600;">${p.quantity}</td><td>${Utils.formatCurrency(p.cost_price, businessSettings.currency)}</td><td style="font-weight:600;">${Utils.formatCurrency(p.quantity * p.cost_price, businessSettings.currency)}</td></tr>`;
        }).join('');

        if (type === 'inv_full') sumBox.innerHTML = `<span>Global Physical Stock: ${totalQty} units</span> | <span style="color:var(--primary-color);">Total Asset Valuation: ${Utils.formatCurrency(totalValue, businessSettings.currency)}</span>`;
        else sumBox.innerHTML = `CRITICAL ASSESSMENTS REQUIRED. ${array.length} items flagged.`;
    }

    // 3. Staff Perf
    async function generateStaffPerf(start, end) {
        title.textContent = "Staff Comparative Matrix Assessment";
        
        let query = supabase.from('sales').select('staff_id, total_amount, profiles(full_name)').eq('admin_id', user.id);
        if(start) query = query.gte('sale_date', start + 'T00:00:00');
        if(end) query = query.lte('sale_date', end + 'T23:59:59');

        const { data } = await query;
        const array = data || [];

        const agg = {};
        array.forEach(s => {
            const name = s.profiles?.full_name || 'Admin / Unknown';
            if(!agg[name]) agg[name] = { count: 0, revenue: 0 };
            agg[name].count++;
            agg[name].revenue += Number(s.total_amount);
        });

        currentExportHeaders = ["Staff Name", "Items Sold", "Revenue Generated"];
        currentExportPayload = Object.keys(agg).map(k => [k, agg[k].count, agg[k].revenue]);

        tHead.innerHTML = `<tr><th>Staff Interface</th><th>Transactions</th><th>Gross Generated</th></tr>`;
        tBody.innerHTML = Object.keys(agg).length === 0 ? '<tr><td colspan="3" style="text-align:center;">No data found.</td></tr>' : Object.keys(agg).map(k => `<tr><td style="font-weight:600;">${k}</td><td>${agg[k].count}</td><td style="color:var(--success); font-weight:600;">${Utils.formatCurrency(agg[k].revenue, businessSettings.currency)}</td></tr>`).join('');
        sumBox.innerHTML = '';
    }

    // 4. Stock Movements
    async function generateStockMoves(start, end) {
        title.textContent = "Stock Ledger Analytical Breakdown";
        let query = supabase.from('stock_movements').select('*, products(name), profiles(full_name)').eq('admin_id', user.id).order('created_at', { ascending: false });
        if(start) query = query.gte('created_at', start + 'T00:00:00');
        if(end) query = query.lte('created_at', end + 'T23:59:59');

        const { data } = await query;
        const array = data || [];

        currentExportHeaders = ["Date", "Product", "Type", "Shift", "End Bal", "Actor", "Notes"];
        currentExportPayload = array.map(m => [Utils.formatDate(m.created_at), m.products?.name||'-', m.movement_type, m.quantity, m.new_quantity, m.profiles?.full_name||'-', m.note||'']);

        tHead.innerHTML = `<tr><th>Date</th><th>Product</th><th>Type</th><th>Qty Vector</th><th>End Bal</th><th>User</th></tr>`;
        tBody.innerHTML = array.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No ledgers matched</td></tr>' : array.map(m => `<tr>
            <td>${Utils.formatDate(m.created_at)}</td>
            <td style="font-weight:500;">${m.products?.name||'-'}</td>
            <td><span class="badge" style="background:#e2e8f0; color:#334155">${m.movement_type}</span></td>
            <td style="font-weight:600;">${['stock_out','damage','sale'].includes(m.movement_type) ? '-':'+'}${m.quantity}</td>
            <td>${m.new_quantity}</td>
            <td>${m.profiles?.full_name||'-'}</td>
        </tr>`).join('');
        sumBox.innerHTML = '';
    }

    // Export CSV natively utilizing URI bypasses securely wrapping payloads explicitly
    document.getElementById('btnExport').addEventListener('click', () => {
        if(currentExportPayload.length === 0) { Utils.showToast("No data injected to explicitly export!","error"); return; }
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += currentExportHeaders.join(",") + "\n";
        currentExportPayload.forEach(row => {
            let sRow = row.map(r => `"${String(r).replace(/"/g, '""')}"`).join(",");
            csvContent += sRow + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `CoreInventory_${title.textContent.replace(/\s+/g,'_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

});
