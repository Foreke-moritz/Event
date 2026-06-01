// Admin Products Engine (js/admin-products.js)

let productsCore = [];
let categoriesCore = [];
let businessCurrency = 'FCFA';

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    // Load Currency
    const { data: bset } = await supabase.from('business_settings').select('currency').eq('admin_id', user.id).single();
    if(bset && bset.currency) {
        businessCurrency = bset.currency;
        document.querySelectorAll('.currency-label').forEach(el => el.textContent = businessCurrency);
    }

    // Modal Control
    const modal = document.getElementById('modalProduct');
    document.querySelector('a[href="#modalProduct"]').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('productForm').reset();
        document.getElementById('pId').value = '';
        document.getElementById('modalTitle').textContent = 'Add New Product';
        
        // Only Admins can set initial quantity natively on creation. Superseded by stock_movements afterward.
        document.getElementById('pQty').disabled = false; 
        
        modal.style.display = 'flex';
    });
    document.getElementById('closeModal').addEventListener('click', () => modal.style.display = 'none');

    // Dependencies
    async function loadCategories() {
        const { data } = await supabase.from('categories').select('id, name');
        categoriesCore = data || [];
        
        const catFilter = document.getElementById('catFilter');
        const pCategory = document.getElementById('pCategory');
        
        catFilter.innerHTML = '<option value="all">All Categories</option>';
        pCategory.innerHTML = '<option value="">No Category</option>';

        categoriesCore.forEach(c => {
            catFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            pCategory.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    async function fetchData() {
        const tbody = document.getElementById('productTbody');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><span class="spinner"></span> Loading products...</td></tr>';
        
        const { data, error } = await supabase.from('products').select(`*, categories(name)`).order('created_at', { ascending: false });
        if(error) {
            Utils.showToast("Failed loading products.", "error");
            return;
        }
        productsCore = data || [];
        renderTable();
    }

    function renderTable() {
        const tbody = document.getElementById('productTbody');
        const sQuery = document.getElementById('searchInput').value.toLowerCase();
        const catFil = document.getElementById('catFilter').value;
        const stockFil = document.getElementById('stockFilter').value;
        const now = new Date();

        const filtered = productsCore.filter(p => {
            let pass = true;
            if(sQuery && !(p.name.toLowerCase().includes(sQuery) || (p.sku && p.sku.toLowerCase().includes(sQuery)) || (p.barcode && p.barcode.toLowerCase().includes(sQuery)))) pass = false;
            
            if(catFil !== 'all' && p.category_id !== catFil) pass = false;

            if(stockFil !== 'all') {
                if(stockFil === 'in' && p.quantity <= (p.low_stock_limit||5)) pass = false;
                if(stockFil === 'low' && (p.quantity === 0 || p.quantity > (p.low_stock_limit||5))) pass = false;
                if(stockFil === 'out' && p.quantity > 0) pass = false;
                if(stockFil === 'expired') {
                    if(!p.expiry_date) pass = false;
                    else {
                        const exp = new Date(p.expiry_date);
                        const daysLeft = (exp - now) / (1000 * 3600 * 24);
                        if (daysLeft > 30) pass = false; // Near expiry is within 30 days
                    }
                }
            }
            return pass;
        });

        if(filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No matching products found.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            let sBadge = `<span class="badge badge-success">In Stock</span>`;
            if (p.quantity === 0) sBadge = `<span class="badge badge-danger">Out of Stock</span>`;
            else if (p.quantity <= (p.low_stock_limit || 5)) sBadge = `<span class="badge badge-warning">Low Stock</span>`;
            
            if (!p.is_active) sBadge += ` <span class="badge" style="background:#e2e8f0;">Inactive</span>`;

            // Near Expiry explicit track
            if (p.expiry_date) {
                const exp = new Date(p.expiry_date);
                const daysLeft = (exp - now) / (1000 * 3600 * 24);
                if (daysLeft < 0) sBadge += ` <span class="badge badge-danger">Expired</span>`;
                else if (daysLeft < 30) sBadge += ` <span class="badge badge-warning">Expiring Soon</span>`;
            }

            const imgUrl = p.image_url ? `<img src="${p.image_url}" class="prod-img">` : `<div class="prod-img"><i class="fa-solid fa-image"></i></div>`;

            return `
                <tr>
                    <td>${imgUrl}</td>
                    <td>
                        <strong style="display:block;">${p.name}</strong>
                        <span style="font-size: 0.75rem; color:var(--text-muted)">SKU: ${p.sku || '-'} | Barcode: ${p.barcode || '-'}</span>
                    </td>
                    <td>${p.categories?.name || '-'}</td>
                    <td>
                        <div style="font-size: 0.8rem; color: var(--text-muted)">Cost: ${Utils.formatCurrency(p.cost_price, businessCurrency)}</div>
                        <div style="font-weight: 500;">Sell: ${Utils.formatCurrency(p.selling_price, businessCurrency)}</div>
                    </td>
                    <td style="font-weight: 600; font-size: 1.1rem;">${p.quantity}</td>
                    <td>${sBadge}</td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline" style="padding: 0.4rem; color: var(--info)" onclick="editProduct('${p.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-outline" style="padding: 0.4rem; color: var(--danger)" onclick="promptDelete('${p.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Input Listeners
    document.getElementById('searchInput').addEventListener('input', renderTable);
    document.getElementById('catFilter').addEventListener('change', renderTable);
    document.getElementById('stockFilter').addEventListener('change', renderTable);

    // Form Submission (Add / Edit)
    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pId = document.getElementById('pId').value;
        const btn = document.getElementById('saveProductBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Saving...';

        const payload = {
            admin_id: user.id,
            name: document.getElementById('pName').value.trim(),
            category_id: document.getElementById('pCategory').value || null,
            sku: document.getElementById('pSku').value.trim() || null,
            barcode: document.getElementById('pBarcode').value.trim() || null,
            cost_price: document.getElementById('pCost').value || 0,
            selling_price: document.getElementById('pSelling').value,
            quantity: document.getElementById('pQty').value,
            low_stock_limit: document.getElementById('pLimit').value || 5,
            supplier_name: document.getElementById('pSupplier').value.trim() || null,
            supplier_contact: document.getElementById('pContact').value.trim() || null,
            expiry_date: document.getElementById('pExpiry').value || null,
            image_url: document.getElementById('pImage').value.trim() || null,
            description: document.getElementById('pDesc').value.trim() || null,
            is_active: document.getElementById('pActive').checked
        };

        if (pId) {
            // Remove quantity from payload during edit to prevent manual override bypassing stock_movements!
            delete payload.quantity; 
            const { error } = await supabase.from('products').update(payload).eq('id', pId);
            if (error) Utils.showToast("Error updating product: " + error.message, "error");
            else { Utils.showToast("Product updated!", "success"); modal.style.display = 'none'; fetchData(); }
        } else {
            // It's entirely new
            const { data: newProd, error } = await supabase.from('products').insert([payload]).select().single();
            if (error) Utils.showToast("Error creating product: " + error.message, "error");
            else { 
                // Track initial stock inherently
                await supabase.from('stock_movements').insert([{
                    admin_id: user.id, product_id: newProd.id, performed_by: user.id, 
                    movement_type: 'stock_in', quantity: newProd.quantity, new_quantity: newProd.quantity, note: 'Initial inventory load'
                }]);
                Utils.showToast("Product created successfully!", "success"); modal.style.display = 'none'; fetchData(); 
            }
        }

        btn.disabled = false;
        btn.innerHTML = 'Save Product';
    });

    // Edit Binding Global Native
    window.editProduct = (id) => {
        const prod = productsCore.find(p => p.id === id);
        if(!prod) return;

        document.getElementById('pId').value = prod.id;
        document.getElementById('modalTitle').textContent = 'Edit Product';
        
        document.getElementById('pName').value = prod.name;
        document.getElementById('pCategory').value = prod.category_id || '';
        document.getElementById('pSku').value = prod.sku || '';
        document.getElementById('pBarcode').value = prod.barcode || '';
        document.getElementById('pCost').value = prod.cost_price;
        document.getElementById('pSelling').value = prod.selling_price;
        
        const qI = document.getElementById('pQty');
        qI.value = prod.quantity;
        qI.disabled = true; // Protect actual inventory! Use stock adjustments natively.

        document.getElementById('pLimit').value = prod.low_stock_limit;
        document.getElementById('pSupplier').value = prod.supplier_name || '';
        document.getElementById('pContact').value = prod.supplier_contact || '';
        document.getElementById('pExpiry').value = prod.expiry_date || '';
        document.getElementById('pImage').value = prod.image_url || '';
        document.getElementById('pDesc').value = prod.description || '';
        document.getElementById('pActive').checked = prod.is_active;

        modal.style.display = 'flex';
    };

    // Delete Mechanisms
    const delModal = document.getElementById('modalDelete');
    window.promptDelete = (id) => {
        document.getElementById('delProdId').value = id;
        delModal.style.display = 'flex';
    };
    document.getElementById('cancelDel').addEventListener('click', () => delModal.style.display = 'none');
    document.getElementById('confirmDel').addEventListener('click', async () => {
        const id = document.getElementById('delProdId').value;
        const btn = document.getElementById('confirmDel');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
        
        const { error } = await supabase.from('products').delete().eq('id', id);
        if(error) Utils.showToast(error.message, "error");
        else { Utils.showToast("Product deleted strictly.", "success"); fetchData(); }
        
        btn.disabled = false; btn.innerHTML = 'Delete';
        delModal.style.display = 'none';
    });

    // Execute Initial
    loadCategories();
    fetchData();
});
