import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, Users, Check, X, Eye, EyeOff, FileText, Calendar, ChevronRight, Clock, DollarSign, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import db from '../../database/db';
import { format } from 'date-fns';
import PasswordModal from '../common/PasswordModal';

const Patients = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [genderFilter, setGenderFilter] = useState('All');
    const [currentPatient, setCurrentPatient] = useState(null);
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [showStats, setShowStats] = useState(false);
    const [patientStats, setPatientStats] = useState({ total: 0, topPatient: null, totalSessions: 0, totalBills: 0 });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [patientDateFilter, setPatientDateFilter] = useState('All Patients');

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const [formData, setFormData] = useState({
        name: '', gender: 'Male', phone: '',
        address: '', medical_history: '',
        chronic_diseases: '', laser: '', session: ''
    });

    // Session State
    const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
    const [isViewSessionsModalOpen, setIsViewSessionsModalOpen] = useState(false);
    const [isSessionDetailsModalOpen, setIsSessionDetailsModalOpen] = useState(false);
    const [sessionData, setSessionData] = useState({ date: new Date().toISOString().split('T')[0], description: '', laser: '', session: '', energy: '' });
    const [patientSessions, setPatientSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionSearch, setSessionSearch] = useState('');
    const [sessionSort, setSessionSort] = useState('latest');
    const [deleteSessionConfirm, setDeleteSessionConfirm] = useState(null);
    const [patientInvoices, setPatientInvoices] = useState([]);

    const resetForm = () => {
        setFormData({
            name: '', gender: 'Male', phone: '',
            address: '', medical_history: '',
            chronic_diseases: '', laser: '', session: ''
        });
        setCurrentPatient(null);
    };

    const fetchPatients = async () => {
        try {
            let query = `
                SELECT p.*, 
                (SELECT COUNT(*) FROM invoices WHERE patient_id = p.id) as bills_count,
                (SELECT COUNT(*) FROM sessions WHERE patient_id = p.id) as sessions_count,
                (SELECT SUM(total) FROM invoices WHERE patient_id = p.id AND status = 'paid') as total_spent
                FROM patients p 
            `;
            const params = [];

            let whereClause = "WHERE 1=1";

            if (search) {
                whereClause += " AND (p.name LIKE ? OR p.phone LIKE ?)";
                params.push(`%${search}%`, `%${search}%`);
            }

            if (genderFilter !== 'All') {
                whereClause += " AND p.gender = ?";
                params.push(genderFilter);
            }

            if (patientDateFilter === 'Today') {
                whereClause += " AND date(p.created_at) = date('now', 'localtime')";
            } else if (patientDateFilter === 'Week') {
                whereClause += " AND date(p.created_at) >= date('now', 'localtime', '-7 days')";
            } else if (patientDateFilter === 'Month') {
                whereClause += " AND date(p.created_at) >= date('now', 'localtime', 'start of month')";
            }

            query += ` ${whereClause}`;

            if (sortBy === 'latest') {
                query += " ORDER BY p.id DESC";
            } else if (sortBy === 'alpha') {
                query += " ORDER BY p.name ASC";
            } else if (sortBy === 'sessions-asc') {
                query += " ORDER BY sessions_count ASC";
            } else if (sortBy === 'sessions-desc') {
                query += " ORDER BY sessions_count DESC";
            } else if (sortBy === 'visits-asc') {
                query += " ORDER BY (bills_count + sessions_count) ASC";
            } else if (sortBy === 'visits-desc') {
                query += " ORDER BY (bills_count + sessions_count) DESC";
            } else if (sortBy === 'spent-desc') {
                query += " ORDER BY total_spent DESC";
            } else if (sortBy === 'spent-asc') {
                query += " ORDER BY total_spent ASC";
            }

            const data = await db.all(query, params);
            setPatients(data || []);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching patients:", err);
            setLoading(false);
        }
    };

    const loadPatientStats = async () => {
        try {
            let patientDateFilter = "";
            let genericDateFilter = "";
            if (statsPeriod === 'Daily') {
                patientDateFilter = "date(created_at) = date('now', 'localtime')";
                genericDateFilter = "date(date) = date('now', 'localtime')";
            } else if (statsPeriod === 'Weekly') {
                patientDateFilter = "date(created_at) >= date('now', 'localtime', '-7 days')";
                genericDateFilter = "date(date) >= date('now', 'localtime', '-7 days')";
            } else if (statsPeriod === 'Monthly') {
                patientDateFilter = "date(created_at) >= date('now', 'localtime', 'start of month')";
                genericDateFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            } else if (statsPeriod === 'Annual') {
                patientDateFilter = "date(created_at) >= date('now', 'localtime', 'start of year')";
                genericDateFilter = "date(date) >= date('now', 'localtime', 'start of year')";
            }

            const totalRes = await db.get(`SELECT COUNT(*) as count FROM patients ${patientDateFilter ? 'WHERE ' + patientDateFilter : ''}`);

            // Get top patient by visits in the period
            const topPatientRes = await db.get(`
                SELECT 
                    p.id,
                    p.name,
                    (
                        (SELECT COUNT(*) FROM sessions WHERE patient_id = p.id ${genericDateFilter ? 'AND ' + genericDateFilter : ''}) + 
                        (SELECT COUNT(*) FROM invoices WHERE patient_id = p.id ${genericDateFilter ? 'AND ' + genericDateFilter : ''})
                    ) as total_visits,
                    (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE patient_id = p.id AND status = 'paid' ${genericDateFilter ? 'AND ' + genericDateFilter : ''}) as total_spent
                FROM patients p
                WHERE total_visits > 0
                ORDER BY total_visits DESC, total_spent DESC
                LIMIT 1
            `);

            // Get total sessions count
            const totalSessionsRes = await db.get(`SELECT COUNT(*) as count FROM sessions ${genericDateFilter ? 'WHERE ' + genericDateFilter : ''}`);

            // Get total bills count
            const totalBillsRes = await db.get(`SELECT COUNT(*) as count FROM invoices ${genericDateFilter ? 'WHERE ' + genericDateFilter : ''}`);

            setPatientStats({
                total: totalRes?.count || 0,
                topPatient: topPatientRes || null,
                totalSessions: totalSessionsRes?.count || 0,
                totalBills: totalBillsRes?.count || 0
            });
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchPatients(); }, [search, sortBy, genderFilter, patientDateFilter]);
    useEffect(() => { loadPatientStats(); }, [statsPeriod]);
    useEffect(() => { if (isViewSessionsModalOpen && currentPatient) loadSessions(currentPatient.id); }, [sessionSearch, sessionSort]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            fetchPatients();
            loadPatientStats();
            if (isViewSessionsModalOpen && currentPatient) {
                loadSessions(currentPatient.id);
                loadInvoices(currentPatient.id);
            }
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, sortBy, genderFilter, patientDateFilter, statsPeriod, isViewSessionsModalOpen, currentPatient]);

    const handleAddSession = (patient) => {
        setCurrentPatient(patient);
        setSessionData({ date: new Date().toISOString().split('T')[0], description: '', laser: '', session: '', energy: '' });
        setIsSessionModalOpen(true);
    };

    const handleViewSessions = async (patient) => {
        setCurrentPatient(patient);
        setSessionSearch('');
        setSessionSort('latest');
        await Promise.all([
            loadSessions(patient.id),
            loadInvoices(patient.id)
        ]);
        setIsViewSessionsModalOpen(true);
    };

    const loadInvoices = async (patientId) => {
        try {
            const invoices = await db.all("SELECT * FROM invoices WHERE patient_id = ? ORDER BY date DESC", [patientId]);
            setPatientInvoices(invoices || []);
        } catch (err) {
            console.error("Error loading invoices for modal:", err);
            setPatientInvoices([]);
        }
    };

    const loadSessions = async (patientId) => {
        try {
            let query = "SELECT * FROM sessions WHERE patient_id = ?";
            const params = [patientId];

            if (sessionSearch) {
                query += " AND (description LIKE ?)";
                params.push(`%${sessionSearch}%`);
            }

            if (sessionSort === 'latest') {
                query += " ORDER BY date DESC, created_at DESC";
            } else {
                query += " ORDER BY date ASC, created_at ASC";
            }

            const sessions = await db.all(query, params);
            if (Array.isArray(sessions)) {
                setPatientSessions(sessions);
            } else {
                console.error("Database error loading sessions:", sessions);
                setPatientSessions([]);
            }
        } catch (err) {
            console.error("Error loading sessions:", err);
            setPatientSessions([]);
        }
    };

    const handlePrintInvoice = async (inv) => {
        try {
            // Fetch invoice items
            const [servs, prods, docs] = await Promise.all([
                db.all("SELECT s.name, iserv.quantity, iserv.price FROM invoice_services iserv JOIN services s ON iserv.service_id = s.id WHERE iserv.invoice_id = ?", [inv.id]),
                db.all("SELECT p.name, iprod.quantity, iprod.price FROM invoice_products iprod JOIN products p ON iprod.product_id = p.id WHERE iprod.invoice_id = ?", [inv.id]),
                db.all("SELECT d.name, idoc.price FROM invoice_doctors idoc JOIN doctors d ON idoc.doctor_id = d.id WHERE idoc.invoice_id = ?", [inv.id])
            ]);

            const items = [
                ...(servs || []).map(s => ({ ...s, type: 'service' })),
                ...(prods || []).map(p => ({ ...p, type: 'product' })),
                ...(docs || []).map(d => ({ ...d, type: 'doctor', quantity: 1 }))
            ];

            let dateStr = 'N/A';
            try {
                dateStr = format(new Date(inv.date), 'dd-MM-yy hh:mm a');
            } catch (e) {
                console.warn('Invalid date:', inv.date);
            }

            printReceipt(inv.invoice_number, currentPatient?.name || 'Unknown Patient', items, inv.total, dateStr);
        } catch (err) {
            console.error('Error preparing print:', err);
            alert('Failed to prepare invoice for printing.');
        }
    };

    const printReceipt = (invoiceNum, patientName, items, totalAmt, dateStr) => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '80mm';
        document.body.appendChild(iframe);

        const content = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Invoice ${invoiceNum}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { 
                            font-family: 'Courier New', Courier, monospace;
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
                        .grand-total { font-size: 12pt; font-weight: bold; }
                        .footer { margin-top: 6mm; text-align: center; font-size: 11pt; border-top: 1px dashed #000; padding-top: 2mm; line-height: 1.4; }
                    </style>
                </head>
                <body>
                    <div class="header">
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
                                <th>Item</th>
                                <th style="text-align: center;">Type</th>
                                <th style="text-align: center;">Qty</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => {
            let typeLabel = item.type === 'doctor' ? 'Visit' : item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '';
            return `
                                <tr>
                                    <td>${item.name}</td>
                                    <td style="text-align: center;">${typeLabel}</td>
                                    <td style="text-align: center;">${item.quantity}</td>
                                    <td style="text-align: right;">${(item.quantity * item.price).toFixed(0)}</td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                    <div class="total-section">
                        <div class="grand-total">TOTAL: Rs. ${totalAmt.toLocaleString()}</div>
                        <div style="font-size: 9pt; margin-top: 1mm; font-weight: 800; color: #10b981;">Status: PAID</div>
                    </div>
                    <div class="footer">
                        Thank you for visiting!<br>
                        PrimeSoft Agency - 0309-5369472
                    </div>
                </body>
            </html>
        `;

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(content);
        iframeDoc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        }, 800);
    };

    const saveSession = async (e) => {
        e.preventDefault();
        try {
            await db.run("INSERT INTO sessions (patient_id, date, description, laser, session, energy) VALUES (?, ?, ?, ?, ?, ?)",
                [currentPatient.id, sessionData.date, sessionData.description, sessionData.laser, sessionData.session, sessionData.energy]);
            setIsSessionModalOpen(false);
            fetchPatients();
        } catch (err) { console.error(err); }
    };

    const openSessionDetails = (session) => {
        setSelectedSession(session);
        setIsSessionDetailsModalOpen(true);
    };

    const handleDeleteSession = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run("DELETE FROM sessions WHERE id = ?", [id]);
                setDeleteSessionConfirm(null);
                if (currentPatient) loadSessions(currentPatient.id);
                fetchPatients();
            } catch (err) {
                console.error("Session deletion failed:", err);
                setDeleteSessionConfirm(null);
            }
        }, 'Delete Session');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentPatient) {
                const sql = `UPDATE patients SET name=?, gender=?, phone=?, address=?, medical_history=?, chronic_diseases=?, laser=?, session=? WHERE id=?`;
                await db.run(sql, [
                    formData.name, formData.gender, formData.phone,
                    formData.address, formData.medical_history, formData.chronic_diseases,
                    formData.laser, formData.session,
                    currentPatient.id
                ]);
            } else {
                const sql = `INSERT INTO patients (name, gender, phone, address, medical_history, chronic_diseases, laser, session) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                await db.run(sql, [
                    formData.name, formData.gender, formData.phone,
                    formData.address, formData.medical_history, formData.chronic_diseases,
                    formData.laser, formData.session
                ]);
            }
            setIsModalOpen(false);
            resetForm();
            fetchPatients();
        } catch (err) { console.error(err); }
    };

    const handleEdit = (patient) => {
        requestSecureAction(() => {
            setCurrentPatient(patient);
            setFormData(patient);
            setIsModalOpen(true);
        }, 'Edit Patient');
    };

    const handleDelete = async (id) => {
        requestSecureAction(async () => {
            try {
                // Cascade delete related records to avoid FK constraint issues
                const invoices = await db.all("SELECT id FROM invoices WHERE patient_id = ?", [id]);
                for (const inv of invoices) {
                    await db.run("DELETE FROM invoice_services WHERE invoice_id = ?", [inv.id]);
                    await db.run("DELETE FROM invoice_products WHERE invoice_id = ?", [inv.id]);
                }
                await db.run("DELETE FROM invoices WHERE patient_id = ?", [id]);
                await db.run("DELETE FROM appointments WHERE patient_id = ?", [id]);
                await db.run("DELETE FROM patients WHERE id = ?", [id]);

                setDeleteConfirm(null);
                fetchPatients();
                loadPatientStats();
            } catch (err) {
                console.error("Deletion failed:", err);
                setDeleteConfirm(null);
            }
        }, 'Delete Patient');
    };

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Patients</h1>
            {/* Patient Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Patient Overview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Patient Overview");
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
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Patients</span>
                            <h3 className="text-3xl font-semibold text-white font-sans tracking-tight">{patientStats.total}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Top Patient</span>
                            <h3 className="text-3xl font-semibold text-amber-400 font-sans tracking-tight">
                                {patientStats.topPatient ? patientStats.topPatient.name : 'N/A'}
                            </h3>
                            {patientStats.topPatient && (
                                <p className="text-xs text-gray-500 mt-1 font-semibold">
                                    {patientStats.topPatient.total_visits} visits • Rs. {patientStats.topPatient.total_spent.toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Sessions</span>
                            <h3 className="text-3xl font-semibold text-blue-400 font-sans tracking-tight">{patientStats.totalSessions}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Bills</span>
                            <h3 className="text-3xl font-semibold text-emerald-400 font-sans tracking-tight">{patientStats.totalBills}</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg">
                <div className="flex items-center gap-4 flex-1 max-w-4xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            className="w-full bg-primary-bg pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500 transition-all font-sans"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="latest" className="bg-gray-900">Latest First</option>
                            <option value="alpha" className="bg-gray-900">Name (A-Z)</option>
                            <option value="sessions-desc" className="bg-gray-900">Sessions: High to Low</option>
                            <option value="sessions-asc" className="bg-gray-900">Sessions: Low to High</option>
                            <option value="visits-desc" className="bg-gray-900">Visits: High to Low</option>
                            <option value="visits-asc" className="bg-gray-900">Visits: Low to High</option>
                            <option value="spent-desc" className="bg-gray-900">Spent: High to Low</option>
                            <option value="spent-asc" className="bg-gray-900">Spent: Low to High</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Users size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={genderFilter}
                            onChange={(e) => setGenderFilter(e.target.value)}
                        >
                            <option value="All" className="bg-gray-900">All Genders</option>
                            <option value="Male" className="bg-gray-900">Male</option>
                            <option value="Female" className="bg-gray-900">Female</option>
                            <option value="Other" className="bg-gray-900">Other</option>
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); fetchPatients(); loadPatientStats(); }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-colors font-semibold"
                >
                    <Plus size={18} /> Add Patient
                </button>
            </div>

            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">Count:</span>
                    <span className="text-white font-semibold text-sm">{patients.length}</span>
                </div>

                <div className="flex bg-[#1a2233] p-1 rounded-xl border border-gray-800 shadow-inner">
                    {['Today', 'Week', 'Month', 'All Patients'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setPatientDateFilter(filter)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${patientDateFilter === filter
                                ? 'bg-cyan-600 text-white shadow-lg'
                                : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-secondary-bg rounded-2xl border border-gray-800 flex-1 flex flex-col overflow-hidden shadow-xl min-h-[400px]">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-gray-300 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                            <tr>
                                {/* <th className="table-header-cell">ID</th> */}
                                <th className="table-header-cell">Name</th>
                                <th className="table-header-cell">Contact</th>
                                <th className="table-header-cell text-center">Bills</th>
                                <th className="table-header-cell text-center">Sessions</th>
                                <th className="table-header-cell text-center font-bold text-teal-400">Total Visits</th>
                                <th className="table-header-cell text-center font-bold text-emerald-400">Total Spent</th>
                                <th className="table-header-cell text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {loading ? (
                                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Loading patients...</td></tr>
                            ) : patients.length === 0 ? (
                                <tr><td colSpan="7" className="p-8 text-center text-gray-500 italic py-10">No patients found.</td></tr>
                            ) : (
                                patients.map(patient => (
                                    <tr key={patient.id} className="hover:bg-gray-800/30 transition-colors group">
                                        {/* <td className="table-data-cell text-white text-sm">#{patient.id}</td> */}
                                        <td
                                            className="table-data-cell cursor-pointer hover:text-teal-400 transition-colors"
                                            onClick={() => navigate(`/patients/${patient.id}`)}
                                        >
                                            <div className="text-white text-sm hover:underline">{patient.name}</div>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="text-gray-200">{patient.phone}</div>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <div className="text-gray-200">{patient.bills_count || 0}</div>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <div className="text-gray-200">{patient.sessions_count || 0}</div>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <div className="text-white font-bold">{(patient.bills_count || 0) + (patient.sessions_count || 0)}</div>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <div className="text-emerald-400 font-bold">Rs. {(patient.total_spent || 0).toLocaleString()}</div>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleAddSession(patient)}
                                                    className="p-2 text-white hover:text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-all"
                                                    title="Add Session"
                                                >
                                                    <Plus size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewSessions(patient)}
                                                    className="p-2 text-white hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                                                    title="View Sessions"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                {deleteConfirm === patient.id ? (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                        <button
                                                            onClick={() => handleDelete(patient.id)}
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
                                                            onClick={() => handleEdit(patient)}
                                                            className="p-2 text-white hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all"
                                                            title="Edit Patient"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(patient.id)}
                                                            className="p-2 text-red-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"
                                                            title="Delete Patient"
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
            </div >

            {isModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-800/30">
                            <h3 className="text-xl font-bold text-white">{currentPatient ? 'Edit Patient' : 'Register New Patient'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><div className="w-6 h-6">✕</div></button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Full Name *</label>
                                    <input required type="text" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Gender</label>
                                    <select className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                                        value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                        <option>Male</option>
                                        <option>Female</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Phone *</label>
                                    <input required type="text" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                                        value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Address</label>
                                    <input type="text" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                                        value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Laser</label>
                                    <input type="text" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                                        value={formData.laser} onChange={e => setFormData({ ...formData, laser: e.target.value })} placeholder="Laser type..." />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Session (Energy Levels)</label>
                                    <select className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                                        value={formData.session} onChange={e => setFormData({ ...formData, session: e.target.value })}>
                                        <option value="">Select Level</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(level => <option key={level} value={level}>{level}</option>)}
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Medical History</label>
                                    <textarea rows="3" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white focus:border-teal-500 outline-none"
                                        value={formData.medical_history} onChange={e => setFormData({ ...formData, medical_history: e.target.value })} placeholder="Previous surgeries, treatments, etc..." ></textarea>
                                </div>

                                <div className="flex gap-2 pt-4 col-span-2">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all">Cancel</button>
                                    <button type="submit" className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all">Save Patient</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Add Session Modal */}
            <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title={`Add Session - ${currentPatient?.name}`}>
                <form onSubmit={saveSession} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Date</label>
                        <input required type="date" className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                            value={sessionData.date} onChange={e => setSessionData({ ...sessionData, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Laser</label>
                        <input
                            type="text"
                            className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                            value={sessionData.laser}
                            onChange={e => setSessionData({ ...sessionData, laser: e.target.value })}
                            placeholder="Laser type..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Session</label>
                            <input
                                type="text"
                                className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                value={sessionData.session}
                                onChange={e => setSessionData({ ...sessionData, session: e.target.value })}
                                placeholder="Session no..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Energy (1-30)</label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                value={sessionData.energy}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 30)) {
                                        setSessionData({ ...sessionData, energy: val });
                                    }
                                }}
                                placeholder="Level..."
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Description</label>
                        <textarea rows="5" className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                            value={sessionData.description} onChange={e => setSessionData({ ...sessionData, description: e.target.value })} placeholder="Session details..."></textarea>
                    </div>
                    <div className="flex gap-2 pt-4">
                        <button type="button" onClick={() => setIsSessionModalOpen(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all">Cancel</button>
                        <button type="submit" className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all">Save Session</button>
                    </div>
                </form>
            </Modal>

            {/* View Sessions List Modal */}
            {
                isViewSessionsModalOpen && (
                    <div onClick={(e) => { if (e.target === e.currentTarget) setIsViewSessionsModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-secondary-bg w-full max-w-4xl rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
                            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="text-blue-400" /> Sessions - {currentPatient?.name}
                                </h3>
                                <button onClick={() => setIsViewSessionsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-4 border-b border-gray-800 bg-gray-900/30 flex justify-between items-center gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search sessions..."
                                        className="w-full bg-[#1a2233] pl-9 pr-4 py-2 rounded-xl border border-gray-700 text-white text-sm outline-none focus:border-blue-500 transition-all placeholder-gray-500"
                                        value={sessionSearch}
                                        onChange={(e) => setSessionSearch(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="bg-[#1a2233] px-3 py-2 rounded-xl border border-gray-700 text-white text-sm outline-none focus:border-blue-500 transition-all cursor-pointer"
                                    value={sessionSort}
                                    onChange={(e) => setSessionSort(e.target.value)}
                                >
                                    <option value="latest">Latest First</option>
                                    <option value="oldest">Oldest First</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <span className="text-white font-semibold text-sm">Count:</span>
                                <span className="text-white font-semibold text-sm">{patientSessions.length}</span>
                            </div>

                            <div className="flex-1 overflow-hidden flex divide-x divide-gray-800">
                                {/* Sessions Column */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="p-3 bg-gray-800/20 border-b border-gray-800 flex justify-between items-center">
                                        <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            <FileText size={16} /> Sessions ({patientSessions.length})
                                        </h4>
                                    </div>
                                    <div className="flex-1 overflow-auto custom-scrollbar">
                                        {patientSessions.length === 0 ? (
                                            <div className="text-center text-gray-500 italic py-10">No sessions found.</div>
                                        ) : (
                                            <table className="w-full text-left text-gray-300">
                                                <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                                                    <tr>
                                                        <th className="table-header-cell text-xs py-2">Date</th>
                                                        <th className="table-header-cell text-center text-xs py-2 w-24">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {patientSessions.map(session => (
                                                        <tr key={session.id} className="hover:bg-gray-800/30 transition-colors group">
                                                            <td className="table-data-cell py-2 text-[13px] text-white">
                                                                {format(new Date(session.date), 'dd MMM yy')} ({format(new Date(session.created_at || session.date), 'p')})
                                                            </td>
                                                            <td className="table-data-cell py-2">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button onClick={() => openSessionDetails(session)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"><Eye size={16} /></button>
                                                                    <button onClick={() => setDeleteSessionConfirm(session.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={16} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>

                                {/* Bills Column */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="p-3 bg-gray-800/20 border-b border-gray-800 flex justify-between items-center">
                                        <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                            <DollarSign size={16} /> Bills ({patientInvoices.length})
                                        </h4>
                                    </div>
                                    <div className="flex-1 overflow-auto custom-scrollbar">
                                        {patientInvoices.length === 0 ? (
                                            <div className="text-center text-gray-500 italic py-10">No bills found.</div>
                                        ) : (
                                            <table className="w-full text-left text-gray-300">
                                                <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                                                    <tr>
                                                        <th className="table-header-cell text-xs py-2">Invoice / Date</th>
                                                        <th className="table-header-cell text-right text-xs py-2">Total</th>

                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {patientInvoices.map(inv => (
                                                        <tr key={inv.id} className="hover:bg-gray-800/30 transition-colors group">
                                                            <td className="table-data-cell py-2">
                                                                <div className="text-[13px] text-white font-bold">#{inv.invoice_number}</div>
                                                                <div className="text-[11px] text-gray-500">{format(new Date(inv.date), 'dd MMM yy')}</div>
                                                            </td>
                                                            <td className="table-data-cell py-2 text-right text-[13px] text-emerald-400 font-bold">
                                                                Rs. {inv.total.toLocaleString()}
                                                            </td>

                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Session Details Modal */}
            <Modal isOpen={isSessionDetailsModalOpen} onClose={() => setIsSessionDetailsModalOpen(false)} title="Session Details">
                {selectedSession && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-700">
                            <div className="bg-blue-500/10 p-3 rounded-xl text-blue-400">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">
                                    {new Date(selectedSession.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    {selectedSession.created_at ? `, ${format(new Date(selectedSession.created_at + ' Z'), 'hh:mm a')}` : ''}
                                </h3>
                                <p className="text-gray-400 text-sm">Patient: {currentPatient?.name}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-[#1a2233] rounded-xl border border-gray-700 space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Laser</h4>
                                <p className="text-white font-medium">{selectedSession.laser || '-'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700/30">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Session</h4>
                                    <p className="text-white font-medium">{selectedSession.session || '-'}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Energy</h4>
                                    <p className="text-emerald-400 font-bold">{selectedSession.energy || '-'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Description</h4>
                                <div className="bg-[#1a2233] p-4 rounded-xl border border-gray-700 text-white leading-relaxed min-h-[150px]">
                                    {selectedSession.description || <span className="text-gray-500 italic">No description provided.</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-800">
                            <button onClick={() => setIsSessionDetailsModalOpen(false)} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <PasswordModal
                isOpen={secureAction.isOpen}
                onClose={() => setSecureAction({ ...secureAction, isOpen: false })}
                onVerified={secureAction.onVerified}
                actionName={secureAction.actionName}
            />
        </div>
    );
};

export default Patients;
