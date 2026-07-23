import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Printer, Plus, DollarSign, User, Activity, ShoppingBag, Trash2, Search, Filter, Check, X, Stethoscope, Eye, EyeOff, CreditCard, Banknote } from 'lucide-react';
import db from '../../database/db';
import { format } from 'date-fns';
import PasswordModal from '../common/PasswordModal';

const Billing = () => {
    const location = useLocation();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('date-desc');
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [showStats, setShowStats] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [mixedCash, setMixedCash] = useState(0);
    const [mixedOnline, setMixedOnline] = useState(0);
    const [customDateRange, setCustomDateRange] = useState({
        start: format(new Date(), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [billingStats, setBillingStats] = useState({ revenue: 0, paidCount: 0, discounts: 0, subtotal: 0 });
    const [previewData, setPreviewData] = useState(null);
    const [previewType, setPreviewType] = useState('details'); // 'details' or 'thermal'
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const [patients, setPatients] = useState([]);
    const [services, setServices] = useState([]);
    const [products, setProducts] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [doctorSearch, setDoctorSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [isNewPatient, setIsNewPatient] = useState(false);
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientPhone, setNewPatientPhone] = useState('');
    const [newPatientAddress, setNewPatientAddress] = useState('');
    const [patientDropdownSearch, setPatientDropdownSearch] = useState('');
    const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
    const [isWalkingCustomer, setIsWalkingCustomer] = useState(false);
    const patientSearchRef = useRef(null);

    const loadData = async () => {
        try {
            let query = `
                SELECT i.*, p.name as patient_name, i.address as invoice_address 
                FROM invoices i 
                LEFT JOIN patients p ON i.patient_id = p.id 
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += " AND (i.invoice_number LIKE ? OR p.name LIKE ? OR i.address LIKE ? OR (i.patient_id IS NULL AND 'Walking Customer' LIKE ?))";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            if (statsPeriod === 'Daily') {
                query += " AND date(i.date) = date('now', 'localtime')";
            } else if (statsPeriod === 'Weekly') {
                query += " AND date(i.date) >= date('now', 'localtime', '-7 days')";
            } else if (statsPeriod === 'Monthly') {
                query += " AND date(i.date) >= date('now', 'localtime', 'start of month')";
            } else if (statsPeriod === 'Annual') {
                query += " AND date(i.date) >= date('now', 'localtime', 'start of year')";
            } else if (statsPeriod === 'Custom' && customDateRange.start && customDateRange.end) {
                query += ` AND date(i.date) >= '${customDateRange.start}' AND date(i.date) <= '${customDateRange.end}'`;
            }

            if (paymentFilter !== 'all') {
                query += " AND i.payment_method = ?";
                params.push(paymentFilter);
            }

            if (sortBy === 'date-desc') {
                query += " ORDER BY i.date DESC, i.id DESC";
            } else if (sortBy === 'date-asc') {
                query += " ORDER BY i.date ASC, i.id ASC";
            } else if (sortBy === 'total-desc') {
                query += " ORDER BY i.total DESC";
            } else if (sortBy === 'total-asc') {
                query += " ORDER BY i.total ASC";
            }

            const invs = await db.all(query, params);
            setInvoices(invs || []);

            const pats = await db.all(`
                SELECT p.id, p.name, p.phone, p.address,
                       COUNT(DISTINCT i.id) as visit_count
                FROM patients p
                LEFT JOIN invoices i ON p.id = i.patient_id
                GROUP BY p.id, p.name, p.phone, p.address
                ORDER BY visit_count DESC, p.name ASC
            `);
            setPatients(pats || []);

            const servs = await db.all("SELECT * FROM services ORDER BY name");
            setServices(servs || []);

            const prods = await db.all("SELECT * FROM products ORDER BY name");
            setProducts(prods || []);

            const docs = await db.all("SELECT * FROM doctors WHERE status='active' ORDER BY name");
            setDoctors(docs || []);

            setLoading(false);
        } catch (err) { console.error(err); setLoading(false); }
    };

    const loadBillingStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date(date) = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date(date) >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date(date) >= date('now', 'localtime', 'start of year')";
            else if (statsPeriod === 'Custom' && customDateRange.start && customDateRange.end) {
                dateFilter = `date(date) >= '${customDateRange.start}' AND date(date) <= '${customDateRange.end}'`;
            }

            const revRes = await db.get(`SELECT SUM(total) as total FROM invoices WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}`);
            const paidRes = await db.get(`SELECT COUNT(*) as count FROM invoices WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}`);
            const discRes = await db.get(`SELECT SUM(discount + item_discount) as total FROM invoices WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}`);

            const totalRev = revRes?.total || 0;
            const totalDisc = discRes?.total || 0;

            setBillingStats({
                revenue: totalRev,
                paidCount: paidRes?.count || 0,
                discounts: totalDisc,
                subtotal: totalRev + totalDisc
            });
        } catch (err) { console.error(err); }
    };

    useEffect(() => { loadData(); }, [search, sortBy, statsPeriod, customDateRange, paymentFilter]);
    useEffect(() => { loadBillingStats(); }, [statsPeriod, customDateRange]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadData();
            loadBillingStats();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, sortBy, statsPeriod, customDateRange, paymentFilter]);

    // Runtime migration to ensure discount column exists
    useEffect(() => {
        const ensureDiscountColumn = async () => {
            try {
                const cols = await db.all("PRAGMA table_info(invoices)");
                if (cols && !cols.some(c => c.name === 'discount')) {
                    await db.run("ALTER TABLE invoices ADD COLUMN discount REAL DEFAULT 0");
                }
                if (cols && !cols.some(c => c.name === 'payment_method')) {
                    await db.run("ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'Cash'");
                }
                if (cols && !cols.some(c => c.name === 'cash_amount')) {
                    await db.run("ALTER TABLE invoices ADD COLUMN cash_amount REAL DEFAULT 0");
                }
                if (cols && !cols.some(c => c.name === 'online_amount')) {
                    await db.run("ALTER TABLE invoices ADD COLUMN online_amount REAL DEFAULT 0");
                }
                if (cols && !cols.some(c => c.name === 'address')) {
                    await db.run("ALTER TABLE invoices ADD COLUMN address TEXT");
                }
                if (cols && !cols.some(c => c.name === 'item_discount')) {
                    await db.run("ALTER TABLE invoices ADD COLUMN item_discount REAL DEFAULT 0");
                }

                // Item-wise discount migrations
                const servCols = await db.all("PRAGMA table_info(invoice_services)");
                if (servCols && !servCols.some(c => c.name === 'discount')) {
                    await db.run("ALTER TABLE invoice_services ADD COLUMN discount REAL DEFAULT 0");
                }
                const prodCols = await db.all("PRAGMA table_info(invoice_products)");
                if (prodCols && !prodCols.some(c => c.name === 'discount')) {
                    await db.run("ALTER TABLE invoice_products ADD COLUMN discount REAL DEFAULT 0");
                }
                const docCols = await db.all("PRAGMA table_info(invoice_doctors)");
                if (docCols && !docCols.some(c => c.name === 'discount')) {
                    await db.run("ALTER TABLE invoice_doctors ADD COLUMN discount REAL DEFAULT 0");
                }
            } catch (e) {
                console.error("Schema check failed:", e);
            }
        };
        ensureDiscountColumn();
    }, []);

    useEffect(() => {
        if (location.state?.openNewInvoice) {
            resetBillingForm();
            setIsModalOpen(true);
            // Clear the state so it doesn't reopen if we navigate away and back without the intent
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        const grossTotal = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
        const itemDiscountTotal = selectedItems.reduce((acc, curr) => acc + (curr.discount || 0), 0);
        const t = grossTotal - itemDiscountTotal;
        setTotal(t);
        // Reset mixed amounts when total changes
        setMixedCash(t);
        setMixedOnline(0);
    }, [selectedItems]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (patientSearchRef.current && !patientSearchRef.current.contains(event.target)) {
                setIsPatientDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [patientSearchRef]);

    const resetBillingForm = () => {
        setSelectedItems([]);
        setTotal(0);
        setSelectedPatient('');
        setIsNewPatient(false);
        setNewPatientName('');
        setNewPatientPhone('');
        setNewPatientAddress('');
        setPatientDropdownSearch('');
        setIsPatientDropdownOpen(false);
        setDoctorSearch('');
        setServiceSearch('');
        setProductSearch('');
        setProductSearch('');
        setIsWalkingCustomer(false);
        setPaymentMethod('Cash');
        loadData();
    };

    const addItemToInvoice = (item, type) => {
        const existing = selectedItems.find(s => s.id === item.id && s.type === type);
        if (existing) {
            if (type === 'doctor') return;
            setSelectedItems(selectedItems.map(s =>
                (s.id === item.id && s.type === type) ? { ...s, quantity: s.quantity + 1 } : s
            ));
        } else {
            let price = 0;
            if (type === 'service') price = item.cost;
            else if (type === 'product') price = item.price;
            else if (type === 'doctor') price = item.visit_fee;

            setSelectedItems([...selectedItems, {
                id: item.id,
                name: item.name,
                type: type,
                price: price,
                quantity: 1,
                discount: 0
            }]);
        }
    };

    const handleItemContextMenu = (e, item, type) => {
        e.preventDefault();
        const existing = selectedItems.find(s => s.id === item.id && s.type === type);
        if (existing) {
            if (existing.quantity > 1) {
                setSelectedItems(selectedItems.map(s =>
                    (s.id === item.id && s.type === type) ? { ...s, quantity: s.quantity - 1 } : s
                ));
            } else {
                setSelectedItems(selectedItems.filter(s => !(s.id === item.id && s.type === type)));
            }
        }
    };

    const removeItem = (id, type) => {
        setSelectedItems(selectedItems.filter(s => !(s.id === id && s.type === type)));
    };

    const updateItemDiscount = (id, type, val) => {
        setSelectedItems(selectedItems.map(item =>
            (item.id === id && item.type === type)
                ? { ...item, discount: Math.min(Number(val), (item.price * item.quantity)) }
                : item
        ));
    };

    const handlePrintExisting = async (inv) => {
        try {
            const data = await getInvoiceData(inv);
            setPreviewType('thermal');
            setPreviewData(data);
        } catch (err) { console.error(err); }
    };

    const handleViewInvoice = async (inv) => {
        try {
            const data = await getInvoiceData(inv);
            setPreviewType('details');
            setPreviewData(data);
        } catch (err) { console.error(err); }
    };

    const getInvoiceData = async (inv) => {
        const servs = await db.all("SELECT s.name, iserv.quantity, iserv.price, iserv.discount FROM invoice_services iserv JOIN services s ON iserv.service_id = s.id WHERE iserv.invoice_id = ?", [inv.id]);
        const prods = await db.all("SELECT p.name, iprod.quantity, iprod.price, iprod.discount FROM invoice_products iprod JOIN products p ON iprod.product_id = p.id WHERE iprod.invoice_id = ?", [inv.id]);
        const docs = await db.all("SELECT d.name, idoc.price, idoc.discount FROM invoice_doctors idoc JOIN doctors d ON idoc.doctor_id = d.id WHERE idoc.invoice_id = ?", [inv.id]);

        const items = [
            ...(servs || []).map(s => ({ ...s, type: 'service', discount: s.discount || 0 })),
            ...(prods || []).map(p => ({ ...p, type: 'product', discount: p.discount || 0 })),
            ...(docs || []).map(d => ({ ...d, type: 'doctor', quantity: 1, discount: d.discount || 0 }))
        ];

        const dateStr = format(new Date(inv.date), 'dd-MM-yy hh:mm a');
        return {
            invoiceNum: inv.invoice_number,
            patientName: inv.patient_name || 'Walking Customer',
            address: inv.invoice_address || inv.address || '',
            items: items,
            totalAmt: inv.total,
            discount: inv.discount || 0,
            dateStr: dateStr,
            paymentMethod: inv.payment_method || 'Cash',
            mixedCash: inv.cash_amount || 0,
            mixedOnline: inv.online_amount || 0
        };
    };

    const printReceipt = (invoiceNum, patientName, items, totalAmt, discount = 0, existingDate = null, paymentMethod = 'Cash', onComplete = null, cashAmt = 0, onlineAmt = 0, address = '') => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '80mm';
        document.body.appendChild(iframe);

        const dateStr = existingDate || format(new Date(), 'dd-MM-yy hh:mm a');
        const timestamp = Date.now();

        iframe.contentDocument.write(`
            <html>
                <head>
                    <title>Invoice ${invoiceNum}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { 
                            font-family: 'Manrope', sans-serif; 
                            width: 72mm; 
                            padding: 4mm; 
                            margin: 0;
                            color: #000;
                            background: #fff;
                            -webkit-print-color-adjust: exact;
                        }
                        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 2mm; margin-bottom: 2mm; }
                        .clinic-name { font-size: 20pt; font-weight: 800; margin-bottom: 0.2mm; letter-spacing: -1px; }
                        .receipt-info { font-size: 13pt; margin-bottom: 2mm; line-height: 1.3; color: #000; }
                        .items-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 2mm; border: 1px solid #000; }
                        .items-table th, .items-table td { border: 1px solid #000; padding: 1mm; vertical-align: top; color: #000; }
                        .items-table th { text-align: left; font-weight: 800; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #eee; }
                        .items-table .price-col { font-family: 'Montserrat', sans-serif; font-weight: 600; }
                        .total-section { border-top: 2px solid #000; margin-top: 1mm; padding-top: 1mm; text-align: right; color: #000; }
                        .grand-total { font-size: 14pt; font-weight: 700; font-family: 'Montserrat', sans-serif; color: #000; }
                        .footer { margin-top: 3mm; text-align: center; font-size: 10pt; border-top: 1px dashed #000; padding-top: 2mm; line-height: 1.4; color: #000; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img 
                            src="asset://receiptlogo.jpeg?t=${timestamp}" 
                            style="height: 35mm; margin-bottom: 2mm; object-fit: contain;" 
                            onerror="
                                if (this.src.includes('receiptlogo.jpeg')) { this.src = 'asset://receiptlogo.png?t=${timestamp}'; }
                                else if (this.src.includes('receiptlogo.png')) { this.src = 'asset://receiptlogo.jpg?t=${timestamp}'; }
                                else if (this.src.includes('receiptlogo.jpg')) { this.src = 'resources/logo.jpeg'; }
                                else if (this.src.includes('resources/logo.jpeg')) { this.src = 'asset://logo.jpeg?t=${timestamp}'; }
                                else if (this.src.includes('asset://logo.jpeg')) { this.src = 'asset://logo.png?t=${timestamp}'; }
                                else if (this.src.includes('asset://logo.png')) { this.src = 'asset://logo.jpg?t=${timestamp}'; }
                                else { this.style.display = 'none'; }
                            " 
                        />
                        <div class="clinic-name">Aesthetic Aura</div>
                        <div style="font-size: 11pt; font-weight: 700; color: #000; font-family: 'Montserrat', sans-serif; text-transform: uppercase;">by Dr. Maryum Qazi</div>
                        <div style="font-size: 9pt; font-weight: 700; color: #000; font-family: 'Montserrat', sans-serif; margin-top: 1mm; text-transform: uppercase; letter-spacing: 1px;">ADVANCE SKIN & LASER CLINIC</div>
                    </div>
                    <div class="receipt-info">
                        <div style="display: flex; justify-content: space-between;">
                            <span><strong>Invoice No.</strong> #${invoiceNum}</span>
                            <span><strong>Date:</strong> ${dateStr}</span>
                        </div>
                        <div style="margin-top: 0.5mm;"><strong>Patient:</strong> ${patientName}</div>
                        ${address ? `<div style="margin-top: 0.5mm;"><strong>Address:</strong> ${address}</div>` : ''}
                    </div>
                    <div style="text-align: center; font-weight: 700; margin-bottom: 2mm; tracking-spacing: 0.3em; uppercase; font-size: 9pt; color: #000; font-family: 'Montserrat', sans-serif;">--- ITEMS ---</div>
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
                                    <td style="font-weight: 600; font-size: 9pt; line-height: 1.1;">${item.name}</td>
                                    <td style="text-align: right; font-weight: 600;">${(item.price || 0).toLocaleString()}</td>
                                    <td style="text-align: center; font-weight: 500;">${item.quantity}</td>
                                    <td style="text-align: right;" class="price-col">${(item.discount || 0).toLocaleString()}</td>
                                    <td style="text-align: right;" class="price-col">${((item.price * item.quantity) - (item.discount || 0)).toLocaleString()}</td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                    <div class="total-section">
                        <div style="font-size: 11pt; margin-bottom: 0.5mm; font-weight: 500;">Subtotal: <span style="font-family: Montserrat;">Rs. ${items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0).toLocaleString()}</span></div>
                        <div style="font-size: 11pt; margin-bottom: 1mm; font-weight: 500; color: #000;">Discounts: <span style="font-family: Montserrat;">- Rs. ${(items.reduce((acc, curr) => acc + (curr.discount || 0), 0) + (discount || 0)).toLocaleString()}</span></div>
                        <div class="grand-total">Total: Rs. ${totalAmt.toLocaleString()}</div>
                        <div style="font-size: 10pt; margin-top: 2mm; font-weight: 700; color: #000; font-family: 'Montserrat', sans-serif;">PAYMENT METHOD: <span style="color: #000; font-weight: 700;">${paymentMethod.toUpperCase()}</span></div>
                        ${paymentMethod === 'Mixed' ? `
                            <div style="font-size: 9pt; margin-top: 1mm; font-weight: 600; color: #000; border-top: 1px dotted #000; padding-top: 1mm;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span>CASH:</span>
                                    <span>Rs. ${cashAmt.toLocaleString()}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span>ONLINE:</span>
                                    <span>Rs. ${onlineAmt.toLocaleString()}</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="footer">
                        <div style="font-family: 'Montserrat', sans-serif; font-weight: 700; margin-bottom: 1mm;">
                            Contact: 0300-0140566<br>
                            City Center Plaza, New City Phase 2, Wah
                        </div>
                        <strong>Thank you for your visit!</strong><br>
                        Software by PrimeSoft - 0309-5369472
                    </div>
                </body >
            </html >
    `);
        iframe.contentDocument.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.onafterprint = () => {
            if (onComplete) onComplete();
            setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 500);
        };

        setTimeout(() => {
            iframe.contentWindow.print();
        }, 500);
    };

    const handleDeleteInvoice = async (inv) => {
        requestSecureAction(async () => {
            try {
                // Get products to revert stock
                const invProds = await db.all("SELECT product_id, quantity FROM invoice_products WHERE invoice_id = ?", [inv.id]);
                for (const p of invProds) {
                    await db.run("UPDATE products SET stock = stock + ? WHERE id = ?", [p.quantity, p.product_id]);
                }

                // Delete associations
                await db.run("DELETE FROM invoice_services WHERE invoice_id = ?", [inv.id]);
                await db.run("DELETE FROM invoice_products WHERE invoice_id = ?", [inv.id]);
                await db.run("DELETE FROM invoice_doctors WHERE invoice_id = ?", [inv.id]);

                // Delete invoice
                await db.run("DELETE FROM invoices WHERE id = ?", [inv.id]);

                setDeleteConfirm(null);
                loadData();
                loadBillingStats();
            } catch (err) {
                console.error(err);
                setDeleteConfirm(null);
            }
        }, 'Delete Bill');
    };

    const createInvoice = async () => {
        if ((isNewPatient ? !newPatientName : (isWalkingCustomer ? false : !selectedPatient)) || selectedItems.length === 0) return;

        const dateObj = new Date();
        const date = format(dateObj, 'yyyy-MM-dd HH:mm:ss');

        try {
            // Generate Invoice Number
            const yy = format(dateObj, 'yy');
            const mm = format(dateObj, 'MM');
            const prefix = `${yy}${mm} `;
            let sequence = 1;
            const lastInv = await db.get("SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}% `]);
            if (lastInv && lastInv.invoice_number) {
                const lastSeq = parseInt(lastInv.invoice_number.slice(4));
                if (!isNaN(lastSeq)) sequence = lastSeq + 1;
            }
            const invoiceNum = `${prefix}${sequence.toString().padStart(4, '0')} `;
            let patientId = selectedPatient;
            let patientName = '';

            if (isNewPatient) {
                // Create new patient
                await db.run(
                    "INSERT INTO patients (name, phone, address, gender, created_at) VALUES (?, ?, ?, ?, ?)",
                    [newPatientName, newPatientPhone, newPatientAddress, 'Male', new Date().toISOString()]
                );
                const newPatRow = await db.get("SELECT last_insert_rowid() as id");
                patientId = newPatRow.id;
                patientName = newPatientName;
            } else if (isWalkingCustomer) {
                patientId = null;
                patientName = 'Walking Customer';
            } else {
                const patientObj = patients.find(p => p.id == selectedPatient);
                patientName = patientObj ? patientObj.name : 'Walking Customer';
            }

            const invoiceAddress = isNewPatient ? newPatientAddress : (isWalkingCustomer ? newPatientAddress : (patients.find(p => p.id == selectedPatient)?.address || ''));
            const itemDiscountTotal = selectedItems.reduce((acc, curr) => acc + (curr.discount || 0), 0);

            await db.run(
                "INSERT INTO invoices (invoice_number, patient_id, date, total, discount, item_discount, status, payment_method, cash_amount, online_amount, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    invoiceNum,
                    patientId,
                    date,
                    total,
                    0,
                    itemDiscountTotal,
                    'paid',
                    paymentMethod,
                    paymentMethod === 'Cash' ? total : (paymentMethod === 'Online' ? 0 : mixedCash),
                    paymentMethod === 'Online' ? total : (paymentMethod === 'Cash' ? 0 : mixedOnline),
                    invoiceAddress
                ]
            );

            const lastIdRow = await db.get("SELECT last_insert_rowid() as id");
            const invoiceId = lastIdRow.id;

            for (const item of selectedItems) {
                if (item.type === 'service') {
                    await db.run("INSERT INTO invoice_services (invoice_id, service_id, quantity, price, discount) VALUES (?, ?, ?, ?, ?)", [invoiceId, item.id, item.quantity, item.price, item.discount || 0]);
                } else if (item.type === 'product') {
                    await db.run("INSERT INTO invoice_products (invoice_id, product_id, quantity, price, discount) VALUES (?, ?, ?, ?, ?)", [invoiceId, item.id, item.quantity, item.price, item.discount || 0]);
                    await db.run("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, item.id]);
                } else if (item.type === 'doctor') {
                    await db.run("INSERT INTO invoice_doctors (invoice_id, doctor_id, price, discount) VALUES (?, ?, ?, ?)", [invoiceId, item.id, item.price, item.discount || 0]);
                }
            }

            const data = {
                invoiceNum,
                patientName,
                address: invoiceAddress,
                items: selectedItems,

                totalAmt: total,
                discount: 0,
                dateStr: format(new Date(), 'dd-MM-yy hh:mm a'),
                paymentMethod: paymentMethod,
                mixedCash: paymentMethod === 'Cash' ? total : (paymentMethod === 'Online' ? 0 : mixedCash),
                mixedOnline: paymentMethod === 'Online' ? total : (paymentMethod === 'Cash' ? 0 : mixedOnline)
            };

            setPreviewData(data);
            printReceipt(data.invoiceNum, data.patientName, data.items, data.totalAmt, data.discount, data.dateStr, data.paymentMethod, () => {
                setPreviewData(null);
            }, data.mixedCash, data.mixedOnline, data.address);

            setIsModalOpen(false);
            setSelectedItems([]);
            setDiscount(0);
            setSelectedPatient('');
            setIsNewPatient(false);
            setIsWalkingCustomer(false);
            setNewPatientName('');
            setNewPatientPhone('');
            setPatientDropdownSearch('');
            setIsPatientDropdownOpen(false);
            loadData();
            loadBillingStats();
        } catch (err) { console.error(err); }
    };

    const ReceiptPreviewModal = ({ data, onClose, onPrint }) => {
        if (!data) return null;

        return (
            <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="bg-white text-black w-full max-w-[400px] shadow-2xl rounded-sm flex flex-col max-h-[90vh]">
                    {/* Thermal Receipt Content */}
                    <div className="flex-1 overflow-y-auto p-6 font-manrope text-[14px] leading-tight select-none">
                        <div className="text-center space-y-0.5 mb-3">
                            <img
                                src={`asset://receiptlogo.jpeg?t=${Date.now()}`}
                                className="h-32 mx-auto mb-2 object-contain"
                                onError={(e) => {
                                    const currentSrc = e.target.src;
                                    if (currentSrc.includes('receiptlogo.jpeg')) {
                                        e.target.src = `asset://receiptlogo.png?t=${Date.now()}`;
                                    } else if (currentSrc.includes('receiptlogo.png')) {
                                        e.target.src = `asset://receiptlogo.jpg?t=${Date.now()}`;
                                    } else if (currentSrc.includes('receiptlogo.jpg')) {
                                        e.target.src = "resources/logo.jpeg";
                                    } else if (currentSrc.includes('resources/logo.jpeg')) {
                                        e.target.src = `asset://logo.jpeg?t=${Date.now()}`;
                                    } else if (currentSrc.includes('asset://logo.jpeg')) {
                                        e.target.src = `asset://logo.png?t=${Date.now()}`;
                                    } else if (currentSrc.includes('asset://logo.png')) {
                                        e.target.src = `asset://logo.jpg?t=${Date.now()}`;
                                    } else {
                                        e.target.style.display = 'none';
                                    }
                                }}
                            />
                            <h1 className="text-3xl font-extrabold capitalize tracking-tighter text-black">Aesthetic Aura</h1>
                            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-black mb-0.5 font-montserrat">by Dr. Maryum Qazi</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black mb-1 font-montserrat">ADVANCE SKIN & LASER CLINIC</p>
                        </div>

                        <div className="space-y-2 mb-4 text-[16px] border-y border-black py-4 text-black">
                            <div className="flex justify-between">
                                <span className="uppercase font-bold text-[13px]">Invoice No.</span>
                                <span className="font-bold">#{data.invoiceNum}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="uppercase font-bold text-[13px]">Date</span>
                                <span className="font-medium">{data.dateStr}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="uppercase font-bold text-[13px]">Patient</span>
                                <span className="font-bold uppercase">{data.patientName}</span>
                            </div>
                            {data.address && (
                                <div className="flex justify-between">
                                    <span className="uppercase font-bold text-[13px]">Address</span>
                                    <span className="font-medium text-right text-[12px]">{data.address}</span>
                                </div>
                            )}
                        </div>

                        <div className="mb-3">
                            <p className="text-center font-bold mb-1.5 tracking-[0.3em] uppercase text-[10px] text-black font-montserrat">--- Items ---</p>
                            <table className="w-full text-left border-collapse border border-black">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="p-1 px-1 border border-black font-bold uppercase text-[10px] text-black w-[35%]">Item</th>
                                        <th className="p-1 px-1 border border-black text-right font-bold uppercase text-[10px] text-black w-[15%]">Price</th>
                                        <th className="p-1 px-1 border border-black text-center font-bold uppercase text-[10px] text-black w-[10%]">Qty</th>
                                        <th className="p-1 px-1 border border-black text-right font-bold uppercase text-[10px] text-black w-[20%]">Disc.</th>
                                        <th className="p-1 px-1 border border-black text-right font-bold uppercase text-[10px] text-black w-[20%]">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="">
                                    {data.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-1 px-1 border border-black font-semibold text-[11px] text-black leading-tight">{item.name}</td>
                                            <td className="p-1 px-1 border border-black text-right font-semibold text-[11px] text-black">
                                                {(item.price || 0).toLocaleString()}
                                            </td>
                                            <td className="p-1 px-1 border border-black text-center font-medium text-black text-[11px]">{item.quantity}</td>
                                            <td className="p-1 px-1 border border-black text-right font-price font-bold text-[11px] text-black">{(item.discount || 0).toLocaleString()}</td>
                                            <td className="p-1 px-1 border border-black text-right font-price font-bold text-[11px] text-black">{((item.price * item.quantity) - (item.discount || 0)).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-gray-100 p-3 rounded-lg space-y-1">
                            <div className="flex justify-between text-[13px] font-bold text-black">
                                <span>Subtotal</span>
                                <span className="font-price">Rs.{data.items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[13px] font-bold text-black border-t border-black/10 pt-1">
                                <span>Discounts</span>
                                <span className="font-price">- Rs.{(data.items.reduce((acc, curr) => acc + (curr.discount || 0), 0) + (data.discount || 0)).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[18px] font-bold mt-2 pt-2 border-t border-black text-black">
                                <span className="tracking-tight">TOTAL</span>
                                <span className="font-price font-bold">Rs.{data.totalAmt.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[14px] font-bold mt-1 uppercase tracking-widest pt-1 border-t border-black/20 text-black">
                                <span className="">Payment Method</span>
                                <span className="font-price font-bold">{data.paymentMethod || 'Cash'}</span>
                            </div>
                            {data.paymentMethod === 'Mixed' && (
                                <div className="text-[12px] font-bold mt-1 text-black pl-2 border-l-2 border-black/10">
                                    <div className="flex justify-between italic">
                                        <span>Cash:</span>
                                        <span>Rs. {data.mixedCash?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between italic">
                                        <span>Online:</span>
                                        <span>Rs. {data.mixedOnline?.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 text-center space-y-1 text-[11px] text-black border-t border-black/10 pt-4">
                            <div className="font-montserrat font-bold text-[12px] mb-2">
                                <p>Contact: 0300-0140566</p>
                                <p>City Center Plaza, New City Phase 2, Wah</p>
                            </div>
                            <p className="font-bold uppercase tracking-widest text-[11px]">Thank You For Your Visit!</p>
                            <p className="font-bold">Software by PrimeSoft - 0309-5369472</p>
                        </div>
                    </div >

                    {/* Footer Actions */}
                    < div className="p-4 bg-gray-50 border-t flex gap-2" >
                        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded hover:bg-gray-300 transition-all uppercase text-xs">Close</button>
                        <button
                            onClick={() => {
                                onPrint(data.invoiceNum, data.patientName, data.items, data.totalAmt, data.discount, data.dateStr, data.paymentMethod, null, data.mixedCash, data.mixedOnline);
                                onClose();
                            }}
                            className="flex-[2] py-3 bg-black text-white font-bold rounded hover:bg-gray-800 transition-all uppercase text-xs flex items-center justify-center gap-2"
                        >
                            <Printer size={16} /> Print Now
                        </button>
                    </div >
                </div >
            </div >
        );
    };

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Billing</h1>
            {/* Revenue Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Revenue Overview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Revenue Summary");
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
                            {['Daily', 'Weekly', 'Monthly', 'Annual', 'Custom'].map(period => (
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
                    <>
                        {statsPeriod === 'Custom' && (
                            <div className="flex justify-end gap-3 mb-6 bg-[#0f1420] p-3 rounded-xl border border-gray-800 w-fit ml-auto">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm font-bold">From:</span>
                                    <input
                                        type="date"
                                        value={customDateRange.start}
                                        onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                                        className="bg-[#1a2233] text-white border border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm font-bold">To:</span>
                                    <input
                                        type="date"
                                        value={customDateRange.end}
                                        onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                                        className="bg-[#1a2233] text-white border border-gray-700 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-purple-500/30 transition-all border-l-4 border-l-purple-500/20">
                                <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Subtotal before discount</span>
                                <h3 className="text-3xl font-semibold text-purple-400 font-sans tracking-tight">Rs. {billingStats.subtotal.toLocaleString()}</h3>
                            </div>
                            <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all border-l-4 border-l-amber-500/20">
                                <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Discounts</span>
                                <h3 className="text-3xl font-semibold text-amber-400 font-sans tracking-tight">Rs. {billingStats.discounts.toLocaleString()}</h3>
                            </div>
                            <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                                <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Overall Profit</span>
                                <h3 className="text-3xl font-semibold text-emerald-500 font-sans tracking-tight">Rs. {billingStats.revenue.toLocaleString()}</h3>
                            </div>
                            <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all">
                                <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Bills</span>
                                <h3 className="text-3xl font-semibold text-blue-400 font-sans tracking-tight">{billingStats.paidCount}</h3>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg gap-4">

                <div className="flex items-center gap-4 flex-1 w-full lg:max-w-xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search invoice # or patient..."
                            className="w-full bg-primary-bg pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-24 cursor-pointer"
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                        >
                            <option value="all" className="bg-gray-900">All Types</option>
                            <option value="Cash" className="bg-gray-900">Cash</option>
                            <option value="Online" className="bg-gray-900">Online</option>
                            <option value="Mixed" className="bg-gray-900">Mixed</option>
                        </select>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="date-desc" className="bg-gray-900">Latest First</option>
                            <option value="date-asc" className="bg-gray-900">Oldest First</option>
                            <option value="total-desc" className="bg-gray-900">Highest Amount</option>
                            <option value="total-asc" className="bg-gray-900">Lowest Amount</option>
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => { resetBillingForm(); setIsModalOpen(true); }}
                    className="w-full lg:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors font-semibold"
                >
                    <Plus size={18} /> New Bill
                </button>
            </div>

            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{invoices.length}</span>
            </div>

            <div className="bg-secondary-bg border border-gray-800 rounded-2xl flex-1 overflow-hidden flex flex-col shadow-xl min-h-[400px]">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-gray-300 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                            <tr>
                                <th className="table-header-cell">Invoice #</th>
                                <th className="table-header-cell">Patient</th>
                                <th className="table-header-cell">Date</th>
                                <th className="table-header-cell text-center">Type</th>
                                <th className="table-header-cell text-right">Subtotal</th>
                                <th className="table-header-cell text-right">Discount</th>
                                <th className="table-header-cell text-right">Total</th>
                                <th className="table-header-cell text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {invoices.length === 0 ? <tr><td colSpan="7" className="p-10 text-center text-gray-500 italic">No invoices found.</td></tr> :
                                invoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-gray-800/30 transition-colors group">
                                        <td className="table-data-cell text-white text-sm">{inv.invoice_number}</td>
                                        <td className="table-data-cell text-white text-sm">{inv.patient_name || 'Walking Customer'}</td>
                                        <td className="table-data-cell text-white text-sm">{format(new Date(inv.date), 'dd MMM yy, hh:mm a')}</td>
                                        <td className="table-data-cell text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${inv.payment_method === 'Online' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                inv.payment_method === 'Mixed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                                {inv.payment_method || 'Cash'}
                                            </span>
                                        </td>
                                        <td className="table-data-cell text-right text-purple-400/80 text-sm">Rs. {(inv.total + (inv.discount || 0) + (inv.item_discount || 0)).toLocaleString()}</td>
                                        <td className="table-data-cell text-right text-amber-400 text-sm">Rs. {((inv.discount || 0) + (inv.item_discount || 0)).toLocaleString()}</td>
                                        <td className="table-data-cell text-right text-emerald-500 text-sm font-bold">Rs. {inv.total.toLocaleString()}</td>
                                        <td className="table-data-cell text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {deleteConfirm === inv.id ? (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                        <button
                                                            onClick={() => handleDeleteInvoice(inv)}
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
                                                            onClick={() => handlePrintExisting(inv)}
                                                            className="p-2 text-white hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                                                            title="Print Invoice"
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(inv.id)}
                                                            className="p-2 text-red-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"
                                                            title="Delete Invoice"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Invoice Modal */}
            {isModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-[95vw] rounded-2xl border border-gray-700 shadow-2xl flex overflow-hidden h-[90vh]">

                        {/* Left: Selection Panels */}
                        <div className="w-3/4 border-r border-gray-800 flex flex-col bg-gray-900/50 overflow-hidden">
                            <div className="p-6 border-b border-gray-800">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Plus className="text-accent-hover" /> Add Bill</h3>
                            </div>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Services List */}
                                <div className="w-1/3 border-r border-gray-800 p-4 flex flex-col">
                                    <div className="flex justify-between items-center mb-4 text-center">
                                        <h4 className="text-base font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Activity size={18} className="text-blue-400" /> Services
                                        </h4>
                                        <div className="relative w-36">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="Search..."
                                                className="w-full bg-primary-bg pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-700 text-white outline-none focus:border-blue-500"
                                                value={serviceSearch}
                                                onChange={(e) => setServiceSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                        {services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).map(s => {
                                            const count = selectedItems.find(i => i.id === s.id && i.type === 'service')?.quantity || 0;
                                            return (
                                                <div key={s.id} onClick={() => addItemToInvoice(s, 'service')} onContextMenu={(e) => handleItemContextMenu(e, s, 'service')} className="bg-secondary-bg p-2 rounded-xl border border-gray-800 hover:border-blue-500 cursor-pointer transition-all flex flex-col group min-h-[70px] justify-between relative">
                                                    {count > 0 && (
                                                        <span className="absolute top-2 right-2 text-xs font-semibold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                                                            x{count}
                                                        </span>
                                                    )}
                                                    <p className="font-semibold text-gray-200 group-hover:text-white transition-colors text-xl leading-tight pr-6">{s.name}</p>
                                                    <span className="font-semibold text-accent-hover text-lg mt-0.5">Rs. {s.cost}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Products List */}
                                <div className="w-1/3 border-r border-gray-800 p-4 flex flex-col">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-base font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <ShoppingBag size={18} className="text-emerald-400" /> Products
                                        </h4>
                                        <div className="relative w-36">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="Search..."
                                                className="w-full bg-primary-bg pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500"
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                        {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                                            const count = selectedItems.find(i => i.id === p.id && i.type === 'product')?.quantity || 0;
                                            return (
                                                <div key={p.id} onClick={() => addItemToInvoice(p, 'product')} onContextMenu={(e) => handleItemContextMenu(e, p, 'product')} className="bg-secondary-bg p-2 rounded-xl border border-gray-800 hover:border-emerald-500 cursor-pointer transition-all flex flex-col group min-h-[70px] justify-between relative">
                                                    {count > 0 && (
                                                        <span className="absolute top-2 right-2 text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                                                            x{count}
                                                        </span>
                                                    )}
                                                    <p className="font-semibold text-gray-200 group-hover:text-white transition-colors text-xl leading-tight pr-6">{p.name}</p>
                                                    <div className="flex justify-between items-center mt-0.5">
                                                        <p className={`text-[12px] uppercase font-semibold ${p.stock <= 5 ? 'text-red-500' : 'text-emerald-400'}`}>Stock: {p.stock}</p>
                                                        <span className="font-semibold text-accent-hover text-lg">Rs. {p.price}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Doctors List */}
                                <div className="w-1/3 p-4 flex flex-col">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-base font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Stethoscope size={18} className="text-amber-400" /> Doctors
                                        </h4>
                                        <div className="relative w-36">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="Search..."
                                                className="w-full bg-primary-bg pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-700 text-white outline-none focus:border-amber-500"
                                                value={doctorSearch}
                                                onChange={(e) => setDoctorSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-2">
                                        {doctors.filter(d => d.name.toLowerCase().includes(doctorSearch.toLowerCase())).map(d => {
                                            const count = selectedItems.find(i => i.id === d.id && i.type === 'doctor')?.quantity || 0;
                                            return (
                                                <div key={d.id} onClick={() => addItemToInvoice(d, 'doctor')} onContextMenu={(e) => handleItemContextMenu(e, d, 'doctor')} className="bg-secondary-bg p-2 rounded-xl border border-gray-800 hover:border-amber-500 cursor-pointer transition-all flex flex-col group min-h-[70px] justify-between relative">
                                                    {count > 0 && (
                                                        <span className="absolute top-2 right-2 text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                                            x{count}
                                                        </span>
                                                    )}
                                                    <p className="font-semibold text-gray-200 group-hover:text-white transition-colors text-xl leading-tight pr-6">{d.name}</p>
                                                    <div className="flex justify-between items-center mt-0.5">
                                                        <p className="text-[10px] uppercase font-bold text-gray-500">{d.specialization}</p>
                                                        <span className="font-semibold text-accent-hover text-lg">Rs. {d.visit_fee}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Invoice Summary */}
                        <div className="w-1/4 p-6 flex flex-col bg-secondary-bg">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="text-emerald-400" /> Preview</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                            </div>

                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-lg font-semibold text-gray-200">Patient</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setIsWalkingCustomer(!isWalkingCustomer);
                                                setIsNewPatient(false);
                                                setSelectedPatient('');
                                            }}
                                            className={`text-sm px-4 py-1.5 rounded-xl transition-all font-semibold border ${isWalkingCustomer ? 'bg-amber-600 text-white border-amber-500' : 'bg-amber-600/10 text-amber-500 border-amber-500/20 hover:bg-amber-600 hover:text-white'}`}
                                        >
                                            {isWalkingCustomer ? 'Walking Selected' : 'Walking Customer'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsNewPatient(!isNewPatient);
                                                setIsWalkingCustomer(false);
                                                setSelectedPatient('');
                                            }}
                                            className={`text-sm px-4 py-1.5 rounded-xl transition-all font-semibold border ${isNewPatient ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-emerald-600/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-600 hover:text-white'}`}
                                        >
                                            {isNewPatient ? 'Search Existing' : '+ New Patient'}
                                        </button>
                                    </div>
                                </div>

                                {isNewPatient ? (
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Enter patient name..."
                                            className="w-full bg-primary-bg p-3 rounded-xl border border-accent/50 text-white outline-none focus:border-accent"
                                            value={newPatientName}
                                            onChange={e => setNewPatientName(e.target.value)}
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            placeholder="Enter phone number..."
                                            className="w-full bg-primary-bg p-3 rounded-xl border border-accent/50 text-white outline-none focus:border-accent"
                                            value={newPatientPhone}
                                            onChange={e => setNewPatientPhone(e.target.value.replace(/\D/g, ''))}
                                        />
                                        <textarea
                                            placeholder="Enter address..."
                                            className="w-full bg-primary-bg p-3 rounded-xl border border-accent/50 text-white outline-none focus:border-accent min-h-[80px]"
                                            value={newPatientAddress}
                                            onChange={e => setNewPatientAddress(e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <div ref={patientSearchRef} className="relative space-y-2">
                                        <div className="relative group">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-400 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder={selectedPatient ? patients.find(p => p.id == selectedPatient)?.name : "Search patient name..."}
                                                className={`w-full bg-primary-bg pl-10 pr-4 py-3.5 rounded-xl border transition-all font-bold text-lg ${isPatientDropdownOpen ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-gray-700'} text-white outline-none placeholder:text-gray-500`}
                                                value={patientDropdownSearch}
                                                onChange={e => {
                                                    setPatientDropdownSearch(e.target.value);
                                                    setIsPatientDropdownOpen(true);
                                                    setIsWalkingCustomer(false);
                                                }}
                                                onFocus={() => {
                                                    setIsPatientDropdownOpen(true);
                                                    setIsWalkingCustomer(false);
                                                    setIsNewPatient(false);
                                                }}
                                            />
                                            {isPatientDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 z-[70] mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                                        {patients.filter(p => p.name.toLowerCase().includes(patientDropdownSearch.toLowerCase())).length === 0 ? (
                                                            <div className="p-4 text-center text-gray-500 italic text-sm">No matching patients found.</div>
                                                        ) : (
                                                            patients
                                                                .filter(p => p.name.toLowerCase().includes(patientDropdownSearch.toLowerCase()))
                                                                .map(p => (
                                                                    <div
                                                                        key={p.id}
                                                                        onClick={() => {
                                                                            setSelectedPatient(p.id);
                                                                            setPatientDropdownSearch('');
                                                                            setIsPatientDropdownOpen(false);
                                                                        }}
                                                                        className={`p-3 cursor-pointer transition-all border-b border-gray-800 last:border-0 flex items-center justify-between hover:bg-emerald-500/10 ${selectedPatient == p.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-300 hover:text-white'}`}
                                                                    >
                                                                        <div className="flex flex-col gap-0.5 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-bold text-lg">{p.name}</span>
                                                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md font-bold">{p.visit_count}</span>
                                                                            </div>
                                                                            <span className="text-sm text-gray-500">{p.phone}</span>
                                                                        </div>
                                                                        {selectedPatient == p.id && <Check size={18} className="text-emerald-400" />}
                                                                    </div>
                                                                ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {selectedPatient && !isPatientDropdownOpen && (
                                            <div className="flex items-center justify-between bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 animate-in fade-in duration-300">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-emerald-500 font-bold uppercase tracking-widest mb-1">Selected Patient</span>
                                                    <span className="text-white font-semibold text-xl">{patients.find(p => p.id == selectedPatient)?.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedPatient('')}
                                                    className="p-1.5 hover:bg-rose-500/20 text-gray-500 hover:text-rose-500 rounded-lg transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                        {isWalkingCustomer && !isNewPatient && !selectedPatient && (
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 animate-in fade-in duration-300">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-amber-500 font-bold uppercase tracking-widest mb-1">Status</span>
                                                        <span className="text-white font-semibold text-xl">Walking Customer</span>
                                                    </div>
                                                    <button
                                                        onClick={() => { setIsWalkingCustomer(false); setNewPatientAddress(''); }}
                                                        className="p-1.5 hover:bg-rose-500/20 text-gray-500 hover:text-rose-500 rounded-lg transition-all"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <textarea
                                                    placeholder="Enter walking customer address (optional)..."
                                                    className="w-full bg-primary-bg p-3 rounded-xl border border-amber-500/30 text-white outline-none focus:border-amber-500 min-h-[60px] text-sm"
                                                    value={newPatientAddress}
                                                    onChange={e => setNewPatientAddress(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 border border-gray-800 rounded-xl bg-primary-bg p-3 space-y-1">
                                {selectedItems.length === 0 ? <p className="text-center text-gray-500 italic mt-10">No items added.</p> :
                                    selectedItems.map(item => (
                                        <div key={`${item.type}-${item.id}`} className="bg-primary-bg/50 p-2 rounded-xl border border-gray-800 hover:border-emerald-500/30 transition-all flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="text-white text-base font-bold leading-tight">{item.name}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 font-bold uppercase tracking-wider">
                                                        {item.type} • Rs. {item.price} x {item.quantity}
                                                    </p>
                                                </div>
                                                <button onClick={() => removeItem(item.id, item.type)} className="text-gray-500 hover:text-red-500 transition-colors p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-800/50">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Discount</label>
                                                    <div className="flex items-center gap-1 bg-gray-900 px-2 py-1 rounded-lg border border-gray-700 focus-within:border-amber-500 transition-all w-24">
                                                        <span className="text-[10px] font-bold text-gray-500">Rs.</span>
                                                        <input
                                                            type="number"
                                                            className="bg-transparent border-none outline-none text-white text-xs w-full font-bold"
                                                            value={item.discount || ''}
                                                            onChange={(e) => updateItemDiscount(item.id, item.type, e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Line Total</p>
                                                    <span className="text-emerald-400 font-bold text-base">Rs. {((item.quantity * item.price) - (item.discount || 0)).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>

                            <div className="pt-4 border-t border-gray-800 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-[400] text-sm uppercase tracking-wider">Subtotal</span>
                                    <span className="text-gray-400 font-semibold font-price">Rs. {selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-[400] text-xs uppercase tracking-wider">Discounts</span>
                                    <span className="text-amber-500/80 font-semibold font-price">- Rs. {selectedItems.reduce((acc, curr) => acc + (curr.discount || 0), 0).toLocaleString()}</span>
                                </div>

                                <div className="flex gap-2 mb-4">
                                    <button
                                        onClick={() => setPaymentMethod('Cash')}
                                        className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg border transition-all ${paymentMethod === 'Cash' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-primary-bg text-gray-400 border-gray-700 hover:text-white'}`}
                                    >
                                        <Banknote size={16} /> Cash
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('Online')}
                                        className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg border transition-all ${paymentMethod === 'Online' ? 'bg-blue-600 text-white border-blue-500' : 'bg-primary-bg text-gray-400 border-gray-700 hover:text-white'}`}
                                    >
                                        <CreditCard size={16} /> Online
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (paymentMethod !== 'Mixed') {
                                                setMixedCash(total - discount);
                                                setMixedOnline(0);
                                            }
                                            setPaymentMethod('Mixed');
                                        }}
                                        className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg border transition-all ${paymentMethod === 'Mixed' ? 'bg-purple-600 text-white border-purple-500' : 'bg-primary-bg text-gray-400 border-gray-700 hover:text-white'}`}
                                    >
                                        <DollarSign size={16} /> Mixed
                                    </button>
                                </div>

                                {paymentMethod === 'Mixed' && (
                                    <div className="grid grid-cols-2 gap-3 mb-4 animate-in fade-in duration-300">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Cash Amount</label>
                                            <div className="flex items-center gap-2 bg-primary-bg rounded-lg border border-gray-700 px-3 py-1.5 focus-within:border-emerald-500">
                                                <input
                                                    type="number"
                                                    className="bg-transparent border-none outline-none text-white text-xs w-full font-semibold"
                                                    value={mixedCash || ''}
                                                    onChange={(e) => {
                                                        const val = Math.min(Number(e.target.value), total);
                                                        setMixedCash(val);
                                                        setMixedOnline(total - val);
                                                    }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Online Amount</label>
                                            <div className="flex items-center gap-2 bg-primary-bg rounded-lg border border-gray-700 px-3 py-1.5 focus-within:border-blue-500">
                                                <input
                                                    type="number"
                                                    className="bg-transparent border-none outline-none text-white text-xs w-full font-semibold"
                                                    value={mixedOnline || ''}
                                                    onChange={(e) => {
                                                        const val = Math.min(Number(e.target.value), total);
                                                        setMixedOnline(val);
                                                        setMixedCash(total - val);
                                                    }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-end mb-4 pt-2 border-t border-gray-800/50">
                                    <span className="text-gray-300 font-bold text-lg">Total</span>
                                    <span className="text-2xl font-bold text-accent-hover font-sans">Rs. {total.toLocaleString()}</span>
                                </div>
                                <button onClick={createInvoice} disabled={(isNewPatient ? !newPatientName : (!isWalkingCustomer && !selectedPatient)) || total === 0}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all">
                                    Generate Invoice
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Preview Modal */}
            {previewData && (
                <ReceiptPreviewModal
                    data={previewData}
                    onClose={() => setPreviewData(null)}
                    onPrint={printReceipt}
                    type={previewType}
                />
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

export default Billing;

