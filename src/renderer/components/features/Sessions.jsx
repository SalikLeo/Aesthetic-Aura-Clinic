import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Calendar as CalIcon, User, FileText, Edit2, Trash2, Check, X, Eye, EyeOff, Printer } from 'lucide-react';
import db from '../../database/db';
import { format } from 'date-fns';
import PasswordModal from '../common/PasswordModal';

const Sessions = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [filterDoctor, setFilterDoctor] = useState('all');
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [showStats, setShowStats] = useState(false);
    const [sessionStats, setSessionStats] = useState({ total: 0, topPatient: 'None', topDoctor: 'None' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };
    const [viewingSession, setViewingSession] = useState(null);
    const [formData, setFormData] = useState({
        patient_id: '',
        doctor_id: '',
        description: '',
        laser: '',
        session: '',
        energy: ''
    });
    const [error, setError] = useState('');

    // Patient Search States
    const [isNewPatient, setIsNewPatient] = useState(false);
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientPhone, setNewPatientPhone] = useState('');
    const [patientDropdownSearch, setPatientDropdownSearch] = useState('');
    const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
    const patientSearchRef = useRef(null);

    // Doctor Search States
    const [doctorDropdownSearch, setDoctorDropdownSearch] = useState('');
    const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
    const doctorSearchRef = useRef(null);

    const loadSessions = async () => {
        try {
            let query = `
                SELECT s.*, p.name as patient_name, p.phone as patient_phone, d.name as doctor_name
                FROM sessions s
                LEFT JOIN patients p ON s.patient_id = p.id
                LEFT JOIN doctors d ON s.doctor_id = d.id
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += ` AND (p.name LIKE ? OR s.description LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }

            // Apply period filter
            if (statsPeriod === 'Daily') {
                query += ` AND date(s.date) = date('now', 'localtime')`;
            } else if (statsPeriod === 'Weekly') {
                query += ` AND date(s.date) >= date('now', 'localtime', '-7 days')`;
            } else if (statsPeriod === 'Monthly') {
                query += ` AND date(s.date) >= date('now', 'localtime', 'start of month')`;
            } else if (statsPeriod === 'Annual') {
                query += ` AND date(s.date) >= date('now', 'localtime', 'start of year')`;
            }

            if (filterDoctor !== 'all') {
                query += ` AND s.doctor_id = ?`;
                params.push(filterDoctor);
            }

            if (sortBy === 'latest') query += ` ORDER BY s.date DESC, s.id DESC`;
            else if (sortBy === 'oldest') query += ` ORDER BY s.date ASC, s.id ASC`;
            else if (sortBy === 'patient') query += ` ORDER BY p.name ASC`;

            const data = await db.all(query, params);
            setSessions(data || []);
        } catch (err) {
            console.error('Error loading sessions:', err);
        }
    };

    const loadSessionStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date(date) = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date(date) >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date(date) >= date('now', 'localtime', 'start of year')";

            const totalRes = await db.get(`SELECT COUNT(*) as count FROM sessions ${dateFilter ? 'WHERE ' + dateFilter : ''}`);

            const topPatRes = await db.get(`
                SELECT p.name, COUNT(s.id) as count 
                FROM sessions s 
                JOIN patients p ON s.patient_id = p.id 
                ${dateFilter ? 'WHERE ' + dateFilter.replace('date(date)', 'date(s.date)') : ''}
                GROUP BY s.patient_id 
                ORDER BY count DESC 
                LIMIT 1
            `);

            const topDocRes = await db.get(`
                SELECT d.name, COUNT(s.id) as count 
                FROM sessions s 
                JOIN doctors d ON s.doctor_id = d.id 
                ${dateFilter ? 'WHERE ' + dateFilter.replace('date(date)', 'date(s.date)') : ''}
                GROUP BY s.doctor_id 
                ORDER BY count DESC 
                LIMIT 1
            `);

            setSessionStats({
                total: totalRes?.count || 0,
                topPatient: topPatRes ? `${topPatRes.name} (${topPatRes.count})` : 'None',
                topDoctor: topDocRes ? `${topDocRes.name} (${topDocRes.count})` : 'None'
            });
        } catch (err) {
            console.error('Error loading session stats:', err);
        }
    };

    const loadPatients = async () => {
        try {
            const data = await db.all(`
                SELECT p.id, p.name, p.phone, 
                       COUNT(DISTINCT s.id) as visit_count
                FROM patients p
                LEFT JOIN sessions s ON p.id = s.patient_id
                GROUP BY p.id, p.name, p.phone
                ORDER BY visit_count DESC, p.name ASC
            `);
            setPatients(data || []);
        } catch (err) {
            console.error('Error loading patients:', err);
        }
    };

    const loadDoctors = async () => {
        try {
            const data = await db.all(`SELECT id, name FROM doctors ORDER BY name ASC`);
            setDoctors(data || []);
        } catch (err) {
            console.error('Error loading doctors:', err);
        }
    };

    useEffect(() => {
        loadSessions();
        loadSessionStats();
    }, [search, sortBy, statsPeriod, filterDoctor]);

    useEffect(() => {
        loadPatients();
        loadDoctors();
    }, []);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadSessions();
            loadSessionStats();
            loadPatients();
            loadDoctors();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, sortBy, statsPeriod, filterDoctor]);

    useEffect(() => {
        if (location.state?.openNewSession) {
            setEditingSession(null);
            resetForm();
            setIsModalOpen(true);
            // Clear location state to prevent modal from re-opening on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (patientSearchRef.current && !patientSearchRef.current.contains(event.target)) {
                setIsPatientDropdownOpen(false);
            }
            if (doctorSearchRef.current && !doctorSearchRef.current.contains(event.target)) {
                setIsDoctorDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [patientSearchRef, doctorSearchRef]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let patientId = formData.patient_id;

            if (isNewPatient) {
                if (!newPatientName) {
                    setError('Please enter patient name');
                    return;
                }
                // Create new patient
                await db.run(
                    "INSERT INTO patients (name, phone, created_at) VALUES (?, ?, ?)",
                    [newPatientName, newPatientPhone, new Date().toISOString()]
                );
                const lastPatRow = await db.get("SELECT last_insert_rowid() as id");
                patientId = lastPatRow.id;
            }

            if (!patientId) {
                setError('Please select a patient');
                return;
            }
            if (!formData.doctor_id) {
                setError('Please select a doctor');
                return;
            }

            setError('');

            if (editingSession) {
                await db.run(
                    `UPDATE sessions SET patient_id=?, doctor_id=?, description=?, laser=?, session=?, energy=? WHERE id=?`,
                    [patientId, formData.doctor_id, formData.description, formData.laser, formData.session, formData.energy, editingSession.id]
                );
            } else {
                await db.run(
                    `INSERT INTO sessions (patient_id, doctor_id, description, laser, session, energy, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [patientId, formData.doctor_id, formData.description, formData.laser, formData.session, formData.energy, new Date().toISOString()]
                );
            }
            setError('');
            setIsModalOpen(false);
            setEditingSession(null);
            resetForm();
            loadSessions();
            loadSessionStats();
            loadPatients(); // Reload patients to include new one
        } catch (err) {
            console.error('Error saving session:', err);
        }
    };

    const printSession = (session) => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '80mm';
        document.body.appendChild(iframe);

        const dateStr = format(new Date(session.date), 'dd-MM-yy');
        const timeStr = session.created_at ? format(new Date(session.created_at + ' Z'), 'hh:mm a') : '';
        const timestamp = Date.now();

        iframe.contentDocument.write(`
            <html>
                <head>
                    <title>Session - ${session.patient_name}</title>
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
                        .receipt-info { font-size: 11pt; margin-bottom: 2mm; line-height: 1.3; color: #000; }
                        .section-title { text-align: center; font-weight: 700; margin-bottom: 2mm; tracking-spacing: 0.3em; text-transform: uppercase; font-size: 9pt; color: #000; font-family: 'Montserrat', sans-serif; border-top: 1px dotted #000; padding-top: 2mm; }
                        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; margin-bottom: 2mm; border: 1px solid #000; padding: 2mm; }
                        .detail-item { margin-bottom: 1mm; }
                        .detail-label { font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #000; }
                        .detail-value { font-size: 10pt; font-weight: 600; }
                        .description-title { font-size: 9pt; font-weight: 800; text-transform: uppercase; margin-bottom: 1mm; text-align: center; font-family: 'Montserrat', sans-serif; }
                        .description-box { border: 1px solid #000; padding: 2mm; min-height: 20mm; font-size: 10pt; line-height: 1.4; white-space: pre-wrap; font-weight: 500; }
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
                            <span><strong>Session Date:</strong> ${dateStr}</span>
                            <span><strong>Time:</strong> ${timeStr}</span>
                        </div>
                        <div style="margin-top: 1mm;"><strong>Patient:</strong> ${session.patient_name}</div>
                        <div style="margin-top: 1mm;"><strong>Doctor:</strong> ${session.doctor_name || '-'}</div>
                    </div>
                    
                    <div class="section-title">--- SESSION INFO ---</div>
                    
                    <div class="details-grid">
                        <div class="detail-item">
                            <div class="detail-label">Laser</div>
                            <div class="detail-value">${session.laser || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Energy</div>
                            <div class="detail-value">${session.energy || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Session No.</div>
                            <div class="detail-value">${session.session || '-'}</div>
                        </div>
                    </div>

                    <div class="description-title">--- DESCRIPTION ---</div>
                    <div class="description-box">
                        ${session.description || 'No description provided'}
                    </div>

                    <div class="footer">
                        <div style="font-family: 'Montserrat', sans-serif; font-weight: 700; margin-bottom: 1mm;">
                            Contact: 0300-0140566<br>
                            City Center Plaza, New City Phase 2, Wah
                        </div>
                        <strong>Care for Your Skin!</strong><br>
                        Software by PrimeSoft - 0309-5369472
                    </div>
                </body>
            </html>
        `);
        iframe.contentDocument.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.onafterprint = () => {
            setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 500);
        };

        setTimeout(() => {
            iframe.contentWindow.print();
        }, 500);
    };

    const handleDelete = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run(`DELETE FROM sessions WHERE id = ?`, [id]);
                setDeleteConfirm(null);
                loadSessions();
                loadSessionStats();
            } catch (err) {
                console.error('Error deleting session:', err);
                setDeleteConfirm(null);
            }
        }, "Delete Session");
    };

    const handleEdit = (session) => {
        requestSecureAction(() => {
            setEditingSession(session);
            setFormData({
                patient_id: session.patient_id,
                doctor_id: session.doctor_id || '',
                description: session.description || '',
                laser: session.laser || '',
                session: session.session || '',
                energy: session.energy || ''
            });
            setIsNewPatient(false);
            setNewPatientName('');
            setNewPatientPhone('');
            setPatientDropdownSearch('');
            setIsPatientDropdownOpen(false);
            setDoctorDropdownSearch('');
            setIsDoctorDropdownOpen(false);
            setIsModalOpen(true);
        }, "Edit Session");
    };

    const resetForm = () => {
        setFormData({
            patient_id: '',
            doctor_id: '',
            description: '',
            laser: '',
            session: '',
            energy: ''
        });
        setIsNewPatient(false);
        setNewPatientName('');
        setNewPatientPhone('');
        setPatientDropdownSearch('');
        setIsPatientDropdownOpen(false);
        setDoctorDropdownSearch('');
        setIsDoctorDropdownOpen(false);
        setError('');
    };

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Sessions</h1>

            {/* Session Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Session Overview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Session Overview");
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Sessions</span>
                            <h3 className="text-3xl font-semibold text-white font-sans tracking-tight">{sessionStats.total}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Top Patient</span>
                            <h3 className="text-3xl font-semibold text-emerald-500 font-sans tracking-tight">{sessionStats.topPatient}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Top Doctor</span>
                            <h3 className="text-3xl font-semibold text-blue-400 font-sans tracking-tight">{sessionStats.topDoctor}</h3>
                        </div>
                    </div>
                )}
            </div>

            {/* Search and Actions */}
            <div className="flex justify-between items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg">
                <div className="flex items-center gap-4 flex-1 max-w-2xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search sessions by patient, description, or diseases..."
                            className="w-full bg-primary-bg pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={filterDoctor}
                            onChange={(e) => setFilterDoctor(e.target.value)}
                        >
                            <option value="all" className="bg-gray-900">All Doctors</option>
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id} className="bg-gray-900">{doc.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="latest" className="bg-gray-900">Latest First</option>
                            <option value="oldest" className="bg-gray-900">Oldest First</option>
                            <option value="patient" className="bg-gray-900">Patient (A-Z)</option>
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setEditingSession(null);
                        setIsModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={18} /> Add Session
                </button>
            </div>

            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{sessions.length}</span>
            </div>

            {/* Sessions Table */}
            <div className="bg-secondary-bg border border-gray-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xl min-h-[400px]">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-gray-300 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                            <tr>
                                <th className="table-header-cell w-[18%]">Date</th>
                                <th className="table-header-cell w-[32%]">Patient</th>
                                <th className="table-header-cell w-[15%]">Energy</th>
                                <th className="table-header-cell w-[20%]">Doctor</th>
                                <th className="table-header-cell text-center w-[15%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {sessions.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-500 italic">No sessions found.</td></tr>
                            ) : (
                                sessions.map(session => (
                                    <tr key={session.id} className="hover:bg-gray-800/30 transition-colors group">
                                        <td className="table-data-cell">
                                            <div className="flex items-center gap-2">
                                                <CalIcon size={14} className="text-blue-400" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-white font-medium">
                                                        {format(new Date(session.date), 'dd MMM yy')}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {session.created_at ? format(new Date(session.created_at + ' Z'), 'hh:mm a') : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex flex-col">
                                                <span className="text-white text-sm font-medium">{session.patient_name}</span>
                                                <span className="text-gray-400 text-xs">{session.patient_phone}</span>
                                            </div>
                                        </td>
                                        <td className="table-data-cell">
                                            <span className="text-emerald-400 text-sm font-bold">{session.energy || '-'}</span>
                                        </td>
                                        <td className="table-data-cell">
                                            <span className="text-cyan-400 text-sm font-medium">{session.doctor_name || '-'}</span>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex items-center justify-center gap-2">
                                                {deleteConfirm === session.id ? (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                        <button
                                                            onClick={() => handleDelete(session.id)}
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
                                                            onClick={() => setViewingSession(session)}
                                                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => printSession(session)}
                                                            className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 rounded-lg transition-colors"
                                                            title="Print Details"
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(session)}
                                                            className="p-2 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                                            title="Edit Session"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(session.id)}
                                                            className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Delete Session"
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
            </div>

            {/* Add/Edit Session Modal */}
            {isModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-2xl rounded-2xl border border-gray-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider">{editingSession ? 'Edit Session' : 'Add New Session'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white text-2xl">✕</button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                <X size={16} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <label className="text-sm font-medium text-gray-300 font-poppins">Patient</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsNewPatient(!isNewPatient)}
                                            className="text-[11px] bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white px-2 py-0.5 rounded-lg transition-all font-semibold uppercase tracking-wider"
                                        >
                                            {isNewPatient ? 'Search Existing' : '+ New Patient'}
                                        </button>
                                    </div>

                                    {isNewPatient ? (
                                        <div className="space-y-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
                                            <input
                                                required
                                                type="text"
                                                placeholder="Patient Name"
                                                className="w-full bg-primary-bg p-2.5 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500 text-sm"
                                                value={newPatientName}
                                                onChange={e => { setNewPatientName(e.target.value); setError(''); }}
                                            />
                                            <input
                                                required
                                                type="text"
                                                placeholder="Phone Number"
                                                className="w-full bg-primary-bg p-2.5 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500 text-sm"
                                                value={newPatientPhone}
                                                onChange={e => setNewPatientPhone(e.target.value.replace(/\D/g, ''))}
                                            />
                                        </div>
                                    ) : (
                                        <div ref={patientSearchRef} className="relative">
                                            <div className="relative group">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder={formData.patient_id ? patients.find(p => p.id == formData.patient_id)?.name : "Search patient name..."}
                                                    className={`w-full bg-primary-bg pl-9 pr-3 py-2.5 rounded-xl border transition-all text-sm ${isPatientDropdownOpen ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-gray-700'} text-white outline-none placeholder:text-gray-500`}
                                                    value={patientDropdownSearch}
                                                    onChange={e => {
                                                        setPatientDropdownSearch(e.target.value);
                                                        setIsPatientDropdownOpen(true);
                                                    }}
                                                    onFocus={() => setIsPatientDropdownOpen(true)}
                                                />
                                                {isPatientDropdownOpen && (
                                                    <div className="absolute top-full left-0 right-0 z-[70] mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                            {patients.filter(p => p.name.toLowerCase().includes(patientDropdownSearch.toLowerCase())).length === 0 ? (
                                                                <div className="p-4 text-center text-gray-500 italic text-sm">No matching patients found.</div>
                                                            ) : (
                                                                patients
                                                                    .filter(p => p.name.toLowerCase().includes(patientDropdownSearch.toLowerCase()))
                                                                    .map(p => (
                                                                        <div
                                                                            key={p.id}
                                                                            onClick={() => {
                                                                                setFormData({ ...formData, patient_id: p.id });
                                                                                setPatientDropdownSearch('');
                                                                                setIsPatientDropdownOpen(false);
                                                                                setError('');
                                                                            }}
                                                                            className={`p-2.5 cursor-pointer transition-all border-b border-gray-800 last:border-0 flex items-center justify-between hover:bg-emerald-500/10 ${formData.patient_id == p.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-300 hover:text-white'}`}
                                                                        >
                                                                            <div className="flex flex-col gap-0.5 flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-semibold text-sm">{p.name}</span>
                                                                                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.visit_count} Sessions</span>
                                                                                </div>
                                                                                <span className="text-xs text-gray-500">{p.phone}</span>
                                                                            </div>
                                                                            {formData.patient_id == p.id && <Check size={14} className="text-emerald-400" />}
                                                                        </div>
                                                                    ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {formData.patient_id && !isPatientDropdownOpen && (
                                                <div className="mt-2 flex items-center justify-between bg-emerald-500/5 p-2 px-3 rounded-lg border border-emerald-500/20 animate-in fade-in duration-300">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Selected</span>
                                                        <span className="text-white font-semibold text-sm">{patients.find(p => p.id == formData.patient_id)?.name}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, patient_id: '' })}
                                                        className="p-1 hover:bg-rose-500/20 text-gray-500 hover:text-rose-500 rounded-md transition-all"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Doctor</label>
                                    <div ref={doctorSearchRef} className="relative">
                                        <div className="relative group">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder={formData.doctor_id ? doctors.find(d => d.id == formData.doctor_id)?.name : "Select doctor..."}
                                                className={`w-full bg-primary-bg pl-9 pr-3 py-2.5 rounded-xl border transition-all text-sm ${isDoctorDropdownOpen ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-gray-700'} text-white outline-none placeholder:text-gray-500`}
                                                value={doctorDropdownSearch}
                                                onChange={e => {
                                                    setDoctorDropdownSearch(e.target.value);
                                                    setIsDoctorDropdownOpen(true);
                                                }}
                                                onFocus={() => setIsDoctorDropdownOpen(true)}
                                            />
                                            {isDoctorDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 z-[70] mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                        {doctors.filter(d => d.name.toLowerCase().includes(doctorDropdownSearch.toLowerCase())).length === 0 ? (
                                                            <div className="p-4 text-center text-gray-500 italic text-sm">No matching doctors found.</div>
                                                        ) : (
                                                            doctors
                                                                .filter(d => d.name.toLowerCase().includes(doctorDropdownSearch.toLowerCase()))
                                                                .map(d => (
                                                                    <div
                                                                        key={d.id}
                                                                        onClick={() => {
                                                                            setFormData({ ...formData, doctor_id: d.id });
                                                                            setDoctorDropdownSearch('');
                                                                            setIsDoctorDropdownOpen(false);
                                                                            setError('');
                                                                        }}
                                                                        className={`p-2.5 cursor-pointer transition-all border-b border-gray-800 last:border-0 flex items-center justify-between hover:bg-emerald-500/10 ${formData.doctor_id == d.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-300 hover:text-white'}`}
                                                                    >
                                                                        <span className="font-semibold text-sm">{d.name}</span>
                                                                        {formData.doctor_id == d.id && <Check size={14} className="text-emerald-400" />}
                                                                    </div>
                                                                ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {formData.doctor_id && !isDoctorDropdownOpen && (
                                            <div className="mt-2 flex items-center justify-between bg-emerald-500/5 p-2 px-3 rounded-lg border border-emerald-500/20 animate-in fade-in duration-300">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Selected</span>
                                                    <span className="text-white font-semibold text-sm">{doctors.find(d => d.id == formData.doctor_id)?.name}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, doctor_id: '' })}
                                                    className="p-1 hover:bg-rose-500/20 text-gray-500 hover:text-rose-500 rounded-md transition-all"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Laser</label>
                                <input
                                    type="text"
                                    placeholder="Laser type..."
                                    className="w-full bg-primary-bg p-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500 text-sm"
                                    value={formData.laser}
                                    onChange={e => setFormData({ ...formData, laser: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Session</label>
                                    <input
                                        type="text"
                                        placeholder="Session name/no..."
                                        className="w-full bg-primary-bg p-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500 text-sm"
                                        value={formData.session}
                                        onChange={e => setFormData({ ...formData, session: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Energy (1-30)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        placeholder="Energy level..."
                                        className="w-full bg-primary-bg p-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500 text-sm"
                                        value={formData.energy}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 30)) {
                                                setFormData({ ...formData, energy: val });
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Description</label>
                                <textarea
                                    rows="5"
                                    className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500 resize-none"
                                    value={formData.description}
                                    onChange={e => { setFormData({ ...formData, description: e.target.value }); setError(''); }}
                                    placeholder="Session description..."
                                />
                            </div>
                            <div className="flex gap-2 pt-4 border-t border-gray-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all">
                                    {editingSession ? 'Update Session' : 'Save Session'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Session Modal */}
            {viewingSession && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setViewingSession(null); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-2xl rounded-2xl border border-gray-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Session Details</h3>
                            <button onClick={() => setViewingSession(null)} className="text-gray-500 hover:text-white text-2xl">×</button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Patient</label>
                                    <p className="text-white font-semibold">{viewingSession.patient_name}</p>
                                    <p className="text-gray-400 text-sm">{viewingSession.patient_phone}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Date</label>
                                    <p className="text-white font-semibold">
                                        {format(new Date(viewingSession.date), 'dd MMM yy')}{' '}
                                        <span className="text-white font-semibold ml-2">
                                            {viewingSession.created_at ? format(new Date(viewingSession.created_at + ' Z'), 'hh:mm a') : ''}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 bg-primary-bg rounded-xl border border-gray-800 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Laser</label>
                                    <p className="text-white font-medium">{viewingSession.laser || '-'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800/30">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Session</label>
                                        <p className="text-white font-medium">{viewingSession.session || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Energy</label>
                                        <p className="text-emerald-400 font-bold">{viewingSession.energy || '-'}</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
                                <p className="text-white bg-primary-bg p-3 rounded-xl border border-gray-800 min-h-[150px]">{viewingSession.description || 'No description provided'}</p>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => setViewingSession(null)}
                                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => printSession(viewingSession)}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} /> Print Details
                                </button>
                            </div>
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

export default Sessions;
