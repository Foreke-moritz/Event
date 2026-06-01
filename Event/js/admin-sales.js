// Admin Sales Core Logic (js/admin-sales.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    let productsCore = [];
    let cart = [];
    let businessSettings = { business_name: 'CoreInventory', currency: 'FCFA', receipt_footer: 'Thank you for your purchase', phone: '' };

    // Fetch Configurations
    const { data: bset } = await supabase.from('business_settings').select('*').eq('admin_id', user.id).single();
    if(bset) businessSettings = { ...businessSettings, ...bset };

    async function loadProducts() {
        // Fetch only active explicitly
        const { data } = await supabase.from('products').select('*').eq('admin_id', user.id).eq('is_active', true).order('name');
        productsCore = data || [];
        const sel = document.getElementById('posProduct');
        sel.innerHTML = '<option value="">-- Choose Product --</option>';
        productsCore.forEach(p => {
            const badge = p.quantity === 0 ? ' [OUT]' : ` [${p.quantity} left]`;
            sel.innerHTML += `<option value="${p.id}" ${p.quantity===0?'disabled':''}>${p.name} - ${Utils.formatCurrency(p.selling_price, businessSettings.currency)}${badge}</option>`;
        });
    }

    // Cart Mechanisms
    document.getElementById('posAddBtn').addEventListener('click', () => {
        const pId = document.getElementById('posProduct').value;
        let qty = parseInt(document.getElementById('posQty').value);
        if(!pId || isNaN(qty) || qty <= 0) return;

        const prod = productsCore.find(x => x.id === pId);
        if(!prod) return;

        const existing = cart.find(x => x.product.id === pId);
        let totalReq = existing ? existing.qty + qty : qty;

        if (totalReq > prod.quantity) {
            Utils.showToast(`Cannot add! Only ${prod.quantity} ${prod.name} available natively in stock.`, "error");
            return;
        }

        if (existing) { existing.qty = totalReq; }
        else { cart.push({ product: prod, qty: qty }); }

        document.getElementById('posProduct').value = '';
        document.getElementById('posQty').value = '1';
        renderCart();
    });

    window.remCart = (idx) => { cart.splice(idx, 1); renderCart(); };

    function renderCart() {
        const tbody = document.getElementById('cartTbody');
        const chkSub = document.getElementById('chkSubtotal');
        const chkTot = document.getElementById('chkTotal');
        const btn = document.getElementById('btnCheckout');

        if(cart.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color:var(--text-muted);">No items in cart.</td></tr>';
            chkSub.textContent = Utils.formatCurrency(0, businessSettings.currency);
            chkTot.textContent = Utils.formatCurrency(0, businessSettings.currency);
            btn.disabled = true;
            return;
        }

        let total = 0;
        tbody.innerHTML = cart.map((item, i) => {
            const lineTot = item.product.selling_price * item.qty;
            total += lineTot;
            return `
                <tr>
                    <td style="font-weight:500; font-size:0.875rem;">${item.product.name}</td>
                    <td>${item.qty}</td>
                    <td>${item.product.selling_price}</td>
                    <td style="color:var(--primary-color);">${lineTot}</td>
                    <td><button class="btn btn-outline" style="padding:0.2rem 0.5rem; color:var(--danger); border:none;" onclick="remCart(${i})"><i class="fa-solid fa-xmark"></i></button></td>
                </tr>
            `;
        }).join('');

        chkSub.textContent = Utils.formatCurrency(total, businessSettings.currency);
        chkTot.textContent = Utils.formatCurrency(total, businessSettings.currency);
        btn.disabled = false;
        
        // Change computing hook natively
        computeChange(total);
    }

    const payInp = document.getElementById('chkPaid');
    const changeDisp = document.getElementById('chkChange');
    payInp.addEventListener('input', () => computeChange());

    function computeChange(baseTot = null) {
        let t = baseTot;
        if(t === null) {
            t = cart.reduce((sum, item) => sum + (item.product.selling_price * item.qty), 0);
        }
        const p = parseFloat(payInp.value) || 0;
        if(p > t) changeDisp.textContent = Utils.formatCurrency(p - t, businessSettings.currency);
        else changeDisp.textContent = Utils.formatCurrency(0, businessSettings.currency);
    }

    // Checkout Exection Native Sequence Mapping
    // 1 Sale -> N SaleItems -> N StockMovements natively tracking
    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnCheckout');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Validating Ledger...';

        const cName = document.getElementById('chkCust').value.trim();
        const method = document.getElementById('chkMethod').value;
        const paid = parseFloat(document.getElementById('chkPaid').value) || 0;
        
        const overallTotal = cart.reduce((s, itm) => s + (itm.product.selling_price * itm.qty), 0);
        // Explicitly extract total profit aggregating the array map instantly
        const overallProfit = cart.reduce((s, itm) => s + ((itm.product.selling_price - (itm.product.cost_price || 0)) * itm.qty), 0);

        // 1. Generate core sale explicitly triggering recursive RLS inserts safely
        const { data: saleRet, error: saleErr } = await supabase.from('sales').insert([{
            admin_id: user.id,
            staff_id: user.id, // Admin is performing it
            customer_name: cName || null,
            subtotal: overallTotal,
            total_amount: overallTotal,
            total_profit: overallProfit,
            payment_method: method,
            amount_paid: paid
        }]).select('id, receipt_number, sale_date').single();

        if(saleErr || !saleRet) {
            Utils.showToast("Criticial Sale Failure explicitly blocking database execution.", "error");
            btn.disabled = false; btn.innerHTML = 'Complete Sale'; return;
        }

        // 2. Generate Sale Items && Update Products Array mapping implicitly
        const sItemsArray = [];
        const stockMoveArray = [];

        for (const item of cart) {
            sItemsArray.push({
                sale_id: saleRet.id,
                product_id: item.product.id,
                product_name: item.product.name,
                quantity_sold: item.qty,
                cost_price: item.product.cost_price,
                unit_price: item.product.selling_price,
                total_price: item.product.selling_price * item.qty,
                profit: (item.product.selling_price - (item.product.cost_price||0)) * item.qty
            });

            const newQty = item.product.quantity - item.qty;
            await supabase.from('products').update({ quantity: newQty }).eq('id', item.product.id);

            stockMoveArray.push({
                admin_id: user.id, product_id: item.product.id, performed_by: user.id,
                movement_type: 'sale', quantity: item.qty, old_quantity: item.product.quantity, new_quantity: newQty, note: `Sale ${saleRet.receipt_number}`
            });
        }

        await supabase.from('sale_items').insert(sItemsArray);
        await supabase.from('stock_movements').insert(stockMoveArray);

        Utils.showToast(`Transaction ${saleRet.receipt_number} mapped seamlessly natively!`, "success");
        
        // Expose Native Receipt Generation
        generateReceipt(saleRet.receipt_number, saleRet.sale_date, cName, overallTotal, paid);

        // Reset
        cart = []; renderCart(); 
        document.getElementById('checkoutForm').reset();
        await loadProducts(); // Refresh limits
        await loadHistory();
        
        btn.disabled = false; btn.innerHTML = 'Complete Sale';
    });


    // Printing Architectures
    function generateReceipt(rNum, dateStr, custName, total, paid) {
        const rcpt = document.getElementById('printableReceipt');
        rcpt.classList.remove('d-none');
        
        // Format native HTML explicitly preventing external framework loads cleanly
        let htmlStr = `
            <div class="receipt-header">
                <h2>${businessSettings.business_name}</h2>
                <div>${businessSettings.phone ? `Tel: ${businessSettings.phone}` : ''}</div>
                <div style="font-size: 0.8rem; margin-top:0.5rem; text-align:left;">
                    Recept #: ${rNum}<br>
                    Date: ${Utils.formatDate(dateStr)}<br>
                    ${custName ? `Customer: ${custName}` : ''}
                </div>
            </div>
            <div style="margin-bottom: 0.5rem; font-weight: bold; display: flex; justify-content: space-between;">
                <span>Item x Qty</span><span>Total</span>
            </div>
        `;

        cart.forEach(item => {
            htmlStr += `
                <div class="receipt-item">
                    <span>${item.product.name} x${item.qty}</span>
                    <span>${Utils.formatCurrency(item.product.selling_price * item.qty, businessSettings.currency)}</span>
                </div>
            `;
        });

        htmlStr += `
            <div class="receipt-total d-flex justify-between">
                <span>TOTAL</span><span>${Utils.formatCurrency(total, businessSettings.currency)}</span>
            </div>
            ${paid > 0 ? `
            <div class="d-flex justify-between" style="font-size: 0.85rem; margin-top: 0.5rem;">
                <span>Amount Paid:</span><span>${Utils.formatCurrency(paid, businessSettings.currency)}</span>
            </div>
            <div class="d-flex justify-between" style="font-size: 0.85rem;">
                <span>Change:</span><span>${Utils.formatCurrency(paid > total ? paid - total : 0, businessSettings.currency)}</span>
            </div>
            ` : ''}
            <div style="text-align:center; margin-top: 1.5rem; font-size:0.8rem; font-style:italic;">
                ${businessSettings.receipt_footer}
            </div>
        `;

        rcpt.innerHTML = htmlStr;
        document.getElementById('receiptModal').style.display = 'flex';
    }

    document.getElementById('closeReceipt').addEventListener('click', () => {
        document.getElementById('receiptModal').style.display = 'none';
    });

    // History Tab Logics
    async function loadHistory() {
        const tbody = document.getElementById('historyTbody');
        const { data: sales, error } = await supabase
            .from('sales')
            .select(`*, sale_items(count)`)
            .eq('admin_id', user.id)
            .order('sale_date', { ascending: false });

        if(error || !sales || sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No past transactions explicit.</td></tr>';
            return;
        }

        tbody.innerHTML = sales.map(s => `
            <tr>
                <td style="font-weight:600;">${s.receipt_number}</td>
                <td>${Utils.formatDate(s.sale_date)}</td>
                <td>${s.customer_name || '-'}</td>
                <td><span class="badge" style="background:var(--bg-color); color:var(--text-main);">${s.payment_method}</span></td>
                <td style="color:var(--success); font-weight:600;">${Utils.formatCurrency(s.total_amount, businessSettings.currency)}</td>
                <td>${s.sale_items[0].count} Items <button class="btn btn-outline" style="padding: 0.2rem 0.4rem; font-size:0.7rem; margin-left: 0.5rem;" title="Native Reprint Functionality unavailable in basic view."><i class="fa-solid fa-eye"></i></button></td>
            </tr>
        `).join('');
    }

    loadProducts();
    loadHistory();
});
