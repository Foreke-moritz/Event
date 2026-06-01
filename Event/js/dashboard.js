// Dashboard metrics logic utilizing Supabase queries natively

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;

    let currencyStr = 'FCFA'; // default

    // Load User Data & Setup Profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const fullName = user.user_metadata?.full_name || 'Business Owner';
        const businessName = user.user_metadata?.business_name || 'My Business';
        document.getElementById('businessNameDisplay').textContent = `${fullName} (${businessName})`;
        document.getElementById('avatarDisplay').textContent = (fullName.charAt(0) || businessName.charAt(0)).toUpperCase();

        // Fetch User settings for custom currency
        const { data: bst } = await supabase.from('business_settings').select('currency').eq('user_id', user.id).single();
        if (bst && bst.currency) {
            currencyStr = bst.currency;
        }
    }

    // --------------------------------------------------------------------------------
    // Execute Parallel Backend Sub-Requests gracefully
    // --------------------------------------------------------------------------------

    async function loadDashboardMetrics() {
        try {
            // A. Fetch Products Summary
            const { data: products } = await supabase.from('products').select('*');
            let totalProducts = 0;
            let totalStockQty = 0;
            let lowStockCount = 0;
            let outOfStockCount = 0;
            let inventoryValuation = 0;
            let potentialRevenue = 0;

            if (products) {
                totalProducts = products.length;
                products.forEach(p => {
                    const qty = p.quantity || 0;
                    totalStockQty += qty;
                    
                    if (qty === 0) outOfStockCount++;
                    else if (qty <= (p.low_stock_limit || 5)) lowStockCount++;

                    inventoryValuation += (p.cost_price || 0) * qty;
                    potentialRevenue += (p.selling_price || 0) * qty;
                });
            }

            document.getElementById('spTotalProducts').parentElement.innerHTML = totalProducts;
            document.getElementById('spTotalStock').parentElement.innerHTML = totalStockQty;
            document.getElementById('spLowStock').parentElement.innerHTML = lowStockCount;
            document.getElementById('spOutOfStock').parentElement.innerHTML = outOfStockCount;

            // Render Inventory Valuation Table
            const invHtml = `
                <tr><td style="color:var(--text-muted);">Stock Valuation (Cost)</td><td style="text-align:right; font-weight:600;">${formatCurrency(inventoryValuation, currencyStr)}</td></tr>
                <tr><td style="color:var(--text-muted);">Potential Revenue</td><td style="text-align:right; font-weight:600; color:var(--primary-color);">${formatCurrency(potentialRevenue, currencyStr)}</td></tr>
            `;
            document.getElementById('dbInventorySummary').innerHTML = invHtml;

            // B. Render low stock quick view limited to 5
            const lowStockGrid = document.getElementById('dbLowStock');
            if (products) {
                const lsItems = products.filter(p => p.quantity <= (p.low_stock_limit || 5)).sort((a,b) => a.quantity - b.quantity).slice(0, 5);
                lowStockGrid.innerHTML = '';
                if(lsItems.length === 0){
                    lowStockGrid.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);">No low stock items.</td></tr>';
                }
                lsItems.forEach(item => {
                    const color = item.quantity === 0 ? 'var(--danger)' : 'var(--warning)';
                    lowStockGrid.innerHTML += `<tr><td>${item.name}</td><td><span class="badge" style="background-color: ${color}; color:white;">${item.quantity}</span></td></tr>`;
                });
            }

            // C. Fetch Sales Summary comprehensively
            const { data: sales } = await supabase.from('sales').select('*').order('sale_date', { ascending: false });
            let totalSalesAmt = 0;
            let totalProfit = 0;
            let todaySales = 0;
            let monthSales = 0;

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const monthStr = todayStr.substring(0, 7);

            // Grouping for best sellers
            const soldAgg = {};

            const rcSalesGrid = document.getElementById('dbRecentSales');
            rcSalesGrid.innerHTML = '';

            if (sales && sales.length > 0) {
                sales.forEach((s, index) => {
                    totalSalesAmt += s.total_amount || 0;
                    totalProfit += s.profit || 0;
                    
                    const sDt = new Date(s.sale_date);
                    const sIso = sDt.toISOString().split('T')[0];
                    if (sIso === todayStr) todaySales += s.total_amount;
                    if (sIso.startsWith(monthStr)) monthSales += s.total_amount;

                    // Aggregate quantities
                    if (!soldAgg[s.product_name]) soldAgg[s.product_name] = 0;
                    soldAgg[s.product_name] += s.quantity_sold;

                    // Populate recent table (limit 5)
                    if (index < 5) {
                        rcSalesGrid.innerHTML += `
                            <tr>
                                <td>${s.product_name}</td>
                                <td>${s.quantity_sold}</td>
                                <td style="font-weight:600; color:var(--success);">${formatCurrency(s.total_amount, currencyStr)}</td>
                                <td style="font-size:0.75rem; color:var(--text-muted);">${formatDateString(s.sale_date)}</td>
                            </tr>
                        `;
                    }
                });

                if (sales.length === 0) {
                    rcSalesGrid.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No recent sales.</td></tr>';
                }

                // Render Best Sellers limited to 5
                const bsGrid = document.getElementById('dbBestSellers');
                const sortedSellers = Object.entries(soldAgg).sort((a,b) => b[1] - a[1]).slice(0, 5);
                bsGrid.innerHTML = '';
                sortedSellers.forEach(([name, qty]) => {
                    bsGrid.innerHTML += `<tr><td>${name}</td><td style="font-weight:600;">${qty}</td></tr>`;
                });
                
            } else {
                rcSalesGrid.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No recent sales recorded.</td></tr>';
                document.getElementById('dbBestSellers').innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);">No data available.</td></tr>';
            }

            // Assign values to big grid
            document.getElementById('spTotalSalesAmt').parentElement.innerHTML = formatCurrency(totalSalesAmt, currencyStr);
            document.getElementById('spTotalProfit').parentElement.innerHTML = formatCurrency(totalProfit, currencyStr);
            document.getElementById('spTodaySales').parentElement.innerHTML = formatCurrency(todaySales, currencyStr);
            document.getElementById('spMonthSales').parentElement.innerHTML = formatCurrency(monthSales, currencyStr);


        } catch (error) {
            console.error("Dashboard error:", error);
            showMessage("Failed to load some dashboard metrics natively.", true);
        }
    }

    loadDashboardMetrics();

});
