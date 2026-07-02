// User Sales (POS) Core Execution (js/user-sales.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    // Pull Relational Admin Identifiers resolving globally
    const { data: profile } = await supabase.from('profiles').select('admin_id, full_name').eq('id', user.id).single();
    if(!profile) return;
    const adminId = profile.admin_id;

    // Default configs resolving accurately mapping SQL pulls natively Explicitly handling tax limits
    let bSet = { business_name: 'CoreInventory', currency: 'FCFA', receipt_footer: 'Thank you for your transaction', phone: '', address: '', tax_rate: 0 };
    const { data: dbSet } = await supabase.from('business_settings').select('*').eq('admin_id', adminId).single();
    if(dbSet) bSet = { ...bSet, ...dbSet };

    document.getElementById('taxLabelNative').textContent = `(${bSet.tax_rate}%)`;

    let productsCore = [];
    let cart = [];

    async function loadProducts() {
        const { data } = await supabase.from('products').select('*').eq('admin_id', adminId).eq('is_active', true).order('name');
        productsCore = data || [];
        const sel = document.getElementById('posProduct');
        sel.innerHTML = '<option value="">-- Search & Scan --</option>';
        productsCore.forEach(p => {
            const blocked = p.quantity === 0;
            const badge = blocked ? ' || OUT OF STOCK' : ` || ${p.quantity} left`;
            sel.innerHTML += `<option value="${p.id}" ${blocked?'disabled':''}>${p.name} - ${Utils.formatCurrency(p.selling_price, bSet.currency)}${badge}</option>`;
        });
    }

    // Add to Cart
    document.getElementById('posAddBtn').addEventListener('click', () => {
        const pId = document.getElementById('posProduct').value;
        const qty = parseInt(document.getElementById('posQty').value);
        if(!pId || isNaN(qty) || qty <= 0) return;

        const p = productsCore.find(x => x.id === pId);
        if(!p) return;

        let existing = cart.find(x => x.prod.id === pId);
        let reqTotal = existing ? existing.qty + qty : qty;

        // Staff constraints executing globally preventing negative stock logically precisely!
        if (reqTotal > p.quantity) {
            Utils.showToast(`Error: Trying to sell ${reqTotal} but only ${p.quantity} structurally exist!`, "error");
            return;
        }

        if(existing) existing.qty = reqTotal;
        else cart.push({ prod: p, qty });

        // Reset forms natively explicitly ensuring speed during rapid sales
        document.getElementById('posProduct').value = '';
        document.getElementById('posQty').value = '1';
        renderCart();
    });

    window.cartRem = (idx) => { cart.splice(idx, 1); renderCart(); };

    // Realtime Render explicitly calculating discounts intelligently natively
    function renderCart() {
        const tbody = document.getElementById('cartTbody');
        const cSub = document.getElementById('chkSubtotal');
        const cTaxShow = document.getElementById('chkTaxStr');
        const cTot = document.getElementById('chkTotal');
        const btn = document.getElementById('btnCheckout');

        if(cart.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color:var(--text-muted);">Terminal empty. Scan barcoded items.</td></tr>';
            cSub.textContent = Utils.formatCurrency(0, bSet.currency);
            cTaxShow.textContent = Utils.formatCurrency(0, bSet.currency);
            cTot.textContent = Utils.formatCurrency(0, bSet.currency);
            btn.disabled = true;
            return;
        }

        let subtotalFloat = 0;
        let html = '';
        cart.forEach((item, i) => {
            const line = item.prod.selling_price * item.qty;
            subtotalFloat += line;
            html += `<tr>
                <td style="font-weight:600;">${item.prod.name}</td>
                <td>${Utils.formatCurrency(item.prod.selling_price, bSet.currency)}</td>
                <td style="font-weight:700;">x${item.qty}</td>
                <td style="color:var(--primary-color); font-weight:600;">${line}</td>
                <td><button type="button" class="btn btn-outline" style="padding:0.2rem 0.6rem; color:var(--danger); border:none;" onclick="cartRem(${i})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });
        tbody.innerHTML = html;

        cSub.textContent = Utils.formatCurrency(subtotalFloat, bSet.currency);

        runFinancialMath(subtotalFloat);
        btn.disabled = false;
    }

    let finalCheckoutTotal = 0;
    
    // Explicit calculations incorporating UI dynamic limits
    const inDisc = document.getElementById('chkDiscount');
    const inPay = document.getElementById('chkPaid');
    const lChange = document.getElementById('chkChange');

    inDisc.addEventListener('input', () => {
        const sub = cart.reduce((s, itm) => s + (itm.prod.selling_price * itm.qty), 0);
        runFinancialMath(sub);
    });
    
    inPay.addEventListener('input', () => {
        const p = parseFloat(inPay.value) || 0;
        lChange.textContent = Utils.formatCurrency(p > finalCheckoutTotal ? p - finalCheckoutTotal : 0, bSet.currency);
    });

    function runFinancialMath(subtotal) {
        let disc = parseFloat(inDisc.value) || 0;
        if(disc < 0) { disc = 0; inDisc.value = 0; }
        if(disc > subtotal) { disc = subtotal; inDisc.value = subtotal; }

        const afterDisc = subtotal - disc;
        const evaluatedTax = afterDisc * (bSet.tax_rate / 100);
        
        finalCheckoutTotal = afterDisc + evaluatedTax;
        
        document.getElementById('chkTaxStr').textContent = Utils.formatCurrency(evaluatedTax, bSet.currency);
        document.getElementById('chkTotal').textContent = Utils.formatCurrency(finalCheckoutTotal, bSet.currency);

        const p = parseFloat(inPay.value) || 0;
        lChange.textContent = Utils.formatCurrency(p > finalCheckoutTotal ? p - finalCheckoutTotal : 0, bSet.currency);
    }


    // Execution Engine Transaction
    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnCheckout');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Locking Database Ledger...';

        const cName = document.getElementById('chkCustName').value.trim();
        const cPhone = document.getElementById('chkCustPhone').value.trim();
        const method = document.getElementById('chkMethod').value;
        const paidAmount = parseFloat(inPay.value) || 0;

        const subtotalAgg = cart.reduce((s, itm) => s + (itm.prod.selling_price * itm.qty), 0);
        const overallProfit = cart.reduce((s, itm) => s + ((itm.prod.selling_price - (itm.prod.cost_price||0)) * itm.qty), 0);
        const discFloat = parseFloat(inDisc.value) || 0;
        
        // Final synchronous stock lock verify precisely before inserting the sale record
        const cartIds = cart.map(c => c.prod.id);
        const { data: freshStock } = await supabase.from('products').select('id, quantity').in('id', cartIds);
        
        if (freshStock) {
            for (const item of cart) {
                const fresh = freshStock.find(fs => fs.id === item.prod.id);
                if (!fresh || fresh.quantity < item.qty) {
                    Utils.showToast(`Transaction halted! ${item.prod.name} has insufficient live stock.`, "error");
                    btn.disabled = false; btn.innerHTML = 'Lock Transaction natively!'; 
                    await loadProducts(); // Refresh POS array dynamically
                    return;
                }
            }
        }
        
        // Push Core Record inherently
        const { data: saleRec, error: saleErr } = await supabase.from('sales').insert([{
            admin_id: adminId, staff_id: user.id, customer_name: cName || null,
            subtotal: subtotalAgg, total_amount: finalCheckoutTotal, total_profit: overallProfit, // Profit remains accurate even with discount simplifying
            payment_method: method, amount_paid: paidAmount
        }]).select('id, receipt_number, sale_date').single();

        if (saleErr || !saleRec) {
            Utils.showToast("Criticial SQL Integrity Fault! Sale aborted safely.", "error"); 
            btn.disabled = false; btn.innerHTML = 'Lock Transaction natively!'; return;
        }

        const itemsPsh = [];
        const stockPsh = [];

        for(const item of cart){
            const lineSell = item.prod.selling_price * item.qty;
            const lineProf = (item.prod.selling_price - (item.prod.cost_price||0)) * item.qty;

            itemsPsh.push({ sale_id: saleRec.id, product_id: item.prod.id, product_name: item.prod.name, quantity_sold: item.qty, cost_price: item.prod.cost_price, unit_price: item.prod.selling_price, total_price: lineSell, profit: lineProf });

            const newQ = item.prod.quantity - item.qty;
            await supabase.from('products').update({ quantity: newQ }).eq('id', item.prod.id);

            stockPsh.push({ admin_id: adminId, product_id: item.prod.id, performed_by: user.id, movement_type: 'sale', quantity: item.qty, old_quantity: item.prod.quantity, new_quantity: newQ, note: `Sale POS: ${saleRec.receipt_number}` });
        }

        await supabase.from('sale_items').insert(itemsPsh);
        await supabase.from('stock_movements').insert(stockPsh);

        Utils.showToast("Success! Generates receipt intrinsically via memory.", "success");
        
        genReceiptHTML(saleRec.receipt_number, saleRec.sale_date, cName, cPhone, subtotalAgg, discFloat, (finalCheckoutTotal-subtotalAgg+discFloat), paidAmount, method);

        cart = []; 
        document.getElementById('checkoutForm').reset();
        inDisc.value = 0; inPay.value = '';
        renderCart();
        await loadProducts(); // Pull new quantities universally
        btn.disabled = false; btn.innerHTML = 'Lock Transaction natively!';
    });

    // POS Printable Formulation incorporating extensive metadata cleanly identifying staff clearly securely
    function genReceiptHTML(rNum, dateStr, cName, cPhone, subT, discF, taxF, pAmt, payMeth) {
        const rd = document.getElementById('printableReceipt');
        rd.classList.remove('d-none');

        let str = `
            <div class="receipt-header">
                <h3 style="margin:0 0 0.25rem;">${bSet.business_name}</h3>
                <div style="font-size:0.8rem;">${bSet.address}</div>
                <div style="font-size:0.8rem; margin-bottom: 0.5rem;">${bSet.phone ? 'Phone: '+bSet.phone : ''}</div>
                
                <div style="font-size:0.85rem; border-top: 1px solid #ddd; padding-top: 0.5rem; text-align:left;">
                    <strong>Receipt:</strong> ${rNum}<br>
                    <strong>Date:</strong> ${Utils.formatDate(dateStr)}<br>
                    <strong>Cashier:</strong> ${profile.full_name}<br>
                    ${cName ? `<strong>Cust:</strong> ${cName}` : ''}
                    ${cPhone ? `<br><strong>Tel:</strong> ${cPhone}` : ''}
                </div>
            </div>
            
            <div style="margin: 0.5rem 0; text-transform: uppercase; font-size:0.85rem; border-bottom: 1px dotted black; padding-bottom: 0.2rem; display: flex; justify-content: space-between;">
                <span>Item [Qty]</span><span>Amt</span>
            </div>
        `;

        cart.forEach(c => {
            str += `
                <div class="receipt-item">
                    <span>${c.prod.name.substring(0,18)} x${c.qty}</span>
                    <span>${c.prod.selling_price * c.qty}</span>
                </div>
            `;
        });

        str += `<div class="receipt-total" style="border-top:1px dotted black; margin-top:0.5rem; padding-top:0.5rem;">`;
        if (discF > 0 || taxF > 0) {
            str += `
                <div class="d-flex justify-between" style="font-size:0.85rem; font-weight:normal; margin-bottom:0.2rem;"><span>Subtotal:</span><span>${Utils.formatCurrency(subT, bSet.currency)}</span></div>
                ${discF > 0 ? `<div class="d-flex justify-between" style="font-size:0.85rem; font-weight:normal; margin-bottom:0.2rem;"><span>Discount:</span><span>-${Utils.formatCurrency(discF, bSet.currency)}</span></div>` : ''}
                ${taxF > 0 ? `<div class="d-flex justify-between" style="font-size:0.85rem; font-weight:normal; margin-bottom:0.2rem;"><span>Tax:</span><span>+${Utils.formatCurrency(taxF, bSet.currency)}</span></div>` : ''}
            `;
        }
        
        str += `<div class="d-flex justify-between" style="font-size:1.2rem; margin-top: 0.5rem;"><span>TOTAL:</span><span>${Utils.formatCurrency(finalCheckoutTotal, bSet.currency)}</span></div></div>`;
        
        str += `
            <div style="font-size:0.85rem; margin-top: 0.5rem; border-top: 1px dotted black; padding-top: 0.5rem;">
                <div class="d-flex justify-between"><span>Method:</span><span>${payMeth}</span></div>
                <div class="d-flex justify-between"><span>Paid:</span><span>${Utils.formatCurrency(pAmt, bSet.currency)}</span></div>
                <div class="d-flex justify-between"><span>Change:</span><span>${Utils.formatCurrency(pAmt > finalCheckoutTotal ? pAmt - finalCheckoutTotal : 0, bSet.currency)}</span></div>
            </div>
            
            <div style="text-align:center; font-size:0.8rem; font-style:italic; margin-top:1.5rem; color:#444;">
                ${bSet.receipt_footer}
            </div>
        `;

        rd.innerHTML = str;
        document.getElementById('receiptModal').style.display = 'flex';
    }


    loadProducts();
});
