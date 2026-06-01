// Staff Personal Receipt Ledger Logic (js/user-receipts.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    const { data: profile } = await supabase.from('profiles').select('admin_id, full_name').eq('id', user.id).single();
    if(!profile) return;
    const adminId = profile.admin_id;

    let bSet = { business_name: 'CoreInventory', currency: 'FCFA', receipt_footer: 'Thank you!', phone: '', address: '', tax_rate: 0 };
    const { data: dbSet } = await supabase.from('business_settings').select('*').eq('admin_id', adminId).single();
    if(dbSet) bSet = { ...bSet, ...dbSet };

    async function loadReceipts(query = '', dStr = '') {
        const tbody = document.getElementById('receiptsTbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><span class="spinner"></span></td></tr>';

        // ONLY retrieve staff_id = user.id intrinsically
        let qBuild = supabase.from('sales').select('*').eq('staff_id', user.id).order('sale_date', { ascending: false });
        
        if (query) qBuild = qBuild.ilike('receipt_number', `%${query}%`);
        if (dStr) {
            qBuild = qBuild.gte('sale_date', dStr + 'T00:00:00')
                           .lte('sale_date', dStr + 'T23:59:59');
        }

        const { data, error } = await qBuild.limit(50);
        
        if (error || !data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No ledgers matched your parameters internally.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(s => `
            <tr>
                <td style="font-weight:600;">${s.receipt_number}</td>
                <td>${new Date(s.sale_date).toLocaleString()}</td>
                <td>${s.customer_name || '-'}</td>
                <td><span class="badge" style="background:var(--bg-color); color:var(--text-main);">${s.payment_method}</span></td>
                <td style="color:var(--success); font-weight:600;">${Utils.formatCurrency(s.total_amount, bSet.currency)}</td>
                <td>
                    <button class="btn btn-outline" style="padding:0.3rem 0.6rem;" onclick="reprintReceipt('${s.id}')">
                        <i class="fa-solid fa-receipt"></i> View
                    </button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('btnSearch').addEventListener('click', () => {
        loadReceipts(document.getElementById('sQuery').value.trim(), document.getElementById('sDate').value);
    });

    window.reprintReceipt = async (saleId) => {
        const { data: sale } = await supabase.from('sales').select('*').eq('id', saleId).single();
        if(!sale) return;

        const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', saleId);
        if(!items) return;

        const rd = document.getElementById('printableReceipt');
        
        let str = `
            <div class="receipt-header">
                <h3 style="margin:0 0 0.25rem;">${bSet.business_name}</h3>
                <div style="font-size:0.8rem;">${bSet.address}</div>
                <div style="font-size:0.8rem; margin-bottom: 0.5rem;">${bSet.phone ? 'Phone: '+bSet.phone : ''}</div>
                
                <div style="font-size:0.85rem; border-top: 1px solid #ddd; padding-top: 0.5rem; text-align:left;">
                    <strong>Receipt:</strong> ${sale.receipt_number}<br>
                    <strong>Date:</strong> ${new Date(sale.sale_date).toLocaleString()}<br>
                    <strong>Cashier:</strong> ${profile.full_name}<br>
                    ${sale.customer_name ? `<strong>Cust:</strong> ${sale.customer_name}` : ''}
                </div>
            </div>
            
            <div style="margin: 0.5rem 0; text-transform: uppercase; font-size:0.85rem; border-bottom: 1px dotted black; padding-bottom: 0.2rem; display: flex; justify-content: space-between;">
                <span>Item [Qty]</span><span>Amt</span>
            </div>
        `;

        items.forEach(c => {
            str += `
                <div class="receipt-item">
                    <span>${c.product_name.substring(0,18)} x${c.quantity_sold}</span>
                    <span>${c.total_price}</span>
                </div>
            `;
        });

        const taxF = sale.total_amount - sale.subtotal;
        
        str += `<div class="receipt-total" style="border-top:1px dotted black; margin-top:0.5rem; padding-top:0.5rem;">`;
        if(sale.subtotal !== sale.total_amount) {
            str += `<div class="d-flex justify-between" style="font-size:0.85rem; font-weight:normal; margin-bottom:0.2rem;"><span>Subtotal:</span><span>${Utils.formatCurrency(sale.subtotal, bSet.currency)}</span></div>`;
            if (taxF !== 0) str += `<div class="d-flex justify-between" style="font-size:0.85rem; font-weight:normal; margin-bottom:0.2rem;"><span>Adjustments:</span><span>+${Utils.formatCurrency(taxF, bSet.currency)}</span></div>`;
        }
        
        str += `<div class="d-flex justify-between" style="font-size:1.2rem; margin-top: 0.5rem;"><span>TOTAL:</span><span>${Utils.formatCurrency(sale.total_amount, bSet.currency)}</span></div></div>`;
        
        str += `
            <div style="font-size:0.85rem; margin-top: 0.5rem; border-top: 1px dotted black; padding-top: 0.5rem;">
                <div class="d-flex justify-between"><span>Method:</span><span>${sale.payment_method}</span></div>
            </div>
            <div style="text-align:center; font-size:0.8rem; font-style:italic; margin-top:1.5rem; color:#444;">
                ${bSet.receipt_footer}
            </div>
        `;

        rd.innerHTML = str;
        document.getElementById('receiptModal').style.display = 'flex';
    };

    loadReceipts();
});
