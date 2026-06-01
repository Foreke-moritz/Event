// Products & Inventory Logic powered by Supabase

let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!supabase) return;
    
    // UI Elements
    const tableBody = document.getElementById('productsTable');
    const searchInput = document.getElementById('searchProduct');
    const lowStockFilter = document.getElementById('lowStockFilter');
    
    // Main Product Modal
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const modalAlert = document.getElementById('modalAlert');
    const modalTitle = document.getElementById('modalTitle');
    
    // Stock Modal
    const stockModal = document.getElementById('stockModal');
    const stockForm = document.getElementById('stockForm');
    const stockModalAlert = document.getElementById('stockModalAlert');
    const typeIncreaseBtn = document.getElementById('typeIncreaseBtn');
    const typeDecreaseBtn = document.getElementById('typeDecreaseBtn');

    // -------------------------------------------------------------
    // Initial Load & Render
    // -------------------------------------------------------------
    // Fetch user profile initials to the topbar
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const pName = user.user_metadata?.full_name || user.user_metadata?.business_name || 'Owner';
        document.getElementById('avatarDisplay').textContent = pName.charAt(0).toUpperCase();
    }

    async function fetchProducts() {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem;"><span class="spinner"></span> Loading products...</td></tr>';
        
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching products:", error);
            tableBody.innerHTML = `<tr><td colspan="7" style="color:var(--danger); text-align:center;">Failed to load products: ${error.message}</td></tr>`;
            return;
        }

        allProducts = data || [];
        renderProducts();
    }

    // Profit margin calculation helper
    function getProfitBadge(cost, sell) {
        if (!cost) return '';
        const profit = sell - cost;
        const margin = (profit / sell) * 100;
        const color = profit > 0 ? "var(--success)" : "var(--danger)";
        return `<div class="margin-info" style="color: ${color}">Margin: ${margin.toFixed(1)}% (${formatCurrency(profit)})</div>`;
    }

    function renderProducts() {
        const searchTerm = searchInput.value.toLowerCase();
        const showLowStockOnly = lowStockFilter.checked;

        // Apply filters
        const filtered = allProducts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm) || (p.category && p.category.toLowerCase().includes(searchTerm));
            
            let matchesStockStatus = true;
            if (showLowStockOnly) {
                // Return true if it is low stock or out of stock
                matchesStockStatus = p.quantity <= (p.low_stock_limit || 5);
            }

            return matchesSearch && matchesStockStatus;
        });

        tableBody.innerHTML = '';
        
        if (filtered.length === 0) {
            if (allProducts.length === 0) {
                // Exact empty state wording requested
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="empty-state">
                                <i class="fa-solid fa-box-open"></i>
                                <h3>No products found</h3>
                                <p>No products added yet. Add your first product to start managing your inventory.</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                 tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No products match your search.</td></tr>';
            }
            return;
        }

        filtered.forEach(prod => {
            let statusText = 'In Stock';
            let statusClass = 'status-in-stock';
            const lowLimit = prod.low_stock_limit !== null ? prod.low_stock_limit : 5;

            if (prod.quantity === 0) {
                statusText = 'Out of Stock';
                statusClass = 'status-out-stock';
            } else if (prod.quantity <= lowLimit) {
                statusText = 'Low Stock';
                statusClass = 'status-low-stock';
            }

            const cPrice = prod.cost_price ? formatCurrency(prod.cost_price) : '-';

            tableBody.innerHTML += `
                <tr>
                    <td style="font-weight: 500;">
                        ${prod.name}<br>
                        <small style="color: var(--text-muted); font-weight:normal;">${prod.description || ''}</small>
                    </td>
                    <td>${prod.category || '-'}</td>
                    <td>
                        <div style="font-weight: 600;">${formatCurrency(prod.selling_price)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Cost: ${cPrice}</div>
                        ${getProfitBadge(prod.cost_price, prod.selling_price)}
                    </td>
                    <td style="font-size: 1.125rem; font-weight: 600;">${prod.quantity}</td>
                    <td class="${statusClass}"><i class="fa-solid fa-circle" style="font-size: 0.5rem; vertical-align: middle;"></i> ${statusText}</td>
                    <td>${prod.supplier || '-'}</td>
                    <td>
                         <div style="display:flex; gap: 0.5rem;">
                            <!-- Edit -->
                            <button class="btn btn-outline edit-btn" data-id="${prod.id}" title="Edit Product" style="padding: 0.35rem 0.6rem;"><i class="fa-solid fa-pen"></i></button>
                            <!-- Adjust Stock -->
                            <button class="btn btn-outline adjust-btn" data-id="${prod.id}" title="Adjust Stock" style="padding: 0.35rem 0.6rem; color: var(--primary-color); border-color: var(--primary-color);"><i class="fa-solid fa-boxes-stacked"></i></button>
                            <!-- Delete -->
                            <button class="btn btn-outline delete-btn" data-id="${prod.id}" title="Delete" style="padding: 0.35rem 0.6rem; color: var(--danger); border-color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Attach global events dynamically generated inside table loop
        document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.id)));
        document.querySelectorAll('.adjust-btn').forEach(btn => btn.addEventListener('click', () => openStockModal(btn.dataset.id)));
    }


    // Filter listeners
    searchInput.addEventListener('input', renderProducts);
    lowStockFilter.addEventListener('change', renderProducts);


    // -------------------------------------------------------------
    // Add/Edit Product Flow
    // -------------------------------------------------------------
    document.getElementById('openAddModalBtn').addEventListener('click', () => {
        productForm.reset();
        document.getElementById('productId').value = '';
        modalTitle.textContent = 'Add New Product';
        modalAlert.classList.add('d-none');
        productModal.classList.add('show');
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => productModal.classList.remove('show'));
    document.getElementById('cancelBtn').addEventListener('click', () => productModal.classList.remove('show'));

    function openEditModal(id) {
        const prod = allProducts.find(p => p.id === id);
        if (!prod) return;

        productForm.reset();
        modalTitle.textContent = 'Edit Product';
        modalAlert.classList.add('d-none');

        document.getElementById('productId').value = prod.id;
        document.getElementById('productName').value = prod.name;
        document.getElementById('productCategory').value = prod.category || '';
        document.getElementById('productSupplier').value = prod.supplier || '';
        document.getElementById('productDesc').value = prod.description || '';
        document.getElementById('productCostPrice').value = prod.cost_price || '';
        document.getElementById('productSellPrice').value = prod.selling_price;
        document.getElementById('productQuantity').value = prod.quantity;
        document.getElementById('productLowLimit').value = prod.low_stock_limit !== null ? prod.low_stock_limit : 5;

        productModal.classList.add('show');
    }

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        modalAlert.classList.add('d-none');

        // Extract Data
        const id = document.getElementById('productId').value;
        const payload = {
            name: document.getElementById('productName').value.trim(),
            category: document.getElementById('productCategory').value.trim() || null,
            supplier: document.getElementById('productSupplier').value.trim() || null,
            description: document.getElementById('productDesc').value.trim() || null,
            cost_price: document.getElementById('productCostPrice').value ? parseFloat(document.getElementById('productCostPrice').value) : null,
            selling_price: parseFloat(document.getElementById('productSellPrice').value),
            quantity: parseInt(document.getElementById('productQuantity').value),
            low_stock_limit: document.getElementById('productLowLimit').value ? parseInt(document.getElementById('productLowLimit').value) : 5,
        };

        let result;
        if (id) {
            // Edit existing
            result = await supabase.from('products').update(payload).eq('id', id);
        } else {
            // Add new
            result = await supabase.from('products').insert([payload]);
        }

        if (result.error) {
            modalAlert.textContent = "Error: " + result.error.message;
            modalAlert.className = 'badge badge-danger';
        } else {
            productModal.classList.remove('show');
            await fetchProducts(); // Refresh layout
        }
        
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Product';
    });

    // -------------------------------------------------------------
    // Delete Profile Flow
    // -------------------------------------------------------------
    window.deleteProduct = async function(id) {
        if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;

        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
            alert('Error deleting product: ' + error.message);
        } else {
            await fetchProducts(); // Reload grid safely
        }
    }


    // -------------------------------------------------------------
    // Stock Adjustment Flow
    // -------------------------------------------------------------
    function openStockModal(id) {
        const prod = allProducts.find(p => p.id === id);
        if (!prod) return;

        document.getElementById('stockProductId').value = prod.id;
        document.getElementById('stockProductNameDisplay').textContent = prod.name;
        document.getElementById('currentStockDisplay').textContent = prod.quantity;
        
        stockForm.reset();
        stockModalAlert.classList.add('d-none');
        
        // Define active layout standard: 'increase' selected initially
        setTypeIncrease();

        stockModal.classList.add('show');
    }

    document.getElementById('closeStockModalBtn').addEventListener('click', () => stockModal.classList.remove('show'));

    // Toggle styling handlers for type selector
    const setTypeIncrease = () => {
        document.getElementById('stockMoveType').value = 'increase';
        typeIncreaseBtn.style.backgroundColor = "var(--primary-color)";
        typeIncreaseBtn.style.color = "white";
        typeDecreaseBtn.style.backgroundColor = "transparent";
        typeDecreaseBtn.style.color = "var(--text-main)";
    }
    const setTypeDecrease = () => {
        document.getElementById('stockMoveType').value = 'decrease';
        typeDecreaseBtn.style.backgroundColor = "var(--danger)";
        typeDecreaseBtn.style.color = "white";
        typeIncreaseBtn.style.backgroundColor = "transparent";
        typeIncreaseBtn.style.color = "var(--text-main)";
    }

    typeIncreaseBtn.addEventListener('click', setTypeIncrease);
    typeDecreaseBtn.addEventListener('click', setTypeDecrease);

    stockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveStockBtn = document.getElementById('saveStockBtn');
        saveStockBtn.disabled = true;
        saveStockBtn.innerHTML = '<span class="spinner"></span> Processing...';
        stockModalAlert.classList.add('d-none');

        const id = document.getElementById('stockProductId').value;
        const prod = allProducts.find(p => p.id === id);

        const moveType = document.getElementById('stockMoveType').value;
        const amount = parseInt(document.getElementById('adjustAmount').value);
        const note = document.getElementById('adjustNote').value.trim() || undefined;

        // Calculate new stock mathematically locally
        const newQuantity = moveType === 'increase' ? (prod.quantity + amount) : (prod.quantity - amount);

        // Disallow negative final totals gracefully unless forced
        if (newQuantity < 0) {
            stockModalAlert.textContent = `Error: Cannot decrease stock below 0. Maximum possible is ${prod.quantity}.`;
            stockModalAlert.className = 'badge badge-danger d-block';
            saveStockBtn.disabled = false;
            saveStockBtn.innerHTML = 'Confirm Adjustment';
            return;
        }

        // 1. Update product quantity in `products` table
        const { error: prodError } = await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', id);

        if (prodError) {
            stockModalAlert.textContent = "Error: " + prodError.message;
            stockModalAlert.className = 'badge badge-danger d-block';
            saveStockBtn.disabled = false;
            saveStockBtn.innerHTML = 'Confirm Adjustment';
            return;
        }

        // 2. Insert trace record into `stock_movements` table successfully.
        const movementTypeEnum = moveType === 'increase' ? 'stock_in' : 'stock_out';
        
        // Supabase handles RLS and User_id implicitly, but we just pass schema matches
        const { error: moveError } = await supabase
            .from('stock_movements')
            .insert([{
                product_id: id,
                movement_type: movementTypeEnum,
                quantity: moveType === 'increase' ? amount : -amount, // Record negative integers for decrements if preferred
                note: note
            }]);

        if (moveError) {
            console.warn("Failed saving stock movement timeline record:", moveError.message);
        }

        // Successful execution closes modal gracefully and reloads memory layout
        stockModal.classList.remove('show');
        saveStockBtn.disabled = false;
        saveStockBtn.innerHTML = 'Confirm Adjustment';
        
        await fetchProducts(); 
    });


    // Initial execution
    fetchProducts();
});
