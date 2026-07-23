import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Calendar, DollarSign, Activity, FileText, User, Phone, MapPin, Droplet, Weight, AlertCircle, Clock, Printer, Eye, ExternalLink, X } from 'lucide-react';
import db from '../../database/db';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import PasswordModal from '../common/PasswordModal';

const PatientDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [visits, setVisits] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [stats, setStats] = useState({ totalVisits: 0, totalBills: 0, totalSpent: 0, totalSessions: 0 });
    const [selectedSession, setSelectedSession] = useState(null);
    const [isSessionDetailsModalOpen, setIsSessionDetailsModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '', gender: 'Male', phone: '',
        address: '', medical_history: '',
        chronic_diseases: '', laser: '', session: ''
    });

    const safeFormat = (dateVal, formatStr) => {
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return 'N/A';
            return format(d, formatStr);
        } catch {
            return 'N/A';
        }
    };

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const loadPatientData = async () => {
        try {
            setLoading(true);

            // Get patient details
            const patientData = await db.get("SELECT * FROM patients WHERE id = ?", [id]);
            if (!patientData) {
                navigate('/patients');
                return;
            }
            setPatient(patientData);
            setFormData({
                name: patientData.name || '',
                gender: patientData.gender || 'Male',
                phone: patientData.phone || '',
                address: patientData.address || '',
                medical_history: patientData.medical_history || '',
                chronic_diseases: patientData.chronic_diseases || '',
                laser: patientData.laser || '',
                session: patientData.session || ''
            });

            // Get appointments
            const appointmentsData = await db.all(`
                SELECT a.*, d.name as doctor_name 
                FROM appointments a
                LEFT JOIN doctors d ON a.doctor_id = d.id
                WHERE a.patient_id = ?
                ORDER BY a.date DESC, a.time DESC
                LIMIT 10
            `, [id]);
            setAppointments(appointmentsData || []);

            // Get invoices
            const invoicesData = await db.all(`
                SELECT * FROM invoices 
                WHERE patient_id = ?
                ORDER BY date DESC
                LIMIT 10
            `, [id]);
            setInvoices(invoicesData || []);

            // Get sessions
            const sessionsData = await db.all(`
                SELECT s.*, d.name as doctor_name 
                FROM sessions s
                LEFT JOIN doctors d ON s.doctor_id = d.id
                WHERE s.patient_id = ?
                ORDER BY s.date DESC, s.created_at DESC
                LIMIT 10
            `, [id]);
            setSessions(sessionsData || []);

            // Calculate stats
            const totalBillsCount = await db.get("SELECT COUNT(*) as count FROM invoices WHERE patient_id = ?", [id]);
            const totalSessionsCount = await db.get("SELECT COUNT(*) as count FROM sessions WHERE patient_id = ?", [id]);
            const totalSpentSum = await db.get("SELECT SUM(total) as sum FROM invoices WHERE patient_id = ? AND status = 'paid'", [id]);

            setStats({
                totalBills: totalBillsCount?.count || 0,
                totalSessions: totalSessionsCount?.count || 0,
                totalVisits: (totalBillsCount?.count || 0) + (totalSessionsCount?.count || 0),
                totalSpent: totalSpentSum?.sum || 0
            });

            setLoading(false);
        } catch (err) {
            console.error('Error loading patient data:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadPatientData();
        }
    }, [id]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            if (id) loadPatientData();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [id]);

    const handleOpenEditModal = () => {
        requestSecureAction(() => {
            setFormData({
                name: patient.name || '',
                gender: patient.gender || 'Male',
                phone: patient.phone || '',
                address: patient.address || '',
                medical_history: patient.medical_history || '',
                chronic_diseases: patient.chronic_diseases || '',
                laser: patient.laser || '',
                session: patient.session || ''
            });
            setIsEditModalOpen(true);
        }, "Edit Patient Details");
    };

    const handleUpdatePatient = async (e) => {
        e.preventDefault();
        try {
            const res = await db.run(`
                UPDATE patients 
                SET name=?, gender=?, phone=?, address=?, 
                    medical_history=?, chronic_diseases=?, laser=?, session=?
                WHERE id=?
            `, [
                formData.name,
                formData.gender,
                formData.phone,
                formData.address,
                formData.medical_history,
                formData.chronic_diseases,
                formData.laser,
                formData.session,
                id
            ]);

            if (res && res.error) {
                console.error('Update failed:', res.error);
                alert('Failed to update patient: ' + res.error);
                return;
            }

            setIsEditModalOpen(false);
            await loadPatientData();
        } catch (err) {
            console.error('Error updating patient:', err);
            alert('An error occurred while updating the patient.');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'cancelled': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            case 'paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    const handlePrintInvoice = async (inv) => {
        try {
            // Fetch invoice items
            const [servs, prods, docs] = await Promise.all([
                db.all("SELECT s.name, iserv.quantity, iserv.price, iserv.discount FROM invoice_services iserv JOIN services s ON iserv.service_id = s.id WHERE iserv.invoice_id = ?", [inv.id]),
                db.all("SELECT p.name, iprod.quantity, iprod.price, iprod.discount FROM invoice_products iprod JOIN products p ON iprod.product_id = p.id WHERE iprod.invoice_id = ?", [inv.id]),
                db.all("SELECT d.name, idoc.price, idoc.discount FROM invoice_doctors idoc JOIN doctors d ON idoc.doctor_id = d.id WHERE idoc.invoice_id = ?", [inv.id])
            ]);

            const items = [
                ...(servs || []).map(s => ({ ...s, type: 'service', discount: s.discount || 0 })),
                ...(prods || []).map(p => ({ ...p, type: 'product', discount: p.discount || 0 })),
                ...(docs || []).map(d => ({ ...d, type: 'doctor', quantity: 1, discount: d.discount || 0 }))
            ];

            let dateStr = 'N/A';
            try {
                dateStr = format(new Date(inv.date), 'dd-MM-yy hh:mm a');
            } catch (e) {
                console.warn('Invalid date:', inv.date);
            }

            printReceipt(inv.invoice_number, patient?.name || 'Unknown Patient', items, inv.total, dateStr, inv.discount);
        } catch (err) {
            console.error('Error preparing print:', err);
            alert('Failed to prepare invoice for printing.');
        }
    };

    const printReceipt = (invoiceNum, patientName, items, totalAmt, dateStr, discount = 0) => {
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
                                    <td style="font-weight: 600;">${item.name}</td>
                                    <td style="text-align: right; font-weight: 600;">${(item.price || 0).toLocaleString()}</td>
                                    <td style="text-align: center; font-weight: 500;">${item.quantity}</td>
                                    <td style="text-align: right;">${(item.discount || 0).toLocaleString()}</td>
                                    <td style="text-align: right;">${((item.quantity * item.price) - (item.discount || 0)).toLocaleString()}</td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                    <div class="total-section">
                        <div style="font-size: 10pt; margin-bottom: 1mm;">Subtotal: Rs. ${items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0).toLocaleString()}</div>
                        <div style="font-size: 10pt; margin-bottom: 1mm;">Discounts: - Rs. ${(items.reduce((acc, curr) => acc + (curr.discount || 0), 0) + (discount || 0)).toLocaleString()}</div>
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

        // Increased timeout to ensure content is rendered in Electron
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            // Clean up
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        }, 800);
    };

    if (loading) {
        return (
            <div className="p-6 h-screen flex items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="p-6 h-screen flex items-center justify-center">
                <p className="text-gray-500">Patient not found</p>
            </div>
        );
    }

    return (
        <div className="p-6 h-screen overflow-y-auto custom-scrollbar flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/patients')}
                        className="p-2 hover:bg-gray-800 rounded-xl transition-all text-gray-400 hover:text-white"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight">
                            {patient.name}
                        </h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Patient ID: #{patient.id}</p>
                            <div className="h-3 w-[1px] bg-gray-700"></div>
                            <span className="text-[11px] text-gray-400 font-medium italic">
                                Customer since: {patient.created_at ? safeFormat(patient.created_at + ' Z', 'dd MMM yy, p') : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleOpenEditModal}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
                >
                    <Edit2 size={18} />
                    Edit Details
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-cyan-500/10 rounded-xl">
                            <Activity size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Total Visits</p>
                            <h3 className="text-2xl font-bold text-white font-sans">{stats.totalVisits}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 hover:border-amber-500/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-amber-500/10 rounded-xl">
                            <FileText size={24} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Total Bills</p>
                            <h3 className="text-2xl font-bold text-white font-sans">{stats.totalBills}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 hover:border-blue-500/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Calendar size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Total Sessions</p>
                            <h3 className="text-2xl font-bold text-white font-sans">{stats.totalSessions}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                            <DollarSign size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Total Spent</p>
                            <h3 className="text-2xl font-bold text-white font-sans">Rs. {stats.totalSpent.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Patient Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="bg-secondary-bg border border-gray-800 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <User size={20} className="text-teal-400" />
                        Basic Information
                    </h2>
                    <div className="overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-white/10">
                                <tr>
                                    <td className="py-3 text-gray-300 text-sm font-bold">Gender</td>
                                    <td className="py-3 text-white text-right">{patient.gender}</td>
                                </tr>
                                <tr>
                                    <td className="py-3 text-gray-300 text-sm font-bold">Phone</td>
                                    <td className="py-3 text-white font-mono text-right">{patient.phone || 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td className="py-3 text-gray-300 text-sm font-bold align-top">Address</td>
                                    <td className="py-3 text-white text-right max-w-xs">{patient.address || 'N/A'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Medical Info */}
                <div className="bg-secondary-bg border border-gray-800 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-rose-400" />
                        Medical Information
                    </h2>
                    <div className="overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-white/10">
                                <tr>
                                    <td className="py-3 text-gray-300 text-sm font-bold">Laser</td>
                                    <td className="py-3 text-white text-right">{patient.laser || 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td className="py-3 text-gray-300 text-sm font-bold">Energy Level</td>
                                    <td className="py-3 text-white text-right">{sessions.length > 0 && sessions[0].energy ? sessions[0].energy : 'N/A'}</td>
                                </tr>

                                <tr>
                                    <td className="py-3 text-gray-300 text-sm font-bold align-top">Medical History</td>
                                    <td className="py-3 text-white text-sm text-right align-top whitespace-pre-wrap">{patient.medical_history || 'No medical history recorded.'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Appointments and Invoices Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Patient Sessions */}
                <div className="bg-secondary-bg border border-gray-800 rounded-2xl p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-cyan-400" />
                        Patient Sessions
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="text-gray-500 font-semibold text-[13px]">Count:</span>
                            <span className="text-cyan-500 font-bold text-[13px]">{sessions.length}</span>
                        </div>
                    </h2>
                    {sessions.length === 0 ? (
                        <p className="text-gray-500 text-center py-8 italic">No sessions recorded yet</p>
                    ) : (
                        <div className="space-y-3">
                            {sessions.slice(0, 5).map(session => (
                                <div key={session.id} className="bg-[#121826] border border-gray-800/60 p-5 rounded-2xl hover:border-cyan-500/40 hover:bg-[#161d2d] transition-all group flex justify-between items-center shadow-sm relative overflow-hidden">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 to-blue-600 opacity-70"></div>
                                    <div className="flex-1 pl-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-cyan-300 text-[17px] font-normal tracking-wide">{safeFormat(session.date, 'dd MMM yy')}</span>
                                                    {session.created_at && (
                                                        <span className="text-gray-400 text-[13px] font-medium">
                                                            {safeFormat(session.created_at + ' Z', 'hh:mm a')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-gray-400 text-[11px] font-medium uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                                    <User size={12} className="text-gray-500" />
                                                    {session.doctor_name ? `Dr. ${session.doctor_name}` : 'No doctor'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                {session.energy && (
                                                    <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                                        <Activity size={12} className="text-emerald-400" />
                                                        <span className="text-emerald-400 font-medium text-[13px]">
                                                            Level {session.energy}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedSession(session);
                                            setIsSessionDetailsModalOpen(true);
                                        }}
                                        className="p-2.5 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 text-cyan-400 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:from-cyan-500/20 hover:to-blue-500/20 ml-5 border border-cyan-500/20"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Invoices */}
                <div className="bg-secondary-bg border border-gray-800 rounded-2xl p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <FileText size={20} className="text-emerald-400" />
                        Recent Invoices
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="text-gray-500 font-semibold text-[13px]">Count:</span>
                            <span className="text-blue-500 font-bold text-[13px]">{invoices.length}</span>
                        </div>
                    </h2>
                    {invoices.length === 0 ? (
                        <p className="text-gray-500 text-center py-8 italic">No invoices found</p>
                    ) : (
                        <div className="space-y-2">
                            {invoices.map(inv => (
                                <div key={inv.id} className="bg-[#121826] border border-gray-800 p-3 rounded-xl hover:border-emerald-500/30 transition-all">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-white font-bold text-sm">Invoice #{inv.invoice_number}</p>
                                            <p className="text-gray-500 text-xs">{safeFormat(inv.date, 'dd MMM yy, p')}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-emerald-400 font-bold text-base">Rs. {inv.total.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Appointments Section */}
            <div className="bg-secondary-bg border border-gray-800 rounded-2xl p-6 flex flex-col mb-6">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Calendar size={20} className="text-blue-400" />
                    Patient Appointments
                    <div className="ml-auto flex items-center gap-1.5">
                        <span className="text-gray-500 font-semibold text-[13px]">Count:</span>
                        <span className="text-blue-500 font-bold text-[13px]">{appointments.length}</span>
                    </div>
                </h2>
                {appointments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8 italic">No appointments found</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {appointments.map(apt => (
                            <div key={apt.id} className="bg-[#121826] border border-gray-800 p-4 rounded-xl hover:border-teal-500/30 transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-blue-400 font-bold text-sm">{safeFormat(apt.date, 'dd MMM yy')}</p>
                                        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest mt-0.5">
                                            {apt.doctor_name || 'No doctor assigned'}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${getStatusColor(apt.status)}`}>
                                        {apt.status}
                                    </span>
                                </div>
                                <p className="text-gray-300 text-sm italic mb-2">"{apt.reason}"</p>
                                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                    <Clock size={12} /> {safeFormat(`2000-01-01T${apt.time}`, 'p')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsEditModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-3xl rounded-2xl border border-gray-700 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Edit Patient Details</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleUpdatePatient} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1 font-bold">Name *</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                        value={formData.name || ''}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1 font-bold">Gender</label>
                                    <select
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                        value={formData.gender || 'Male'}
                                        onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1 font-bold">Phone *</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                        value={formData.phone || ''}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1 font-bold">Address</label>
                                    <input
                                        type="text"
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                        value={formData.address || ''}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1 font-bold">Laser</label>
                                    <input
                                        type="text"
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                        value={formData.laser || ''}
                                        onChange={e => setFormData({ ...formData, laser: e.target.value })}
                                        placeholder="Laser type..."
                                    />
                                </div>
                                <div className="hidden">
                                    <label className="block text-sm text-gray-400 mb-1 font-bold">Session (Energy Levels)</label>
                                    <select
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                        value={formData.session || ''}
                                        onChange={e => setFormData({ ...formData, session: e.target.value })}
                                    >
                                        <option value="">Select Level</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(level => <option key={level} value={level}>{level}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1 font-bold">Medical History</label>
                                <textarea
                                    rows="4"
                                    className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                                    value={formData.medical_history || ''}
                                    onChange={e => setFormData({ ...formData, medical_history: e.target.value })}
                                    placeholder="Previous surgeries, treatments, medications, etc..."
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-all uppercase tracking-widest"
                            >
                                Update Patient
                            </button>
                        </form>
                    </div>
                </div>
            )}


            <PasswordModal
                isOpen={secureAction.isOpen}
                onClose={() => setSecureAction({ ...secureAction, isOpen: false })}
                onVerified={secureAction.onVerified}
                actionName={secureAction.actionName}
            />

            {/* Session Details Modal */}
            {isSessionDetailsModalOpen && selectedSession && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsSessionDetailsModalOpen(false); }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-2xl rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Activity className="text-cyan-400" /> Session Details - {safeFormat(selectedSession.date, 'dd MMM yy')}{selectedSession.created_at ? `, ${safeFormat(selectedSession.created_at + ' Z', 'hh:mm a')}` : ''}
                            </h3>
                            <button onClick={() => setIsSessionDetailsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-[#121826] p-4 rounded-xl border border-gray-800">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Date</p>
                                    <p className="text-white font-semibold">{safeFormat(selectedSession.date, 'PPP')}</p>
                                </div>
                                <div className="bg-[#121826] p-4 rounded-xl border border-gray-800">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Doctor</p>
                                    <p className="text-white font-semibold">{selectedSession.doctor_name || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-[#121826] rounded-xl border border-gray-800 space-y-4">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Laser</p>
                                    <p className="text-white font-semibold">{selectedSession.laser || '-'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800/30">
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Session</p>
                                        <p className="text-white font-semibold">{selectedSession.session || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Energy</p>
                                        <p className="text-emerald-400 font-bold">{selectedSession.energy || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <FileText size={16} /> Description
                                </h4>
                                <div className="bg-[#121826] p-5 rounded-2xl border border-gray-800 min-h-[150px] text-gray-200 leading-relaxed italic">
                                    {selectedSession.description || 'No description recorded for this session.'}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-800 bg-gray-800/10 flex justify-end">
                            <button
                                onClick={() => setIsSessionDetailsModalOpen(false)}
                                className="px-8 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDetails;
