// Sales Interaction Logic mapping directly to Supabase interactions

let allProducts = [];
let selectedProduct = null;
let activeBusinessName = 'Business Receipt';

document.addEventListener('DOMContentLoaded', async () => {
    if (!supabase) return;

    // UI Elements
    const productSelect = document.getElementById('saleProduct');
    const stockDisplay = document.getElementById('stockDisplay');
    const qtyInput = document.getElementById('saleQty');
    const priceInput = document.getElementById('salePrice');
    const paymentMethod = document.getElementById('paymentMethod');
    const totalDisplay = document.getElementById('saleTotal');
    const saleForm = document.getElementById('saleForm');
    const saveSaleBtn = document.getElementById('saveSaleBtn');
    const saleAlert = document.getElementById('saleAlert');
    
    // Receipt Elements
    const receiptModal = document.getElementById('receiptModal');
    const closeReceiptBtn = document.getElementById('closeReceiptBtn');
    const recentSalesTable = document.getElementById('recentSalesTable');

    // -------------------------------------------------------------
    // Initial Load & Auth
    // -------------------------------------------------------------
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const pName = user.user_metadata?.full_name || user.user_metadata?.business_name || 'Owner';
        activeBusinessName = user.user_metadata?.business_name || 'My Business';
        document.getElementById('avatarDisplay').textContent = pName.charAt(0).toUpperCase();
        document.getElementById('rbsnName').textContent = activeBusinessName;
    }

    async function initializeSales() {
        await fetchProducts();
        await fetchRecentSales();
    }

    async function fetchProducts() {
        productSelect.innerHTML = '<option value="">Loading products...</option>';
        
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error("Error fetching products:", error);
            productSelect.innerHTML = '<option value="">Error loading products</option>';
            return;
        }

        allProducts = data || [];
        
        productSelect.innerHTML = '<option value="">Select a product...</option>';
        allProducts.forEach(prod => {
            const outOfStockStr = prod.quantity <= 0 ? ' (Out of Stock)' : '';
            productSelect.innerHTML += `<option value="${prod.id}" ${prod.quantity <= 0 ? 'disabled' : ''}>${prod.name}${outOfStockStr}</option>`;
        });
    }

    async function fetchRecentSales() {
        recentSalesTable.innerHTML = '<tr><td colspan="5" style="text-align: center;"><span class="spinner"></span></td></tr>';
        
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .order('sale_date', { ascending: false })
            .limit(10); // Fetch latest 10 sales

        if (error) {
            recentSalesTable.innerHTML = `<tr><td colspan="5" style="color:var(--danger); text-align:center;">Failed to load recent sales.</td></tr>`;
            return;
        }

        recentSalesTable.innerHTML = '';
        if (data.length === 0) {
            recentSalesTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No recent sales.</td></tr>`;
            return;
        }

        data.forEach(sale => {
            const dateStr = new Date(sale.sale_date).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            recentSalesTable.innerHTML += `
                <tr>
                    <td style="font-size: 0.875rem; color: var(--text-muted);">${dateStr}</td>
                    <td style="font-weight: 500;">${sale.product_name}</td>
                    <td><span class="badge" style="background-color: var(--bg-color); color: var(--text-muted); border: 1px solid var(--border-color);">${sale.payment_method}</span></td>
                    <td>${sale.quantity_sold}</td>
                    <td style="font-weight: 600; color: var(--success);">${formatCurrency(sale.total_amount)}</td>
                </tr>
            `;
        });
    }

    document.getElementById('refreshSalesBtn').addEventListener('click', fetchRecentSales);

    // -------------------------------------------------------------
    // Form Interaction Logic
    // -------------------------------------------------------------
    productSelect.addEventListener('change', () => {
        const prodId = productSelect.value;
        saleAlert.classList.add('d-none');
        
        if (!prodId) {
            selectedProduct = null;
            stockDisplay.textContent = '';
            priceInput.value = '';
            qtyInput.value = '';
            qtyInput.disabled = true;
            paymentMethod.disabled = true;
            saveSaleBtn.disabled = true;
            totalDisplay.textContent = '0.00 FCFA';
            return;
        }

        selectedProduct = allProducts.find(p => p.id === prodId);
        
        if (selectedProduct) {
            stockDisplay.textContent = `${selectedProduct.quantity} currently in stock`;
            stockDisplay.style.color = selectedProduct.quantity > (selectedProduct.low_stock_limit || 5) ? 'var(--success)' : 'var(--danger)';
            
            priceInput.value = formatCurrency(selectedProduct.selling_price);
            qtyInput.max = selectedProduct.quantity;
            qtyInput.disabled = false;
            paymentMethod.disabled = false;
            saveSaleBtn.disabled = false;
            
            // Auto default qty to 1 and compute total
            qtyInput.value = 1;
            calculateTotal();
        }
    });

    qtyInput.addEventListener('input', calculateTotal);

    function calculateTotal() {
        if (!selectedProduct) return;
        const qty = parseInt(qtyInput.value) || 0;
        
        if (qty > selectedProduct.quantity) {
             saleAlert.textContent = `Error: You cannot sell more than the available stock (${selectedProduct.quantity}).`;
             saleAlert.className = 'badge badge-danger d-block';
             saveSaleBtn.disabled = true;
             totalDisplay.textContent = '0.00 FCFA';
        } else if (qty <= 0) {
             saveSaleBtn.disabled = true;
             totalDisplay.textContent = '0.00 FCFA';
        } else {
             saleAlert.classList.add('d-none');
             saveSaleBtn.disabled = false;
             totalDisplay.textContent = formatCurrency(qty * selectedProduct.selling_price);
        }
    }


    // -------------------------------------------------------------
    // Sale Execution Logic
    // -------------------------------------------------------------
    saleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedProduct || saveSaleBtn.disabled) return;

        const qty = parseInt(qtyInput.value);
        const pMethod = paymentMethod.value;

        if (qty <= 0 || qty > selectedProduct.quantity) return;

        saveSaleBtn.disabled = true;
        saveSaleBtn.innerHTML = '<span class="spinner"></span> Recording...';
        saleAlert.classList.add('d-none');
        
        try {
            const unitPrice = selectedProduct.selling_price;
            const totalAmount = unitPrice * qty;
            const costPrice = selectedProduct.cost_price || 0;
            const profit = (unitPrice - costPrice) * qty;

            const newStockQty = selectedProduct.quantity - qty;

            // 1. Insert into sales table
            const { error: saleErr } = await supabase.from('sales').insert([{
                product_id: selectedProduct.id,
                product_name: selectedProduct.name,
                quantity_sold: qty,
                unit_price: unitPrice,
                total_amount: totalAmount,
                profit: profit,
                payment_method: pMethod
            }]);
            if (saleErr) throw saleErr;

            // 2. Decrement stock in products table
            const { error: prodErr } = await supabase.from('products')
                .update({ quantity: newStockQty })
                .eq('id', selectedProduct.id);
            if (prodErr) throw prodErr;

            // 3. Insert into stock_movements
            const { error: moveErr } = await supabase.from('stock_movements').insert([{
                product_id: selectedProduct.id,
                movement_type: 'sale',
                quantity: -qty, // negative to denote deduction
                note: `Sale generated with method: ${pMethod}`
            }]);
            if (moveErr) throw moveErr;

            // Successful Execution
            saleAlert.textContent = "Sale recorded successfully!";
            saleAlert.className = 'badge badge-success d-block';
            
            // Show print modal with receipt details
            showReceipt(selectedProduct.name, qty, unitPrice, totalAmount, pMethod);
            
            // Reset state carefully
            saleForm.reset();
            selectedProduct = null;
            qtyInput.disabled = true;
            paymentMethod.disabled = true;
            stockDisplay.textContent = '';
            totalDisplay.textContent = '0.00 FCFA';
            
            // Refresh tables entirely
            await initializeSales();

        } catch (error) {
            console.error("Sale transaction error:", error);
            saleAlert.textContent = "Failed to record sale: " + error.message;
            saleAlert.className = 'badge badge-danger d-block';
        } finally {
            saveSaleBtn.disabled = false;
            saveSaleBtn.innerHTML = 'Complete Sale';
            setTimeout(() => { saleAlert.classList.add('d-none'); }, 5000); // clear success msg eventually
        }
    });


    // -------------------------------------------------------------
    // Receipt Generating
    // -------------------------------------------------------------
    function showReceipt(name, qty, unitPrice, total, method) {
        document.getElementById('rProdName').textContent = name;
        document.getElementById('rQty').textContent = qty;
        document.getElementById('rUnit').textContent = formatCurrency(unitPrice);
        document.getElementById('rTotal').textContent = formatCurrency(total);
        document.getElementById('rMethod').textContent = method;
        
        const now = new Date();
        document.getElementById('rDate').textContent = now.toLocaleString();

        receiptModal.classList.add('show');
    }

    closeReceiptBtn.addEventListener('click', () => {
        receiptModal.classList.remove('show');
    });

    // Start cycle
    initializeSales();
});
