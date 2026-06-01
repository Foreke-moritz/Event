// Reports Generation Engine tied to Supabase

let rawSales = [];
let rawProducts = [];
let businessCurrency = 'FCFA';
let lastExportRender = []; // Used to track data to easily translate into CSV blob formats
let lastExportHeaders = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!supabase) return;

    // Load initial metadata safely
    const { data: { user } } = await supabase.auth.getUser();
    if(user) {
        document.getElementById('avatarDisplay').textContent = (user.user_metadata?.first_name || user.user_metadata?.business_name || 'U').charAt(0).toUpperCase();
        const { data: bset } = await supabase.from('business_settings').select('currency').eq('user_id', user.id).single();
        if(bset && bset.currency) businessCurrency = bset.currency;
    }

    // Element Bindings
    const fReportType = document.getElementById('fReportType');
    const fStart = document.getElementById('fStart');
    const fEnd = document.getElementById('fEnd');
    const fProduct = document.getElementById('fProduct');
    const fMethod = document.getElementById('fMethod');
    
    // UI Panels bindings
    const metricsArea = document.getElementById('reportsMetrics');
    const thead = document.getElementById('trHeader');
    const tbody = document.getElementById('trBody');

    // ----------------------------------------------------------------------
    // Global data ingestion mechanism 
    // ----------------------------------------------------------------------
    async function ingestData() {
        metricsArea.innerHTML = '<div class="metric" style="border:none;"><span class="spinner"></span> Loading massive data structures...</div>';
        try {
            // Load Products
            const { data: pData } = await supabase.from('products').select('*').order('name', {ascending: true});
            rawProducts = pData || [];
            
            fProduct.innerHTML = '<option value="all">All Products</option>';
            rawProducts.forEach(p => {
                fProduct.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            });

            // Load Sales
            const { data: sData } = await supabase.from('sales').select('*').order('sale_date', {ascending: false});
            rawSales = sData || [];

            // Automatically build the initial report based on default selects
            buildReport();

        } catch (e) {
            console.error("Data ingestion failure:", e);
            showMessage("Failed to ingest data for reports.", true);
        }
    }

    // ----------------------------------------------------------------------
    // Filter Handlers
    // ----------------------------------------------------------------------
    function adaptFilterVisibility() {
        const t = fReportType.value;
        const dStart = document.getElementById('dateGroupStart');
        const dEnd = document.getElementById('dateGroupEnd');
        const pGrp = document.getElementById('productGroup');
        const mGrp = document.getElementById('methodGroup');
        
        if(t === 'inventory' || t === 'lowstock') {
            dStart.style.display = 'none';
            dEnd.style.display = 'none';
            mGrp.style.display = 'none';
            pGrp.style.display = 'block'; // Users can still isolate an exact product natively
        } else {
            dStart.style.display = 'block';
            dEnd.style.display = 'block';
            mGrp.style.display = 'block';
            pGrp.style.display = 'block';
        }
    }

    fReportType.addEventListener('change', () => {
        adaptFilterVisibility();
        buildReport();
    });

    document.getElementById('btnApply').addEventListener('click', buildReport);
    
    document.getElementById('btnClear').addEventListener('click', () => {
        fStart.value = '';
        fEnd.value = '';
        fProduct.value = 'all';
        fMethod.value = 'all';
        buildReport();
    });

    // ----------------------------------------------------------------------
    // Report Builder Engine
    // ----------------------------------------------------------------------
    function buildReport() {
        const type = fReportType.value;
        let dStart = fStart.value ? new Date(fStart.value + 'T00:00:00') : null;
        let dEnd = fEnd.value ? new Date(fEnd.value + 'T23:59:59') : null;
        let prodId = fProduct.value;
        let method = fMethod.value;

        // Reset export buffers explicitly preventing memory caching clashes
        lastExportRender = [];
        lastExportHeaders = [];

        if (type === 'sales' || type === 'profit') {
            // Apply Filters to Sales Array iteratively
            let scopedSales = rawSales.filter(s => {
                const sd = new Date(s.sale_date);
                let pass = true;
                if (dStart && sd < dStart) pass = false;
                if (dEnd && sd > dEnd) pass = false;
                if (prodId !== 'all' && s.product_id !== prodId) pass = false;
                if (method !== 'all' && s.payment_method !== method) pass = false;
                return pass;
            });

            if (type === 'sales') {
                document.getElementById('printTitle').textContent = "Sales Activity Report";
                document.getElementById('printTitle').style.display = "block";

                // Aggregate calculations
                const totalVol = scopedSales.reduce((sum, s) => sum + s.total_amount, 0);
                const totalTrans = scopedSales.length;

                metricsArea.innerHTML = `
                    <div class="metric"><h4>Total Sales Value</h4><div class="val">${formatCurrency(totalVol, businessCurrency)}</div></div>
                    <div class="metric" style="border-left-color: var(--success);"><h4>Transactions</h4><div class="val">${totalTrans} Count</div></div>
                `;

                // Set HTML Grid
                thead.innerHTML = `<th>Date</th><th>Product</th><th>Method</th><th>Qty</th><th>Total Amount</th>`;
                lastExportHeaders = ["Date", "Product", "Method", "Qty", "Total Amount"];

                tbody.innerHTML = '';
                if(scopedSales.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No data found inside parameters.</td></tr>';

                scopedSales.forEach(s => {
                    const rowData = [
                        formatDateString(s.sale_date),
                        s.product_name,
                        s.payment_method,
                        s.quantity_sold,
                        s.total_amount
                    ];
                    lastExportRender.push(rowData);
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${rowData[0]}</td>
                            <td style="font-weight:500;">${rowData[1]}</td>
                            <td>${rowData[2]}</td>
                            <td>${rowData[3]}</td>
                            <td style="color:var(--success); font-weight:600;">${formatCurrency(rowData[4], businessCurrency)}</td>
                        </tr>
                    `;
                });

            } else if (type === 'profit') {
                document.getElementById('printTitle').textContent = "Profit Analysis Report";
                document.getElementById('printTitle').style.display = "block";

                // Aggregate profit calculations safely derived from backend fields directly
                const totalProfit = scopedSales.reduce((sum, s) => sum + (s.profit || 0), 0);
                const totalRevenue = scopedSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
                const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

                metricsArea.innerHTML = `
                    <div class="metric" style="border-left-color: var(--success);"><h4>Net Profit</h4><div class="val">${formatCurrency(totalProfit, businessCurrency)}</div></div>
                    <div class="metric"><h4>Generated Margin</h4><div class="val">${margin}% % Avg</div></div>
                `;

                thead.innerHTML = `<th>Date</th><th>Product</th><th>Revenue</th><th>Profit</th>`;
                lastExportHeaders = ["Date", "Product", "Revenue", "Profit"];

                tbody.innerHTML = '';
                if(scopedSales.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No data found inside parameters.</td></tr>';

                scopedSales.forEach(s => {
                    const prof = s.profit || 0;
                    const rowData = [
                        formatDateString(s.sale_date),
                        s.product_name,
                        s.total_amount,
                        prof
                    ];
                    lastExportRender.push(rowData);

                    tbody.innerHTML += `
                        <tr>
                            <td>${rowData[0]}</td>
                            <td style="font-weight:500;">${rowData[1]}</td>
                            <td>${formatCurrency(rowData[2], businessCurrency)}</td>
                            <td style="color:var(--success); font-weight:600;">${formatCurrency(rowData[3], businessCurrency)}</td>
                        </tr>
                    `;
                });
            }

        } else if (type === 'inventory' || type === 'lowstock') {
            // Apply filtering exclusively onto product tree bypassing dates entirely
            let scopedProducts = rawProducts.filter(p => {
                let pass = true;
                if (prodId !== 'all' && p.id !== prodId) pass = false;
                
                if (type === 'lowstock') {
                    if (p.quantity > (p.low_stock_limit || 5)) pass = false;
                }
                return pass;
            });

            document.getElementById('printTitle').textContent = type === 'lowstock' ? "Low Stock Report" : "Inventory Status Report";
            document.getElementById('printTitle').style.display = "block";

            // Aggrs
            const totalStock = scopedProducts.reduce((sum, p) => sum + p.quantity, 0);
            const totalValue = scopedProducts.reduce((sum, p) => sum + (p.quantity * (p.cost_price || 0)), 0);

            metricsArea.innerHTML = `
                <div class="metric"><h4>Items Queried</h4><div class="val">${scopedProducts.length} unique products</div></div>
                <div class="metric" style="border-left-color: var(--warning);"><h4>Total Stock Held</h4><div class="val">${totalStock} Units</div></div>
            `;

            thead.innerHTML = `<th>Product</th><th>Category</th><th>Qty</th><th>Status</th><th>Total Val (Cost)</th>`;
            lastExportHeaders = ["Product", "Category", "Qty", "Status", "Total Val"];

            tbody.innerHTML = '';
            if(scopedProducts.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No data matching parameters.</td></tr>';

            scopedProducts.forEach(p => {
                let status = 'In Stock';
                if(p.quantity === 0) status = 'Out of Stock';
                else if (p.quantity <= (p.low_stock_limit||5)) status = 'Low Stock';

                const val = p.quantity * (p.cost_price||0);

                const rowData = [
                    p.name,
                    p.category || 'N/A',
                    p.quantity,
                    status,
                    val
                ];
                lastExportRender.push(rowData);

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:500;">${rowData[0]}</td>
                        <td>${rowData[1]}</td>
                        <td style="font-weight:600;">${rowData[2]}</td>
                        <td>${rowData[3]}</td>
                        <td>${formatCurrency(rowData[4], businessCurrency)}</td>
                    </tr>
                `;
            });
        }
    }


    // ----------------------------------------------------------------------
    // Printing actions linking to standard window functionalities natively 
    // ----------------------------------------------------------------------
    document.getElementById('btnPrint').addEventListener('click', () => {
        window.print();
    });

    // ----------------------------------------------------------------------
    // CSV Export Handler
    // ----------------------------------------------------------------------
    document.getElementById('btnExport').addEventListener('click', () => {
        if (lastExportRender.length === 0) {
            showMessage("No data available to export.", true);
            return;
        }

        const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Append Headers safely
        csvContent += lastExportHeaders.map(escapeCSV).join(",") + "\r\n";
        
        // Append Data cleanly rendering multidimensional array values directly
        lastExportRender.forEach(row => {
            csvContent += row.map(escapeCSV).join(",") + "\r\n";
        });

        // Encode exactly triggering browser to download
        const encodedURI = encodeURI(csvContent);
        const a = document.createElement("a");
        a.href = encodedURI;
        a.download = `report_export_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showMessage("CSV Export Generated!");
    });


    // Ignite Process
    ingestData();
});
