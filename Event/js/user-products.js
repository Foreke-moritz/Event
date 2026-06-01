// Staff View Only Products Engine (js/user-products.js)

let productsCore = [];
let categoriesCore = [];
let businessCurrency = 'FCFA';

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    const { data: profile } = await supabase.from('profiles').select('admin_id').eq('id', user.id).single();
    if (!profile) return;
    const adminId = profile.admin_id;

    const { data: bset } = await supabase.from('business_settings').select('currency').eq('admin_id', adminId).single();
    if(bset && bset.currency) businessCurrency = bset.currency;

    // Load Filters
    async function loadCategories() {
        const { data } = await supabase.from('categories').select('id, name').eq('admin_id', adminId);
        categoriesCore = data || [];
        const catFilter = document.getElementById('catFilter');
        catFilter.innerHTML = '<option value="all">All Categories</option>';
        categoriesCore.forEach(c => {
            catFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    async function fetchData() {
        // Explicitly ensuring is_active = true and hiding cost prices manually from the client view 
        const { data, error } = await supabase.from('products').select(`id, name, sku, barcode, selling_price, quantity, low_stock_limit, image_url, category_id, is_active, categories(name)`).eq('admin_id', adminId).eq('is_active', true).order('name');
        
        productsCore = data || [];
        renderTable();
    }

    function renderTable() {
        const tbody = document.getElementById('productTbody');
        const sQuery = document.getElementById('searchInput').value.toLowerCase();
        const catFil = document.getElementById('catFilter').value;

        const filtered = productsCore.filter(p => {
            let pass = true;
            if(sQuery && !(p.name.toLowerCase().includes(sQuery) || (p.sku && p.sku.toLowerCase().includes(sQuery)) || (p.barcode && p.barcode.toLowerCase().includes(sQuery)))) pass = false;
            if(catFil !== 'all' && p.category_id !== catFil) pass = false;
            return pass;
        });

        if(filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No matching products found globally.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            let sBadge = `<span class="badge badge-success">In Stock</span>`;
            if (p.quantity === 0) sBadge = `<span class="badge badge-danger">Out of Stock!</span>`;
            else if (p.quantity <= (p.low_stock_limit || 5)) sBadge = `<span class="badge badge-warning">Low Stock</span>`;
            
            const imgUrl = p.image_url ? `<img src="${p.image_url}" class="prod-img">` : `<div class="prod-img"><i class="fa-solid fa-image"></i></div>`;

            return `
                <tr>
                    <td>${imgUrl}</td>
                    <td>
                        <strong style="display:block;">${p.name}</strong>
                        <span style="font-size: 0.75rem; color:var(--text-muted)">SKU: ${p.sku || '-'} | Barcode: ${p.barcode || '-'}</span>
                    </td>
                    <td>${p.categories?.name || '-'}</td>
                    <td style="font-weight: 600; color:var(--success); font-size: 1.05rem;">${Utils.formatCurrency(p.selling_price, businessCurrency)}</td>
                    <td style="font-weight: 700; font-size: 1.1rem; color: ${p.quantity === 0 ? 'var(--danger)' : 'var(--text-main)'}">${p.quantity}</td>
                    <td>${sBadge}</td>
                </tr>
            `;
        }).join('');
    }

    document.getElementById('searchInput').addEventListener('input', renderTable);
    document.getElementById('catFilter').addEventListener('change', renderTable);

    loadCategories();
    fetchData();
});
