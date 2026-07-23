import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Trash2, Eye, Filter, ChevronLeft, ChevronRight, TrendingUp, Calendar, Clock, User, Package, Activity, DollarSign, Check, X, Printer, EyeOff } from 'lucide-react';
import db from '../../database/db';
import { format } from 'date-fns';
import PasswordModal from '../common/PasswordModal';

const Sales = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState({ totalSales: 0, count: 0, avgSale: 0 });

    // For View Modal
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingSale, setViewingSale] = useState(null);
    const [saleDetails, setSaleDetails] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const [sortBy, setSortBy] = useState('date-desc');

    const loadSales = async () => {
        setLoading(true);
        try {
            let orderByClause = "ORDER BY i.date DESC, i.id DESC";

            if (sortBy === 'date-asc') {
                orderByClause = "ORDER BY i.date ASC, i.id ASC";
            } else if (sortBy === 'amount-desc') {
                orderByClause = "ORDER BY i.total DESC";
            } else if (sortBy === 'amount-asc') {
                orderByClause = "ORDER BY i.total ASC";
            }

            const query = `
                SELECT 
                    i.*, 
                    p.name as patient_name,
                    (SELECT GROUP_CONCAT(s.name, ', ') FROM invoice_services iserv JOIN services s ON iserv.service_id = s.id WHERE iserv.invoice_id = i.id) as services_list,
                    (SELECT GROUP_CONCAT(pr.name, ', ') FROM invoice_products iprod JOIN products pr ON iprod.product_id = pr.id WHERE iprod.invoice_id = i.id) as products_list
                FROM invoices i
                LEFT JOIN patients p ON i.patient_id = p.id
                ${orderByClause}
            `;
            const data = await db.all(query);

            // Filter by search
            const filteredData = data.filter(item =>
                (item.patient_name || 'Walking Customer').toLowerCase().includes(search.toLowerCase()) ||
                (item.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.services_list || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.products_list || '').toLowerCase().includes(search.toLowerCase())
            );

            setSales(filteredData || []);
            setLoading(false);
        } catch (err) {
            console.error('Error loading sales:', err);
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date >= date('now', 'localtime', 'start of year')";

            const statsQuery = `
                SELECT 
                    SUM(total + item_discount) as totalSales, 
                    COUNT(*) as count,
                    AVG(total + item_discount) as avgSale
                FROM invoices 
                WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
            `;
            const res = await db.get(statsQuery);
            setStats({
                totalSales: res?.totalSales || 0,
                count: res?.count || 0,
                avgSale: res?.avgSale || 0
            });
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    useEffect(() => {
        loadSales();
    }, [search, sortBy]);

    useEffect(() => {
        loadStats();
    }, [statsPeriod]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadSales();
            loadStats();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, sortBy, statsPeriod]);

    const handleDelete = async (id) => {
        requestSecureAction(async () => {
            try {
                // First, revert stock for products in this invoice
                const products = await db.all("SELECT product_id, quantity FROM invoice_products WHERE invoice_id = ?", [id]);
                for (const p of products) {
                    await db.run("UPDATE products SET stock = stock + ? WHERE id = ?", [p.quantity, p.product_id]);
                }

                // Delete relations
                await db.run("DELETE FROM invoice_services WHERE invoice_id = ?", [id]);
                await db.run("DELETE FROM invoice_products WHERE invoice_id = ?", [id]);
                // Delete invoice
                await db.run("DELETE FROM invoices WHERE id = ?", [id]);

                setDeleteConfirm(null);
                loadSales();
                loadStats();
            } catch (err) {
                console.error('Error deleting sale:', err);
                setDeleteConfirm(null);
            }
        }, "Delete Sale");
    };

    const loadSaleDetails = async (invoiceId) => {
        console.log('loadSaleDetails called with invoiceId:', invoiceId);
        try {
            // Get invoice with patient info
            const invoice = await db.get(`
                SELECT 
                    i.*, 
                    p.name as patient_name,
                    p.phone as patient_contact
                FROM invoices i
                LEFT JOIN patients p ON i.patient_id = p.id
                WHERE i.id = ?
            `, [invoiceId]);
            console.log('Invoice data:', invoice);

            // Get doctor info from invoice_doctors table
            const doctorInfo = await db.get(`
                SELECT d.name as doctor_name, id.price as doctor_fee, id.discount as doctor_discount
                FROM invoice_doctors id
                JOIN doctors d ON id.doctor_id = d.id
                WHERE id.invoice_id = ?
            `, [invoiceId]);
            console.log('Doctor info:', doctorInfo);

            // Merge doctor info into invoice
            if (doctorInfo) {
                invoice.doctor_name = doctorInfo.doctor_name;
                invoice.doctor_fee = doctorInfo.doctor_fee;
                invoice.doctor_discount = doctorInfo.doctor_discount || 0;
            }

            // Get services (price is stored in invoice_services, not services table)
            const services = await db.all(`
                SELECT s.name, iserv.price, iserv.quantity, iserv.discount
                FROM invoice_services iserv
                JOIN services s ON iserv.service_id = s.id
                WHERE iserv.invoice_id = ?
            `, [invoiceId]);
            console.log('Services data:', services);

            // Get products (price is stored in invoice_products)
            const products = await db.all(`
                SELECT pr.name, iprod.price, iprod.quantity, iprod.discount
                FROM invoice_products iprod
                JOIN products pr ON iprod.product_id = pr.id
                WHERE iprod.invoice_id = ?
            `, [invoiceId]);
            console.log('Products data:', products);

            const details = {
                invoice,
                services,
                products
            };
            console.log('Setting sale details:', details);
            setSaleDetails(details);
            return true; // Return success
        } catch (err) {
            console.error('Error loading sale details:', err);
            return false; // Return failure
        }
    };

    const handlePrintInvoice = async (inv) => {
        try {
            // Fetch invoice items if not available
            const servs = await db.all("SELECT s.name, iserv.quantity, iserv.price, iserv.discount FROM invoice_services iserv JOIN services s ON iserv.service_id = s.id WHERE iserv.invoice_id = ?", [inv.id]);
            const prods = await db.all("SELECT p.name, iprod.quantity, iprod.price, iprod.discount FROM invoice_products iprod JOIN products p ON iprod.product_id = p.id WHERE iprod.invoice_id = ?", [inv.id]);
            const docs = await db.all("SELECT d.name, idoc.price, idoc.discount FROM invoice_doctors idoc JOIN doctors d ON idoc.doctor_id = d.id WHERE idoc.invoice_id = ?", [inv.id]);

            const items = [
                ...(servs || []).map(s => ({ ...s, type: 'service', discount: s.discount || 0 })),
                ...(prods || []).map(p => ({ ...p, type: 'product', discount: p.discount || 0 })),
                ...(docs || []).map(d => ({ ...d, type: 'doctor', quantity: 1, discount: d.discount || 0 }))
            ];

            const dateStr = format(new Date(inv.date), 'dd-MM-yy hh:mm a');
            // Assuming inv has patient_name from the main query
            printReceipt(inv.invoice_number, inv.patient_name || 'Walking Patient', items, inv.total, dateStr, inv.discount);
        } catch (err) {
            console.error('Error printing invoice:', err);
        }
    };

    const printReceipt = (invoiceNum, patientName, items, totalAmt, dateStr, discount = 0) => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '80mm';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Invoice ${invoiceNum}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        .receipt-font { font-family: 'Courier New', Courier, monospace; }
                        body { 
                            width: 72mm; 
                            padding: 4mm; 
                            margin: 0;
                            color: #000;
                            background: #fff;
                        }
                        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 3mm; margin-bottom: 3mm; }
                        .clinic-name { font-size: 14pt; font-weight: bold; margin-bottom: 1mm; }
                        .receipt-info { font-size: 10pt; margin-bottom: 4mm; line-height: 1.4; }
                        .items-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 4mm; }
                        .items-table th { border-bottom: 1px dashed #000; text-align: left; padding: 1mm 0; }
                        .items-table td { padding: 1.5mm 0; vertical-align: top; }
                        .total-section { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; text-align: right; }
                        .grand-total { font-size: 13pt; font-weight: bold; }
                        .footer { margin-top: 8mm; text-align: center; font-size: 11pt; border-top: 1px dashed #000; padding-top: 2mm; line-height: 1.4; }
                    </style>
                </head>
                <body class="receipt-font">
                    <div class="header">
                        <img 
                            src="asset://receiptlogo.jpeg?t=${Date.now()}" 
                            style="height: 30mm; margin-bottom: 2mm; object-fit: contain;" 
                            onerror="
                                if (this.src.includes('receiptlogo.jpeg')) { this.src = 'asset://receiptlogo.png?t=${Date.now()}'; }
                                else if (this.src.includes('receiptlogo.png')) { this.src = 'asset://receiptlogo.jpg?t=${Date.now()}'; }
                                else if (this.src.includes('receiptlogo.jpg')) { this.src = 'resources/logo.jpeg'; }
                                else if (this.src.includes('resources/logo.jpeg')) { this.src = 'asset://logo.jpeg?t=${Date.now()}'; }
                                else if (this.src.includes('asset://logo.jpeg')) { this.src = 'asset://logo.png?t=${Date.now()}'; }
                                else if (this.src.includes('asset://logo.png')) { this.src = 'asset://logo.jpg?t=${Date.now()}'; }
                                else { this.style.display = 'none'; }
                            " 
                        />
                        <div class="clinic-name">AESTHETIC AURA</div>
                        <div style="font-size: 10pt;">by Dr. Maryum Qazi</div>
                    </div>
                    <div class="receipt-info">
                        <strong>Invoice:</strong> ${invoiceNum}<br>
                        <strong>Date:</strong> ${dateStr}<br>
                        <strong>Patient:</strong> ${patientName}
                    </div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 35%;">Item</th>
                                <th style="text-align: right; width: 15%;">Price</th>
                                <th style="text-align: center; width: 10%;">Qty</th>
                                <th style="text-align: right; width: 20%;">Disc.</th>
                                <th style="text-align: right; width: 20%;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => {
            return `
                                <tr>
                                    <td>${item.name}</td>
                                    <td style="text-align: right;">${(item.price || 0).toLocaleString()}</td>
                                    <td style="text-align: center;">${item.quantity}</td>
                                    <td style="text-align: right;">${(item.discount || 0).toLocaleString()}</td>
                                    <td style="text-align: right;">${((item.quantity * item.price) - (item.discount || 0)).toLocaleString()}</td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                    <div class="total-section">
                        <div style="font-size: 11pt; margin-bottom: 0.5mm; font-weight: 500;">Subtotal: Rs. ${items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0).toLocaleString()}</div>
                        <div style="font-size: 11pt; margin-bottom: 1mm; font-weight: 500;">Discounts: - Rs. ${(items.reduce((acc, curr) => acc + (curr.discount || 0), 0) + (discount || 0)).toLocaleString()}</div>
                        <div class="grand-total">TOTAL: Rs. ${totalAmt.toLocaleString()}</div>
                    </div>
                    <div class="footer">
                        Thank you for visiting!<br>
                        PrimeSoft Agency - 0309-5369472
                    </div>
                </body>
            </html>
        `);
        iframeDoc.close();

        // Wait for content to load before printing
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            // Remove iframe after printing
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }, 500);
    };


    const StatCard = ({ title, value, icon: Icon, color, subValue }) => (
        <div className="bg-[#121826] border border-gray-800 p-6 rounded-2xl group hover:border-teal-500/30 transition-all duration-300 shadow-xl">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-400 group-hover:scale-110 transition-transform`}>
                    <Icon size={24} />
                </div>
                <div className="bg-[#1a2233] px-2 py-1 rounded text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {statsPeriod}
                </div>
            </div>
            <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-1">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className={`text-2xl font-bold text-white ${title.toLowerCase().includes('revenue') || title.toLowerCase().includes('average') ? 'font-sans tracking-tight' : ''}`}>{value}</h3>
                </div>
                {subValue && <p className="text-[10px] text-gray-500 mt-1 font-medium">{subValue}</p>}
            </div>
        </div>
    );

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-hidden">
            {/* Header Area */}
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Sales Record</h1>

            {/* Sales Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-white font-sans tracking-wider">Sales Analytics</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Sales Analytics");
                                } else {
                                    setShowStats(false);
                                }
                            }}
                            className="bg-[#1a2233] hover:bg-gray-800 text-white p-2 rounded-xl border border-gray-700 transition-all flex items-center gap-2 text-sm font-semibold"
                        >
                            {showStats ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showStats ? 'Hide Stats' : 'Show Stats'}
                        </button>
                        <div className="flex bg-[#1a2233] p-1 rounded-xl border border-gray-700">
                            {['Daily', 'Weekly', 'Monthly', 'Annual'].map(period => (
                                <button
                                    key={period}
                                    onClick={() => setStatsPeriod(period)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${statsPeriod === period ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {showStats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                            <span className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-wide">Gross Revenue</span>
                            <h3 className="text-2xl font-semibold text-emerald-500 font-sans tracking-tight">Rs. {stats.totalSales.toLocaleString()}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-teal-500/30 transition-all">
                            <span className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-wide">Average Sale</span>
                            <h3 className="text-2xl font-semibold text-teal-400 font-sans tracking-tight">Rs. {Math.round(stats.avgSale).toLocaleString()}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all">
                            <span className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-wide">Sales Count</span>
                            <h3 className="text-2xl font-semibold text-blue-400 font-sans tracking-tight">{stats.count}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all border-l-4 border-l-amber-500/20">
                            <span className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-wide">Growth</span>
                            <h3 className="text-2xl font-semibold text-amber-500 font-sans tracking-tight">{(stats.count > 0 ? '+12.5%' : '0%')}</h3>
                        </div>
                    </div>
                )}
            </div>

            {/* List Control Area */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg gap-4">
                <div className="relative flex-1 w-full max-w-xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by patient, invoice, service or product..."
                        className="w-full bg-primary-bg pl-10 pr-4 py-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500 transition-all placeholder:text-gray-600 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="date-desc" className="bg-gray-900">Latest First</option>
                            <option value="date-asc" className="bg-gray-900">Oldest First</option>
                            <option value="amount-desc" className="bg-gray-900">Highest Amount</option>
                            <option value="amount-asc" className="bg-gray-900">Lowest Amount</option>
                        </select>
                    </div>
                    <button onClick={loadSales} className="bg-teal-600/20 text-teal-400 px-4 py-3 rounded-xl hover:bg-teal-600/30 transition-all font-bold text-sm">
                        Refresh
                    </button>
                </div>
            </div>

            {/* Sales Table */}
            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{sales.length}</span>
            </div>

            <div className="bg-secondary-bg border border-gray-800 rounded-2xl flex-1 overflow-hidden flex flex-col shadow-2xl">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-0 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                            <tr>
                                <th className="table-header-cell">Invoice</th>
                                <th className="table-header-cell">Customer</th>
                                <th className="table-header-cell">Items</th>
                                <th className="table-header-cell">Date</th>
                                <th className="table-header-cell text-right">Total Amount</th>
                                <th className="table-header-cell text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {loading ? (
                                <tr><td colSpan="6" className="p-20 text-center"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div><p className="text-gray-500">Loading sales records...</p></td></tr>
                            ) : sales.length === 0 ? (
                                <tr><td colSpan="6" className="p-20 text-center text-gray-500 italic">No transactions found matching your criteria.</td></tr>
                            ) : (
                                sales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-gray-800/20 transition-colors group">
                                        <td className="table-data-cell">
                                            <span className="text-white text-sm">#{sale.invoice_number}</span>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold ring-1 ring-indigo-500/20">
                                                    {(sale.patient_name || 'W')[0].toUpperCase()}
                                                </div>
                                                <span className="text-white text-sm">{sale.patient_name || 'Walking Customer'}</span>
                                            </div>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex flex-col gap-1 max-w-sm">
                                                {sale.services_list && (
                                                    <div className="flex items-start gap-2">
                                                        <Activity size={12} className="text-blue-400 mt-1 shrink-0" />
                                                        <span className="text-xs text-gray-300 line-clamp-2">{sale.services_list}</span>
                                                    </div>
                                                )}
                                                {sale.products_list && (
                                                    <div className="flex items-start gap-2">
                                                        <Package size={12} className="text-emerald-400 mt-1 shrink-0" />
                                                        <span className="text-xs text-gray-400 line-clamp-2 italic">{sale.products_list}</span>
                                                    </div>
                                                )}
                                                {!sale.services_list && !sale.products_list && <span className="text-xs text-gray-600 italic">No items listed</span>}
                                            </div>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-100">{format(new Date(sale.date), 'dd MMM yy')}</span>
                                                <span className="text-[10px] text-gray-500 uppercase tracking-tighter">Recorded</span>
                                            </div>
                                        </td>
                                        <td className="table-data-cell text-right">
                                            <span className="text-lg text-white font-sans">Rs. {sale.total.toLocaleString()}</span>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex items-center justify-center gap-2">
                                                {deleteConfirm === sale.id ? (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                        <button
                                                            onClick={() => handleDelete(sale.id)}
                                                            className="p-1.5 text-emerald-400 hover:bg-emerald-400/20 rounded-lg transition-all"
                                                            title="Confirm Delete"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="p-1.5 text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all"
                                                            title="Cancel"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                console.log('View button clicked for sale:', sale);
                                                                setViewingSale(sale);
                                                                const success = await loadSaleDetails(sale.id);
                                                                console.log('Load sale details result:', success);
                                                                if (success) {
                                                                    console.log('About to open modal');
                                                                    // Add a small delay to ensure state is updated
                                                                    setTimeout(() => {
                                                                        setIsViewModalOpen(true);
                                                                    }, 100);
                                                                }
                                                            }}
                                                            className="p-2.5 text-white hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                                                            title="View Sale Details"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(sale.id)}
                                                            className="p-2.5 text-red-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"
                                                            title="Delete Record"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Pagination Placeholder */}
                <div className="p-4 bg-[#121826] border-t border-gray-800 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Showing {sales.length} records</p>
                    <div className="flex gap-2">
                        <button className="p-2 text-gray-600 hover:text-white disabled:opacity-30"><ChevronLeft size={20} /></button>
                        <button className="p-2 text-gray-600 hover:text-white disabled:opacity-30"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>


            {/* View Sale Details Modal */}
            {isViewModalOpen && saleDetails && (
                <div
                    onClick={(e) => { if (e.target === e.currentTarget) setIsViewModalOpen(false); }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                >
                    <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
                        {/* Header */}
                        <div className="bg-[#1e293b] p-6 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-sky-400">Sale Details</h2>
                            <button
                                onClick={() => setIsViewModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {/* Basic Info */}
                            <div className="space-y-2 pb-4 border-b border-gray-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Invoice:</span>
                                    <span className="text-white font-medium">#{viewingSale?.invoice_number}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Customer:</span>
                                    <span className="text-white font-bold">{saleDetails.invoice?.patient_name || 'Guest'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Contact:</span>
                                    <span className="text-white font-mono text-sm">{saleDetails.invoice?.patient_contact || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Date/Time:</span>
                                    <span className="text-white font-medium">{format(new Date(saleDetails.invoice?.date), 'dd-MM-yy hh:mm a')}</span>
                                </div>
                            </div>

                            {/* Doctor Consultation */}
                            {saleDetails.invoice?.doctor_name && (
                                <div className="pb-4 border-b border-gray-700">
                                    <h3 className="text-sky-400 font-black uppercase text-sm mb-3">Doctor Consultation</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-300 text-sm">{saleDetails.invoice?.doctor_name}</span>
                                            <span className="text-white font-medium">Rs. {saleDetails.invoice?.doctor_fee?.toLocaleString() || '0'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Services */}
                            {saleDetails.services && saleDetails.services.length > 0 && (
                                <div className="pb-4 border-b border-gray-700">
                                    <h3 className="text-sky-400 font-black uppercase text-sm mb-3">Services</h3>
                                    <div className="space-y-2">
                                        {saleDetails.services.map((service, idx) => (
                                            <div key={idx} className="flex justify-between items-center">
                                                <span className="text-gray-300 text-sm">
                                                    {service.name} {service.quantity > 1 && `(x${service.quantity})`}
                                                </span>
                                                <span className="text-white font-medium">Rs. {(service.price * service.quantity).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Products */}
                            {saleDetails.products && saleDetails.products.length > 0 && (
                                <div className="pb-4 border-b border-gray-700">
                                    <h3 className="text-sky-400 font-black uppercase text-sm mb-3">Products</h3>
                                    <div className="space-y-2">
                                        {saleDetails.products.map((product, idx) => (
                                            <div key={idx} className="flex justify-between items-center">
                                                <span className="text-gray-300 text-sm">
                                                    {product.name} {product.quantity > 1 && `(x${product.quantity})`}
                                                </span>
                                                <span className="text-white font-medium">Rs. {(product.price * product.quantity).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No items message */}
                            {(!saleDetails.services || saleDetails.services.length === 0) &&
                                (!saleDetails.products || saleDetails.products.length === 0) &&
                                !saleDetails.invoice?.doctor_name && (
                                    <div className="pb-4 border-b border-gray-700">
                                        <p className="text-gray-500 text-sm italic">No items in this sale</p>
                                    </div>
                                )}

                            {/* Total Amount */}
                            <div className="pt-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-white font-black text-lg">Total Amount</span>
                                    <span className="text-sky-400 font-bold text-2xl">Rs. {saleDetails.invoice?.total?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-[#1e293b] border-t border-gray-700">
                            <button
                                onClick={() => setIsViewModalOpen(false)}
                                className="w-full py-3 bg-sky-500 text-white font-black rounded-lg hover:bg-sky-400 transition-all uppercase tracking-wider"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <PasswordModal
                isOpen={secureAction.isOpen}
                onClose={() => setSecureAction({ ...secureAction, isOpen: false })}
                onVerified={secureAction.onVerified}
                actionName={secureAction.actionName}
            />
        </div>
    );
};

export default Sales;

