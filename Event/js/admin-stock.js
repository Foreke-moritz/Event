// Admin Stock Execution (js/admin-stock.js)

document.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    let productsCore = [];

    async function loadProducts() {
        const { data } = await supabase.from('products').select('id, name, quantity').eq('admin_id', user.id).order('name');
        productsCore = data || [];
        
        const sel = document.getElementById('sProduct');
        sel.innerHTML = '<option value="">-- Choose Product --</option>';
        productsCore.forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    }

    document.getElementById('sProduct').addEventListener('change', (e) => {
        const pId = e.target.value;
        const info = document.getElementById('qtyInfoBox');
        if(!pId) { info.style.display = 'none'; return; }
        
        const p = productsCore.find(x => x.id === pId);
        document.getElementById('currentQtyDisplay').textContent = p ? p.quantity : '0';
        info.style.display = 'flex';
    });

    async function loadLedger() {
        const ledger = document.getElementById('stockLedger');
        const { data: movs, error } = await supabase
            .from('stock_movements')
            .select(`*, products(name), profiles(full_name)`)
            .eq('admin_id', user.id)
            .order('created_at', { ascending: false })
            .limit(15);
            
        if (error || !movs || movs.length === 0) {
            ledger.innerHTML = '<div style="color:var(--text-muted);">No stock movements recorded yet.</div>';
            return;
        }

        ledger.innerHTML = movs.map(m => {
            let clz = 'adj'; let verb = 'Adjusted'; let sign = '';
            if (m.movement_type === 'stock_in' || m.movement_type === 'return') { clz = 'in'; verb = m.movement_type === 'return' ? 'Returned' : 'Stocked In'; sign = '+'; }
            if (m.movement_type === 'stock_out' || m.movement_type === 'damage' || m.movement_type === 'sale') { clz = 'out'; verb = m.movement_type === 'damage' ? 'Damaged' : (m.movement_type === 'sale' ? 'Sold' : 'Stocked Out'); sign = '-'; }
            
            return `
                <div class="timeline-item ${clz}">
                    <div class="d-flex justify-between">
                        <strong style="color:var(--text-main);">${m.products?.name || 'Unknown Product'}</strong>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${Utils.formatDate(m.created_at)}</span>
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.2rem;">
                        ${verb} <span style="font-weight:700; color:var(--text-main);">${sign}${m.quantity}</span> units by ${m.profiles?.full_name || 'User'}
                    </div>
                    ${m.note ? `<div style="font-size:0.8rem; margin-top:0.3rem; font-style:italic; border-left:2px solid var(--border-color); padding-left:0.5rem;">"${m.note}"</div>` : ''}
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">Balance: ${m.old_quantity} → ${m.new_quantity}</div>
                </div>
            `;
        }).join('');
    }

    document.getElementById('stockForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pId = document.getElementById('sProduct').value;
        const mType = document.getElementById('sType').value;
        const shiftQty = parseInt(document.getElementById('sQty').value);
        const note = document.getElementById('sNote').value.trim();

        if(!pId || isNaN(shiftQty) || shiftQty <= 0) {
            Utils.showToast("Invalid product or quantity.", "error"); return;
        }

        const p = productsCore.find(x => x.id === pId);
        if(!p) return;

        const btn = document.getElementById('btnStockSave');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing...';

        let newQty = p.quantity;
        // Determine Shift Vector natively
        if (mType === 'stock_in' || mType === 'return' || mType === 'adjustment') newQty += shiftQty;
        else if (mType === 'stock_out' || mType === 'damage') newQty -= shiftQty;

        if (newQty < 0) {
            Utils.showToast("Cannot reduce quantity below Zero! Operation halted natively.", "error");
            btn.disabled = false; btn.innerHTML = 'Execute Transfer Log'; return;
        }

        // 1. Update Products Table explicitly
        const { error: pErr } = await supabase.from('products').update({ quantity: newQty }).eq('id', pId);
        if (pErr) { Utils.showToast(pErr.message, "error"); btn.disabled = false; btn.innerHTML = 'Execute Transfer Log'; return; }

        // 2. Insert Stock Movement
        const { error: mErr } = await supabase.from('stock_movements').insert([{
            admin_id: user.id, product_id: pId, performed_by: user.id,
            movement_type: mType, quantity: shiftQty, old_quantity: p.quantity, new_quantity: newQty, note: note
        }]);

        if (mErr) Utils.showToast("Error logging movement: " + mErr.message, "error");
        else {
            Utils.showToast("Stock ledger recorded universally!", "success");
            document.getElementById('stockForm').reset();
            document.getElementById('qtyInfoBox').style.display = 'none';
            // Reload
            await loadProducts();
            await loadLedger();
        }

        btn.disabled = false; btn.innerHTML = 'Execute Transfer Log';
    });

    loadProducts();
    loadLedger();
});
