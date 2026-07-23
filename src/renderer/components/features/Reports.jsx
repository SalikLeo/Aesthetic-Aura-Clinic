import React, { useState, useEffect } from 'react';
import { FileText, Printer, Calendar, Download, RefreshCw, Activity, ShoppingBag, Receipt, DollarSign, TrendingUp, BriefcaseMedical, Eye, EyeOff } from 'lucide-react';
import db from '../../database/db';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, endOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import PasswordModal from '../common/PasswordModal';

const Reports = () => {
    const [statsPeriod, setStatsPeriod] = useState('Daily');
    const [customRange, setCustomRange] = useState({
        start: format(new Date(), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [showStats, setShowStats] = useState(false);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let dateFilter = "";
            let expFilter = "";

            if (statsPeriod === 'Daily') {
                dateFilter = "date(i.date) = date('now', 'localtime')";
                expFilter = "date(date) = date('now', 'localtime')";
            } else if (statsPeriod === 'Weekly') {
                // From Monday of the current week
                dateFilter = "date(i.date) >= date('now', 'localtime', 'weekday 0', '-6 days')";
                expFilter = "date(date) >= date('now', 'localtime', 'weekday 0', '-6 days')";
            } else if (statsPeriod === 'Monthly') {
                dateFilter = "date(i.date) >= date('now', 'localtime', 'start of month')";
                expFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            } else if (statsPeriod === 'Annual') {
                dateFilter = "date(i.date) >= date('now', 'localtime', 'start of year')";
                expFilter = "date(date) >= date('now', 'localtime', 'start of year')";
            } else if (statsPeriod === 'Custom') {
                dateFilter = `date(i.date) >= '${customRange.start}' AND date(i.date) <= '${customRange.end}'`;
                expFilter = `date(date) >= '${customRange.start}' AND date(date) <= '${customRange.end}'`;
            }

            // Total Sales (Gross)
            const salesRes = await db.get(`SELECT SUM(total + item_discount + discount) as total FROM invoices i WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}`);
            const totalSales = salesRes?.total || 0;

            // Total Expenses
            const expRes = await db.get(`SELECT SUM(amount) as total FROM expenses WHERE ${expFilter}`);
            const totalExpenses = expRes?.total || 0;

            // Total Discounts
            const discRes = await db.get(`SELECT SUM(item_discount + discount) as total FROM invoices i WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}`);
            const totalDiscounts = discRes?.total || 0;

            // Products Data
            const prodRes = await db.get(`
                SELECT SUM(ip.quantity) as count, SUM((ip.price * ip.quantity) - ip.discount) as total
                FROM invoice_products ip
                JOIN invoices i ON ip.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
            `);
            const productsSold = prodRes?.count || 0;
            const productsTotal = prodRes?.total || 0;

            // Services Data
            const servRes = await db.get(`
                SELECT SUM(iserv.quantity) as count, SUM((iserv.price * iserv.quantity) - iserv.discount) as total
                FROM invoice_services iserv
                JOIN invoices i ON iserv.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
            `);
            const servicesSold = servRes?.count || 0;
            const servicesTotal = servRes?.total || 0;

            // Doctor Visits Data
            const docRes = await db.get(`
                SELECT COUNT(idoc.id) as count, SUM(idoc.price - idoc.discount) as total
                FROM invoice_doctors idoc
                JOIN invoices i ON idoc.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
            `);
            const doctorsCount = docRes?.count || 0;
            const doctorsTotal = docRes?.total || 0;

            // Separate Discounts Calculation
            const prodDiscRes = await db.get(`
                SELECT SUM(ip.discount) as total FROM invoice_products ip 
                JOIN invoices i ON ip.invoice_id = i.id 
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
            `);
            const servDiscRes = await db.get(`
                SELECT SUM(iserv.discount) as total FROM invoice_services iserv 
                JOIN invoices i ON iserv.invoice_id = i.id 
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
            `);
            const docDiscRes = await db.get(`
                SELECT SUM(idoc.discount) as total FROM invoice_doctors idoc 
                JOIN invoices i ON idoc.invoice_id = i.id 
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
            `);
            const prodDiscount = prodDiscRes?.total || 0;
            const servDiscount = servDiscRes?.total || 0;
            const docDiscount = docDiscRes?.total || 0;



            // Detailed Sold Products
            const soldProducts = await db.all(`
                SELECT p.name, SUM(ip.quantity) as quantity, SUM((ip.price * ip.quantity) - ip.discount) as total
                FROM invoice_products ip
                JOIN products p ON ip.product_id = p.id
                JOIN invoices i ON ip.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
                GROUP BY p.name
                ORDER BY quantity DESC
            `);

            // Detailed Sold Services
            const soldServices = await db.all(`
                SELECT s.name, SUM(iserv.quantity) as quantity, SUM((iserv.price * iserv.quantity) - iserv.discount) as total
                FROM invoice_services iserv
                JOIN services s ON iserv.service_id = s.id
                JOIN invoices i ON iserv.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
                GROUP BY s.name
                ORDER BY quantity DESC
            `);

            // Detailed Doctor Visits
            const soldDoctorVisits = await db.all(`
                SELECT d.name, COUNT(idoc.id) as count, SUM(idoc.price - idoc.discount) as total
                FROM invoice_doctors idoc
                JOIN doctors d ON idoc.doctor_id = d.id
                JOIN invoices i ON idoc.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}
                GROUP BY d.name
                ORDER BY count DESC
            `);

            setReportData({
                totalSales,
                totalExpenses,
                totalDiscounts,
                totalProfit: totalSales - totalExpenses - totalDiscounts,
                productsSold,
                servicesSold,
                doctorsCount,

                soldProducts: soldProducts || [],
                soldServices: soldServices || [],
                soldDoctors: soldDoctorVisits || [],
                productsTotal,
                servicesTotal,
                doctorsTotal,
                prodDiscount,
                servDiscount,
                docDiscount,
                period: statsPeriod,
                range: statsPeriod === 'Custom'
                    ? `${customRange.start} to ${customRange.end}`
                    : statsPeriod === 'Monthly'
                        ? `Monthly (${format(new Date(), 'MMMM')})`
                        : statsPeriod
            });
        } catch (err) {
            console.error('Error fetching report data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReportData();
    }, [statsPeriod, customRange]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            fetchReportData();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [statsPeriod, customRange]);

    const handlePrintRequest = () => {
        if (!reportData) return;
        setIsPreviewOpen(true);
    };

    const generatePrint = () => {
        if (!reportData) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '80mm';
        iframe.style.height = '100vh';
        iframe.style.visibility = 'hidden';
        iframe.style.zIndex = '-9999';
        document.body.appendChild(iframe);

        const content = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Clinic Report - ${reportData.period}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
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
                        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 2mm; margin-bottom: 3mm; }
                        .clinic-name { font-size: 18pt; font-weight: 800; }
                        .report-title { font-size: 12pt; font-weight: 700; margin-top: 1mm; text-transform: uppercase; }
                        .report-info { font-size: 12pt; margin-bottom: 4mm; text-align: center; color: #000; font-weight: 600; }
                        
                        .section-title { font-size: 10pt; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 1mm; margin: 4mm 0 2mm 0; }
                        
                        .stats-table { width: 100%; border-collapse: collapse; font-size: 11pt; }
                        .stats-table td { padding: 1.5mm 0; border-bottom: 1px solid #000; }
                        .label { color: #000; font-weight: 500; font-family: 'Montserrat', sans-serif; }
                        .value { text-align: right; font-weight: 700; font-family: 'Montserrat', sans-serif; }
                        
                        .detailed-table { width: 100%; border-collapse: collapse; font-size: 10pt; border: 1.5px solid #000; margin-bottom: 2mm; }
                        .detailed-table th, .detailed-table td { padding: 1.5mm 1mm; border: 1.5px solid #000; text-align: left; }
                        .detailed-table th { background: #eee; font-weight: 800; text-transform: uppercase; font-size: 8pt; }

                        .profit-row { background: #000 !important; color: #fff !important; font-size: 11pt; border-top: 2px solid #000; }
                        .profit-row td { padding: 2mm 1mm; font-weight: 800; border: 1.5px solid #000 !important; }

                        .footer { margin-top: 8mm; text-align: center; font-size: 9pt; border-top: 1px dashed #000; padding-top: 3mm; color: #000; }
                    </style>
                </head>
                <body>
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
                        <div class="report-title">Financial Report</div>
                    </div>
                    
                    <div class="report-info">
                        <strong>Period:</strong> ${reportData.range}<br>
                        <strong>Generated:</strong> ${format(new Date(), 'PPpp')}
                    </div>

                    <div class="section-title">Summary</div>
                    <table class="detailed-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th style="text-align: right; width: 30mm;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="label">Gross Sales</td>
                                <td class="value">Rs. ${reportData.totalSales.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td class="label">Total Expenses</td>
                                <td class="value">Rs. ${reportData.totalExpenses.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td class="label">Total Discounts</td>
                                <td class="value">Rs. ${reportData.totalDiscounts.toLocaleString()}</td>
                            </tr>

                            <tr class="profit-row">
                                <td>NET PROFIT</td>
                                <td style="text-align: right;">Rs. ${reportData.totalProfit.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="section-title">Breakdown</div>
                    <table class="detailed-table">
                        <thead>
                            <tr>
                                <th>Section</th>
                                <th style="text-align: center; width: 14mm;">Qty</th>
                                <th style="text-align: right; width: 25mm;">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Products</td>
                                <td style="text-align: center; font-weight: 800;">${reportData.productsSold}</td>
                                <td style="text-align: right; font-weight: 700;">Rs. ${reportData.productsTotal.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td>Services</td>
                                <td style="text-align: center; font-weight: 800;">${reportData.servicesSold}</td>
                                <td style="text-align: right; font-weight: 700;">Rs. ${reportData.servicesTotal.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td>Doctor Visits</td>
                                <td style="text-align: center; font-weight: 800;">${reportData.doctorsCount}</td>
                                <td style="text-align: right; font-weight: 700;">Rs. ${reportData.doctorsTotal.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="section-title" style="margin-top: 5mm;">Discounts Breakdown</div>
                    <table class="detailed-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th style="text-align: right; width: 30mm;">Discount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="font-weight: 500;">Products Discount</td>
                                <td style="text-align: right; font-weight: 700;">Rs. ${reportData.prodDiscount.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Services Discount</td>
                                <td style="text-align: right; font-weight: 700;">Rs. ${reportData.servDiscount.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Doctor Visits Discount</td>
                                <td style="text-align: right; font-weight: 700;">Rs. ${reportData.docDiscount.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    ${reportData.soldProducts && reportData.soldProducts.length > 0 ? `
                        <div class="section-title">Sold Products</div>
                        <table class="detailed-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th style="text-align: center; width: 15mm;">Qty</th>
                                    <th style="text-align: right; width: 25mm;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reportData.soldProducts.map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td style="text-align: center;">${p.quantity}</td>
                                        <td style="text-align: right;">Rs.${p.total.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : ''}

                    ${reportData.soldServices && reportData.soldServices.length > 0 ? `
                        <div class="section-title">Sold Services</div>
                        <table class="detailed-table">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th style="text-align: center; width: 15mm;">Qty</th>
                                    <th style="text-align: right; width: 25mm;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reportData.soldServices.map(s => `
                                    <tr>
                                        <td>${s.name}</td>
                                        <td style="text-align: center;">${s.quantity}</td>
                                        <td style="text-align: right;">Rs.${s.total.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : ''}

                    ${reportData.soldDoctors && reportData.soldDoctors.length > 0 ? `
                        <div class="section-title">Doctor Visits</div>
                        <table class="detailed-table">
                            <thead>
                                <tr>
                                    <th>Doctor</th>
                                    <th style="text-align: center; width: 15mm;">Qty</th>
                                    <th style="text-align: right; width: 25mm;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reportData.soldDoctors.map(d => `
                                    <tr>
                                        <td>${d.name}</td>
                                        <td style="text-align: center;">${d.count}</td>
                                        <td style="text-align: right;">Rs.${d.total.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : ''}



                    <div class="footer">
                        Aesthetic Aura Clinic<br>
                        Software by PrimeSoft - 0309-5369472
                    </div>
                </body>
            </html>
        `;

        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => {
                    if (document.body.contains(iframe)) document.body.removeChild(iframe);
                }, 2000);
            }, 1000);
        };

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(content);
        iframeDoc.close();
    };

    const ReportPreviewModal = ({ data, onClose, onPrint }) => {
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
                            <h1 className="text-3xl font-extrabold capitalize tracking-tighter">Aesthetic Aura</h1>
                            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-black mb-0.5">by Dr. Maryum Qazi</p>
                            <p className="text-[11px] font-medium text-black">Contact: 0300-0140566</p>
                            <p className="text-[11px] font-medium text-black">City Center Plaza, New City Phase 2, Wah</p>
                            <div className="pt-2 border-t border-black mt-2">
                                <p className="font-bold uppercase tracking-widest text-[11px]">Financial Report</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-4 text-[14px] border-y border-black py-4">
                            <div className="flex justify-between items-center">
                                <span className="text-black uppercase font-bold text-[12px]">Period</span>
                                <span className="font-bold text-[14px]">{data.range}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-black uppercase font-bold text-[12px]">Generated</span>
                                <span className="font-bold text-[13px]">{format(new Date(), 'PPpp')}</span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-center font-bold mb-3 tracking-[0.3em] uppercase text-[10px] text-black">--- Summary ---</p>
                            <div className="border-[1.5px] border-black rounded-sm overflow-hidden">
                                <table className="w-full border-collapse text-[13px]">
                                    <thead>
                                        <tr className="bg-gray-100 border-b-[1.5px] border-black">
                                            <th className="px-2 py-1.5 text-left font-bold uppercase text-[10px] border-r border-black">Category</th>
                                            <th className="px-2 py-1.5 text-right font-bold uppercase text-[10px] w-32">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-black">
                                        <tr className="border-b border-black hover:bg-gray-50 transition-colors">
                                            <td className="px-2 py-1.5 font-medium border-r border-black">Gross Sales</td>
                                            <td className="px-2 py-1.5 text-right font-bold">Rs.{data.totalSales.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b border-black hover:bg-gray-50 transition-colors">
                                            <td className="px-2 py-1.5 font-medium border-r border-black">Total Expenses</td>
                                            <td className="px-2 py-1.5 text-right font-bold">Rs.{data.totalExpenses.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b border-black hover:bg-gray-50 transition-colors">
                                            <td className="px-2 py-1.5 font-medium border-r border-black">Total Discounts</td>
                                            <td className="px-2 py-1.5 text-right font-bold">Rs.{data.totalDiscounts.toLocaleString()}</td>
                                        </tr>

                                        <tr className="bg-black text-white font-extrabold">
                                            <td className="px-2 py-2 text-left uppercase tracking-tighter border-r border-white/20">Net Profit</td>
                                            <td className="px-2 py-2 text-right text-[16px]">Rs.{data.totalProfit.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-center font-bold mb-3 tracking-[0.3em] uppercase text-[10px] text-black">--- Breakdown ---</p>
                            <div className="border-[1.5px] border-black rounded-sm overflow-hidden">
                                <table className="w-full border-collapse text-[13px]">
                                    <thead>
                                        <tr className="bg-gray-100 border-b-[1.5px] border-black">
                                            <th className="px-2 py-1.5 text-left font-bold uppercase text-[10px] border-r border-black">Section</th>
                                            <th className="px-2 py-1.5 text-center font-bold uppercase text-[10px] border-r border-black w-14">Qty</th>
                                            <th className="px-2 py-1.5 text-right font-bold uppercase text-[10px] w-28">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-black">
                                        <tr className="border-b border-black hover:bg-gray-50 transition-colors">
                                            <td className="px-2 py-2 font-bold border-r border-black">Products</td>
                                            <td className="px-2 py-2 text-center border-r border-black font-bold font-sans">{data.productsSold}</td>
                                            <td className="px-2 py-2 text-right font-bold">Rs.{data.productsTotal.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b border-black hover:bg-gray-50 transition-colors">
                                            <td className="px-2 py-2 font-bold border-r border-black">Services</td>
                                            <td className="px-2 py-2 text-center border-r border-black font-bold font-sans">{data.servicesSold}</td>
                                            <td className="px-2 py-2 text-right font-bold">Rs.{data.servicesTotal.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b border-black hover:bg-gray-50 transition-colors">
                                            <td className="px-2 py-2 font-bold border-r border-black">Doctor Visits</td>
                                            <td className="px-2 py-2 text-center border-r border-black font-bold font-sans">{data.doctorsCount}</td>
                                            <td className="px-2 py-2 text-right font-bold">Rs.{data.doctorsTotal.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-center font-bold mb-3 tracking-[0.3em] uppercase text-[10px] text-black">--- Discounts ---</p>
                            <div className="border-[1.5px] border-black rounded-sm overflow-hidden">
                                <table className="w-full border-collapse text-[13px]">
                                    <thead>
                                        <tr className="bg-gray-100 border-b-[1.5px] border-black">
                                            <th className="px-2 py-1.5 text-left font-bold uppercase text-[10px] border-r border-black">Category</th>
                                            <th className="px-2 py-1.5 text-right font-bold uppercase text-[10px] w-32">Discount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-black">
                                        <tr className="border-b border-black">
                                            <td className="px-2 py-1.5 font-medium border-r border-black">Products</td>
                                            <td className="px-2 py-1.5 text-right font-bold">Rs.{data.prodDiscount.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b border-black">
                                            <td className="px-2 py-1.5 font-medium border-r border-black">Services</td>
                                            <td className="px-2 py-1.5 text-right font-bold">Rs.{data.servDiscount.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b border-black">
                                            <td className="px-2 py-1.5 font-medium border-r border-black">Doctor Visits</td>
                                            <td className="px-2 py-1.5 text-right font-bold">Rs.{data.docDiscount.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {data.soldProducts && data.soldProducts.length > 0 && (
                            <div className="mb-6">
                                <p className="text-center font-bold mb-3 tracking-[0.3em] uppercase text-[10px] text-black">--- Sold Products ---</p>
                                <div className="border-[1.5px] border-black rounded-sm overflow-hidden">
                                    <table className="w-full border-collapse text-[13px]">
                                        <thead>
                                            <tr className="bg-gray-100 border-b-[1.5px] border-black">
                                                <th className="px-2 py-1.5 text-left font-bold uppercase text-[10px] border-r border-black">Item</th>
                                                <th className="px-2 py-1.5 text-center font-bold uppercase text-[10px] border-r border-black w-14">Qty</th>
                                                <th className="px-2 py-1.5 text-right font-bold uppercase text-[10px] w-24">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y border-black">
                                            {data.soldProducts.map((p, idx) => (
                                                <tr key={idx} className="border-b border-black last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="px-2 py-1.5 font-medium border-r border-black">{p.name}</td>
                                                    <td className="px-2 py-1.5 text-center font-bold border-r border-black">{p.quantity}</td>
                                                    <td className="px-2 py-1.5 text-right font-bold">Rs.{p.total.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {data.soldServices && data.soldServices.length > 0 && (
                            <div className="mb-6">
                                <p className="text-center font-bold mb-3 tracking-[0.3em] uppercase text-[10px] text-black">--- Sold Services ---</p>
                                <div className="border-[1.5px] border-black rounded-sm overflow-hidden">
                                    <table className="w-full border-collapse text-[13px]">
                                        <thead>
                                            <tr className="bg-gray-100 border-b-[1.5px] border-black">
                                                <th className="px-2 py-1.5 text-left font-bold uppercase text-[10px] border-r border-black">Service</th>
                                                <th className="px-2 py-1.5 text-center font-bold uppercase text-[10px] border-r border-black w-14">Qty</th>
                                                <th className="px-2 py-1.5 text-right font-bold uppercase text-[10px] w-24">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y border-black">
                                            {data.soldServices.map((s, idx) => (
                                                <tr key={idx} className="border-b border-black last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="px-2 py-1.5 font-medium border-r border-black">{s.name}</td>
                                                    <td className="px-2 py-1.5 text-center font-bold border-r border-black">{s.quantity}</td>
                                                    <td className="px-2 py-1.5 text-right font-bold">Rs.{s.total.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {data.soldDoctors && data.soldDoctors.length > 0 && (
                            <div className="mb-6">
                                <p className="text-center font-bold mb-3 tracking-[0.3em] uppercase text-[10px] text-black">--- Doctor Visits ---</p>
                                <div className="border-[1.5px] border-black rounded-sm overflow-hidden">
                                    <table className="w-full border-collapse text-[13px]">
                                        <thead>
                                            <tr className="bg-gray-100 border-b-[1.5px] border-black">
                                                <th className="px-2 py-1.5 text-left font-bold uppercase text-[10px] border-r border-black">Doctor</th>
                                                <th className="px-2 py-1.5 text-center font-bold uppercase text-[10px] border-r border-black w-14">Qty</th>
                                                <th className="px-2 py-1.5 text-right font-bold uppercase text-[10px] w-24">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y border-black">
                                            {data.soldDoctors.map((d, idx) => (
                                                <tr key={idx} className="border-b border-black last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="px-2 py-1.5 font-medium border-r border-black">{d.name}</td>
                                                    <td className="px-2 py-1.5 text-center font-bold border-r border-black">{d.quantity}</td>
                                                    <td className="px-2 py-1.5 text-right font-bold">Rs.{d.total.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}



                        <div className="mt-8 text-center space-y-1 text-[12px] text-black border-t border-dashed border-black pt-4">
                            <p className="font-bold uppercase tracking-widest text-[11px]">End of Report</p>
                            <p className="font-semibold">Software by PrimeSoft - 0309-5369472</p>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-gray-50 border-t flex gap-2">
                        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded hover:bg-gray-300 transition-all uppercase text-xs">Close</button>
                        <button
                            onClick={() => {
                                onPrint();
                                onClose();
                            }}
                            className="flex-[2] py-3 bg-black text-white font-bold rounded hover:bg-gray-800 transition-all uppercase text-xs flex items-center justify-center gap-2"
                        >
                            <Printer size={16} /> Print Now
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 h-screen overflow-y-auto custom-scrollbar flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight">Financial Reports</h1>
                </div>
                <button
                    onClick={() => {
                        if (!showStats) {
                            requestSecureAction(() => setShowStats(true), "View Financial Reports");
                        } else {
                            setShowStats(false);
                        }
                    }}
                    className="bg-[#1a2233] hover:bg-gray-800 text-white p-2 rounded-xl border border-gray-700 transition-all flex items-center gap-2 text-sm font-semibold"
                >
                    {showStats ? <EyeOff size={18} /> : <Eye size={18} />}
                    {showStats ? 'Hide Reports' : 'Show Reports'}
                </button>
            </div>

            {/* Selection Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-3xl p-6 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex bg-[#1a2233] p-1.5 rounded-2xl border border-gray-700 w-full md:w-auto">
                        {['Daily', 'Weekly', 'Monthly', 'Annual', 'Custom'].map(period => (
                            <button
                                key={period}
                                onClick={() => setStatsPeriod(period)}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${statsPeriod === period ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>

                    {statsPeriod === 'Custom' && (
                        <div className="flex flex-wrap items-center gap-4 bg-[#0f1420] p-4 rounded-2xl border border-gray-800 animate-in fade-in slide-in-from-right-4 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-[#1a2233] px-3 py-1.5 rounded-xl border border-gray-700">
                                <Calendar size={16} className="text-emerald-500" />
                                <select
                                    className="bg-transparent text-sm text-white outline-none cursor-pointer font-semibold min-w-[140px]"
                                    onChange={(e) => {
                                        if (e.target.value === "") return;
                                        const selectedDate = new Date(e.target.value);
                                        setCustomRange({
                                            start: format(startOfMonth(selectedDate), 'yyyy-MM-dd'),
                                            end: format(endOfMonth(selectedDate), 'yyyy-MM-dd')
                                        });
                                        setStatsPeriod('Custom');
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" className="bg-[#1a2233]">Quick Select Month</option>
                                    {Array.from({ length: 12 }).map((_, i) => {
                                        const date = subMonths(new Date(), i);
                                        return (
                                            <option key={i} value={format(date, 'yyyy-MM-dd')} className="bg-[#1a2233]">
                                                {format(date, 'MMMM yy')}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">From</label>
                                    <input
                                        type="date"
                                        className="bg-[#1a2233] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-500 font-semibold"
                                        value={customRange.start}
                                        onChange={e => {
                                            setCustomRange({ ...customRange, start: e.target.value });
                                            setStatsPeriod('Custom');
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">To</label>
                                    <input
                                        type="date"
                                        className="bg-[#1a2233] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-500 font-semibold"
                                        value={customRange.end}
                                        onChange={e => {
                                            setCustomRange({ ...customRange, end: e.target.value });
                                            setStatsPeriod('Custom');
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handlePrintRequest}
                        disabled={!reportData || loading}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
                    >
                        <Printer size={20} />
                        Print Report
                    </button>
                </div>
            </div>

            {/* Preview Section */}
            {showStats && (
                <>
                    {reportData && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-300">
                            {/* Summary Card */}
                            <div className="bg-secondary-bg border border-gray-800 rounded-3xl p-8 shadow-xl">
                                <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                                    <TrendingUp className="text-emerald-500" size={24} />
                                    Financial Summary
                                </h3>

                                <div className="space-y-6">
                                    <div className="flex justify-between items-center p-4 bg-[#0f1420] border border-gray-800/50 rounded-2xl">
                                        <span className="text-gray-400 font-semibold uppercase tracking-wide">Gross Sales</span>
                                        <span className="text-2xl font-semibold text-white">Rs. {reportData.totalSales.toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between items-center p-4 bg-[#0f1420] border border-gray-800/50 rounded-2xl">
                                        <span className="text-gray-400 font-semibold uppercase tracking-wide">Total Expenses</span>
                                        <span className="text-2xl font-semibold text-rose-500">Rs. {reportData.totalExpenses.toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between items-center p-4 bg-[#0f1420] border border-gray-800/50 rounded-2xl">
                                        <span className="text-gray-400 font-semibold uppercase tracking-wide">Total Discounts</span>
                                        <span className="text-2xl font-semibold text-amber-500">Rs. {reportData.totalDiscounts.toLocaleString()}</span>
                                    </div>



                                    <div className={`flex justify-between items-center p-6 border-2 rounded-2xl ${reportData.totalProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                                        <span className="text-gray-300 font-bold text-lg uppercase tracking-widest">Net Profit</span>
                                        <span className={`text-4xl font-semibold ${reportData.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            Rs. {reportData.totalProfit.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown Card */}
                            <div className="bg-secondary-bg border border-gray-800 rounded-3xl p-8 shadow-xl">
                                <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                                    <Activity className="text-blue-500" size={24} />
                                    Sales Breakdown
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group transition-all">
                                        <ShoppingBag className="text-purple-400 mb-2" size={32} />
                                        <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Products Sold</span>
                                        <h4 className="text-3xl font-semibold text-white mt-1">{reportData.productsSold}</h4>
                                        <p className="text-purple-400 font-bold mt-2">Rs. {reportData.productsTotal.toLocaleString()}</p>
                                    </div>

                                    <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group transition-all">
                                        <Activity className="text-blue-400 mb-2" size={32} />
                                        <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Services Sold</span>
                                        <h4 className="text-3xl font-semibold text-white mt-1">{reportData.servicesSold}</h4>
                                        <p className="text-blue-400 font-bold mt-2">Rs. {reportData.servicesTotal.toLocaleString()}</p>
                                    </div>

                                    <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group transition-all">
                                        <BriefcaseMedical className="text-emerald-400 mb-2" size={32} />
                                        <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Doctor Visits</span>
                                        <h4 className="text-3xl font-semibold text-white mt-1">{reportData.doctorsCount}</h4>
                                        <p className="text-emerald-400 font-bold mt-2">Rs. {reportData.doctorsTotal.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-[#0f1420] border border-gray-800/50 rounded-2xl">
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                                        <TrendingUp className="text-emerald-500" size={24} />
                                        Percentage Contribution
                                    </h3>
                                    <div className="flex h-4 w-full rounded-full overflow-hidden bg-gray-800">
                                        {reportData.totalSales > 0 ? (
                                            <>
                                                <div
                                                    style={{ width: `${(reportData.productsTotal / (reportData.productsTotal + reportData.servicesTotal + reportData.doctorsTotal)) * 100 || 0}%` }}
                                                    className="bg-purple-500 h-full"
                                                    title="Products"
                                                ></div>
                                                <div
                                                    style={{ width: `${(reportData.servicesTotal / (reportData.productsTotal + reportData.servicesTotal + reportData.doctorsTotal)) * 100 || 0}%` }}
                                                    className="bg-blue-500 h-full"
                                                    title="Services"
                                                ></div>
                                                <div
                                                    style={{ width: `${(reportData.doctorsTotal / (reportData.productsTotal + reportData.servicesTotal + reportData.doctorsTotal)) * 100 || 0}%` }}
                                                    className="bg-emerald-500 h-full"
                                                    title="Doctor Visits"
                                                ></div>
                                            </>
                                        ) : (
                                            <div className="w-full bg-gray-700 h-full"></div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-6 mt-6 justify-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                            <span className="text-sm font-bold text-gray-400">Products ({Math.round((reportData.productsTotal / (reportData.productsTotal + reportData.servicesTotal + reportData.doctorsTotal)) * 100) || 0}%)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                            <span className="text-sm font-bold text-gray-400">Services ({Math.round((reportData.servicesTotal / (reportData.productsTotal + reportData.servicesTotal + reportData.doctorsTotal)) * 100) || 0}%)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                            <span className="text-sm font-bold text-gray-400">Doctor Visits ({Math.round((reportData.doctorsTotal / (reportData.productsTotal + reportData.servicesTotal + reportData.doctorsTotal)) * 100) || 0}%)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Lists - Span full width on large screens */}
                            <div className="lg:col-span-2 space-y-8 mt-4">
                                <div className="bg-secondary-bg border border-gray-800 rounded-3xl p-8 shadow-xl">
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                                        <ShoppingBag className="text-purple-500" size={24} />
                                        Sold Products & Services Details
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Products Table */}
                                        <div className="space-y-4">
                                            <h4 className="text-purple-400 font-bold uppercase tracking-widest text-sm border-b border-gray-800 pb-2">Products Sold</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse border border-gray-800/50 rounded-xl overflow-hidden">
                                                    <thead>
                                                        <tr className="text-gray-500 text-[10px] uppercase tracking-wider bg-white/5 border-b border-gray-800">
                                                            <th className="px-4 py-3 font-bold border-r border-gray-800/50">Product Name</th>
                                                            <th className="px-4 py-3 font-bold text-center border-r border-gray-800/50 w-20">Qty</th>
                                                            <th className="px-4 py-3 font-bold text-right w-28">Revenue</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-800/50">
                                                        {reportData.soldProducts.length > 0 ? reportData.soldProducts.map((p, idx) => (
                                                            <tr key={idx} className="group hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-4 text-white font-medium border-r border-gray-800/50">{p.name}</td>
                                                                <td className="px-4 py-4 text-center text-gray-400 border-r border-gray-800/50 font-bold">{p.quantity}</td>
                                                                <td className="px-4 py-4 text-right text-purple-400 font-bold">Rs. {p.total.toLocaleString()}</td>
                                                            </tr>
                                                        )) : (
                                                            <tr>
                                                                <td colSpan="3" className="py-8 text-center text-gray-600 italic">No products sold in this period</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Services Table */}
                                        <div className="space-y-4">
                                            <h4 className="text-blue-400 font-bold uppercase tracking-widest text-sm border-b border-gray-800 pb-2">Services Provided</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse border border-gray-800/50 rounded-xl overflow-hidden">
                                                    <thead>
                                                        <tr className="text-gray-500 text-[10px] uppercase tracking-wider bg-white/5 border-b border-gray-800">
                                                            <th className="px-4 py-3 font-bold border-r border-gray-800/50">Service Name</th>
                                                            <th className="px-4 py-3 font-bold text-center border-r border-gray-800/50 w-20">Qty</th>
                                                            <th className="px-4 py-3 font-bold text-right w-28">Revenue</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-800/50">
                                                        {reportData.soldServices.length > 0 ? reportData.soldServices.map((s, idx) => (
                                                            <tr key={idx} className="group hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-4 text-white font-medium border-r border-gray-800/50">{s.name}</td>
                                                                <td className="px-4 py-4 text-center text-gray-400 border-r border-gray-800/50 font-bold">{s.quantity}</td>
                                                                <td className="px-4 py-4 text-right text-blue-400 font-bold">Rs. {s.total.toLocaleString()}</td>
                                                            </tr>
                                                        )) : (
                                                            <tr>
                                                                <td colSpan="3" className="py-8 text-center text-gray-600 italic">No services provided in this period</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Doctor Visits Table (Optional) */}
                                    {reportData.soldDoctors.length > 0 && (
                                        <div className="mt-12 space-y-4">
                                            <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-sm border-b border-gray-800 pb-2">Doctor Visits</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse border border-gray-800/50 rounded-xl overflow-hidden">
                                                    <thead>
                                                        <tr className="text-gray-500 text-[10px] uppercase tracking-wider bg-white/5 border-b border-gray-800">
                                                            <th className="px-4 py-3 font-bold border-r border-gray-800/50">Doctor Name</th>
                                                            <th className="px-4 py-3 font-bold text-center border-r border-gray-800/50 w-20">Visits</th>
                                                            <th className="px-4 py-3 font-bold text-right w-28">Revenue</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-800/50">
                                                        {reportData.soldDoctors.map((d, idx) => (
                                                            <tr key={idx} className="group hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-4 text-white font-medium border-r border-gray-800/50">{d.name}</td>
                                                                <td className="px-4 py-4 text-center text-gray-400 border-r border-gray-800/50 font-bold">{d.quantity}</td>
                                                                <td className="px-4 py-4 text-right text-emerald-400 font-bold">Rs. {d.total.toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {!reportData && !loading && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-20">
                            <Download size={64} className="mb-4 text-gray-600" />
                            <h3 className="text-2xl font-bold">Select a period to load reports</h3>
                            <p className="max-w-md mx-auto mt-2 font-medium">Click on any of the time filters above to fetch financial data and generate a printable report.</p>
                        </div>
                    )}
                </>
            )}

            {isPreviewOpen && (
                <ReportPreviewModal
                    data={reportData}
                    onClose={() => setIsPreviewOpen(false)}
                    onPrint={() => generatePrint()}
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

export default Reports;
