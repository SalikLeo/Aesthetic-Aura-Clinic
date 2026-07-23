import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Filter, Calendar as CalIcon, Clock, CheckCircle, XCircle, AlertCircle, Search, Edit2, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import db from '../../database/db';
import PasswordModal from '../common/PasswordModal';

const Appointments = () => {
    const location = useLocation();
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDoctor, setFilterDoctor] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc');
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, cancelled: 0 });
    const [editingApp, setEditingApp] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [cancelConfirm, setCancelConfirm] = useState(null);
    const [completeConfirm, setCompleteConfirm] = useState(null);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const [formData, setFormData] = useState({
        patient_id: '',
        doctor_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        reminder_date: format(new Date(), 'yyyy-MM-dd'),
        reminder_time: '08:30',
        reason: '',
        status: 'pending'
    });

    const [isNewPatient, setIsNewPatient] = useState(false);
    const [newPatientData, setNewPatientData] = useState({ name: '', phone: '' });
    const [patientDropdownSearch, setPatientDropdownSearch] = useState('');
    const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
    const patientSearchRef = useRef(null);

    const loadData = async () => {
        try {
            let query = `
                SELECT a.id, a.date, a.time, a.reason, a.status, a.patient_id, a.doctor_id,
                       a.reminder_date, a.reminder_time, a.created_at,
                       p.name as patient_name, 
                       d.name as doctor_name
                FROM appointments a
                LEFT JOIN patients p ON a.patient_id = p.id
                LEFT JOIN doctors d ON a.doctor_id = d.id
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += " AND (p.name LIKE ? OR d.name LIKE ? OR a.reason LIKE ?)";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            if (filterStatus !== 'all') {
                query += " AND a.status = ?";
                params.push(filterStatus);
            }
            if (filterDoctor !== 'all') {
                query += " AND a.doctor_id = ?";
                params.push(filterDoctor);
            }

            // Apply period filter
            if (statsPeriod === 'Daily') {
                query += " AND date(a.date) = date('now', 'localtime')";
            } else if (statsPeriod === 'Weekly') {
                query += " AND date(a.date) >= date('now', 'localtime', '-7 days')";
            } else if (statsPeriod === 'Monthly') {
                query += " AND date(a.date) >= date('now', 'localtime', 'start of month')";
            } else if (statsPeriod === 'Annual') {
                query += " AND date(a.date) >= date('now', 'localtime', 'start of year')";
            }

            if (sortBy === 'date-desc') {
                query += " ORDER BY a.date DESC, a.id DESC";
            } else if (sortBy === 'date-asc') {
                query += " ORDER BY a.date ASC, a.id ASC";
            } else if (sortBy === 'patient-alpha') {
                query += " ORDER BY p.name ASC";
            }

            const apps = await db.all(query, params);
            setAppointments(apps || []);

            const pats = await db.all("SELECT id, name FROM patients ORDER BY name");
            const docs = await db.all("SELECT id, name FROM doctors WHERE status='active' ORDER BY name");
            setPatients(pats || []);
            setDoctors(docs || []);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date(date) = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date(date) >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date(date) >= date('now', 'localtime', 'start of year')";

            const baseQuery = `SELECT COUNT(*) as count FROM appointments ${dateFilter ? 'WHERE ' + dateFilter : ''}`;
            const total = await db.get(baseQuery);
            const comp = await db.get(baseQuery + (dateFilter ? " AND " : " WHERE ") + "status='completed'");
            const pend = await db.get(baseQuery + (dateFilter ? " AND " : " WHERE ") + "status='pending'");
            const canc = await db.get(baseQuery + (dateFilter ? " AND " : " WHERE ") + "status='cancelled'");

            setStats({
                total: total?.count || 0,
                completed: comp?.count || 0,
                pending: pend?.count || 0,
                cancelled: canc?.count || 0
            });
        } catch (err) { console.error(err); }
    };

    useEffect(() => { loadData(); }, [filterStatus, filterDoctor, search, sortBy, statsPeriod]);
    useEffect(() => { loadStats(); }, [statsPeriod]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadData();
            loadStats();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [filterStatus, filterDoctor, search, sortBy, statsPeriod]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (patientSearchRef.current && !patientSearchRef.current.contains(event.target)) {
                setIsPatientDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, [patientSearchRef]);

    useEffect(() => {
        if (location.state?.openNewAppointment) {
            setEditingApp(null);
            setFormData({
                patient_id: '',
                doctor_id: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                time: '09:00',
                reminder_date: format(new Date(), 'yyyy-MM-dd'),
                reminder_time: '08:30',
                reason: '',
                status: 'pending'
            });
            setIsNewPatient(false);
            setNewPatientData({ name: '', phone: '' });
            loadData();
            loadStats();
            setIsModalOpen(true);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let patientId = formData.patient_id;

            if (isNewPatient) {
                // Quick add new patient
                await db.run(
                    "INSERT INTO patients (name, phone) VALUES (?, ?)",
                    [newPatientData.name, newPatientData.phone]
                );
                const lastPatient = await db.get("SELECT last_insert_rowid() as id");
                patientId = lastPatient.id;
            }

            if (editingApp) {
                await db.run(
                    "UPDATE appointments SET patient_id=?, doctor_id=?, date=?, time=?, reminder_date=?, reminder_time=?, reason=?, status=?, reminder_notified=0 WHERE id=?",
                    [patientId, formData.doctor_id, formData.date, formData.time, formData.reminder_date, formData.reminder_time, formData.reason, formData.status, editingApp.id]
                );
            } else {
                await db.run(
                    "INSERT INTO appointments (patient_id, doctor_id, date, time, reminder_date, reminder_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [patientId, formData.doctor_id, formData.date, formData.time, formData.reminder_date, formData.reminder_time, formData.reason, formData.status]
                );
            }
            setIsModalOpen(false);
            setEditingApp(null);
            setIsNewPatient(false);
            setNewPatientData({ name: '', phone: '' });
            loadData();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run("DELETE FROM appointments WHERE id = ?", [id]);
                setDeleteConfirm(null);
                loadData();
                loadStats();
            } catch (err) {
                console.error(err);
                setDeleteConfirm(null);
            }
        }, 'Delete Appointment');
    };

    const handleEdit = (app) => {
        requestSecureAction(() => {
            setEditingApp(app);
            setFormData({
                patient_id: app.patient_id,
                doctor_id: app.doctor_id,
                date: app.date,
                time: app.time,
                reminder_date: app.reminder_date || app.date,
                reminder_time: app.reminder_time || '08:00',
                reason: app.reason,
                status: app.status
            });
            setIsNewPatient(false);
            setIsModalOpen(true);
        }, 'Edit Appointment');
    };

    const updateStatus = async (id, status) => {
        requestSecureAction(async () => {
            try {
                await db.run("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);
                setCancelConfirm(null);
                setCompleteConfirm(null);
                loadData();
                loadStats();
            } catch (err) {
                console.error(err);
                setCancelConfirm(null);
                setCompleteConfirm(null);
            }
        }, `Update Appointment Status to ${status}`);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'cancelled': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        }
    };

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Appointments</h1>
            {/* Appointment Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Appointment Overview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Appointment Summary");
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
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Bookings</span>
                            <h3 className="text-3xl font-semibold text-white font-sans tracking-tight">{stats.total}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Completed</span>
                            <h3 className="text-3xl font-semibold text-emerald-500 font-sans tracking-tight">{stats.completed}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Pending</span>
                            <h3 className="text-3xl font-semibold text-amber-500 font-sans tracking-tight">{stats.pending}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-all border-l-4 border-l-rose-500/20">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Cancelled</span>
                            <h3 className="text-3xl font-semibold text-rose-500 font-sans tracking-tight">{stats.cancelled}</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg gap-4">
                <div className="flex items-center gap-4 flex-1 w-full lg:max-w-xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by patient, doctor or reason..."
                            className="w-full bg-primary-bg pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-accent transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-primary-bg border border-gray-700 text-sm text-gray-100 p-2.5 rounded-xl outline-none focus:border-accent"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="date-desc">Latest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="patient-alpha">Patient (A-Z)</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-primary-bg border border-gray-700 text-sm text-gray-100 p-2.5 rounded-xl outline-none focus:border-accent"
                            value={filterDoctor}
                            onChange={(e) => setFilterDoctor(e.target.value)}
                        >
                            <option value="all">All Doctors</option>
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id}>{doc.name}</option>
                            ))}
                        </select>
                        <select
                            className="bg-primary-bg border border-gray-700 text-sm text-gray-100 p-2.5 rounded-xl outline-none focus:border-accent"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <button
                        onClick={() => {
                            setEditingApp(null);
                            setFormData({
                                patient_id: '',
                                doctor_id: '',
                                date: format(new Date(), 'yyyy-MM-dd'),
                                time: '09:00',
                                reminder_date: format(new Date(), 'yyyy-MM-dd'),
                                reminder_time: '08:30',
                                reason: '',
                                status: 'pending'
                            });
                            setIsNewPatient(false);
                            setNewPatientData({ name: '', phone: '' });
                            setPatientDropdownSearch('');
                            setIsPatientDropdownOpen(false);
                            setIsModalOpen(true);
                            loadData();
                            loadStats();
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={18} /> Book Appointment
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{appointments.length}</span>
            </div>

            <div className="bg-secondary-bg border border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-xl min-h-[400px]">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-gray-300 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826] mb-2">
                            <tr>
                                <th className="table-header-cell">Booked On</th>
                                <th className="table-header-cell">Appointment On</th>
                                <th className="table-header-cell">Reminder</th>
                                <th className="table-header-cell">Patient</th>
                                <th className="table-header-cell">Doctor</th>
                                <th className="table-header-cell">Reason</th>
                                <th className="table-header-cell text-center">Status</th>
                                <th className="table-header-cell text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {loading ? <tr><td colSpan="8" className="p-10 text-center text-gray-500 italic">Loading schedule...</td></tr> :
                                appointments.length === 0 ? <tr><td colSpan="8" className="p-10 text-center text-gray-500 italic">No appointments found.</td></tr> :
                                    appointments.map(app => (
                                        <tr key={app.id} className="hover:bg-gray-800/30 transition-colors group">
                                            <td className="table-data-cell">
                                                <div className="flex items-center gap-3">
                                                    <div className="text-sm text-gray-300 font-medium tracking-tight">
                                                        {app.created_at ? format(new Date(app.created_at), 'p') : 'N/A'}
                                                    </div>
                                                    {app.created_at && (
                                                        <div className="flex items-center gap-1.5 opacity-80">
                                                            <CalIcon size={14} className="text-cyan-400" />
                                                            <span className="text-sm text-gray-300 font-medium tracking-tight">
                                                                {format(new Date(app.created_at), 'dd MMM')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="table-data-cell">
                                                <div className="flex items-center gap-3">
                                                    <div className="text-sm text-gray-300 font-medium tracking-tight">
                                                        {format(new Date(`2000-01-01T${app.time}`), 'p')}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 opacity-80">
                                                        <CalIcon size={14} className="text-cyan-400" />
                                                        <span className="text-sm text-gray-300 font-medium tracking-tight">{format(new Date(app.date), 'dd MMM')}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="table-data-cell">
                                                <div className="flex items-center gap-3">
                                                    <div className="text-sm text-gray-300 font-medium tracking-tight">
                                                        {app.reminder_time ? format(new Date(`2000-01-01T${app.reminder_time}`), 'p') : 'None'}
                                                    </div>
                                                    {app.reminder_date && (
                                                        <div className="flex items-center gap-1.5 opacity-80">
                                                            <CalIcon size={14} className="text-cyan-400" />
                                                            <span className="text-sm text-gray-300 font-medium tracking-tight">{format(new Date(app.reminder_date), 'dd MMM')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="table-data-cell">
                                                <div className="text-white text-sm">{app.patient_name || 'Unknown Patient'}</div>
                                            </td>
                                            <td className="table-data-cell">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-white text-sm">{app.doctor_name}</span>
                                                </div>
                                            </td>
                                            <td className="table-data-cell text-white text-sm">
                                                {app.reason}
                                            </td>
                                            <td className="table-data-cell text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs uppercase tracking-widest border ${getStatusColor(app.status)}`}>
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="table-data-cell">
                                                <div className="flex items-center justify-center gap-2">
                                                    {deleteConfirm === app.id ? (
                                                        <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                            <button
                                                                onClick={() => handleDelete(app.id)}
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
                                                    ) : cancelConfirm === app.id ? (
                                                        <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                            <button
                                                                onClick={() => updateStatus(app.id, 'cancelled')}
                                                                className="p-1.5 text-emerald-400 hover:bg-emerald-400/20 rounded-lg transition-all"
                                                                title="Confirm Cancel"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setCancelConfirm(null)}
                                                                className="p-1.5 text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all"
                                                                title="Cancel"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : completeConfirm === app.id ? (
                                                        <div className="flex items-center gap-1 bg-emerald-500/10 p-1 rounded-xl border border-emerald-500/20">
                                                            <button
                                                                onClick={() => updateStatus(app.id, 'completed')}
                                                                className="p-1.5 text-emerald-400 hover:bg-emerald-400/20 rounded-lg transition-all"
                                                                title="Confirm Complete"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setCompleteConfirm(null)}
                                                                className="p-1.5 text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all"
                                                                title="Cancel"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => setCancelConfirm(app.id)} title="Cancel Appointment" className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><XCircle size={18} /></button>
                                                            <button onClick={() => setCompleteConfirm(app.id)} title="Complete Appointment" className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all"><CheckCircle size={18} /></button>
                                                            <button onClick={() => handleEdit(app)} title="Edit" className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all"><Edit2 size={18} /></button>
                                                            <button onClick={() => setDeleteConfirm(app.id)} title="Delete" className="p-2 text-red-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"><Trash2 size={18} /></button>
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

            {/* Modal */}
            {isModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-md rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">{editingApp ? 'Edit Appointment' : 'Book Appointment'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><XCircle className="text-gray-500 hover:text-white" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-300 font-poppins">Patient</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsNewPatient(!isNewPatient)}
                                        className="flex items-center gap-1 text-[13px] bg-accent/10 text-accent-hover hover:bg-accent hover:text-white px-3 py-1.5 rounded-xl font-medium transition-all border border-accent/20 shadow-sm"
                                    >
                                        <Plus size={12} className={isNewPatient ? 'rotate-45 transition-transform' : 'transition-transform'} />
                                        {isNewPatient ? 'Select Existing' : 'New Patient?'}
                                    </button>
                                </div>
                                {isNewPatient ? (
                                    <div className="space-y-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
                                        <input
                                            required
                                            type="text"
                                            placeholder="Patient Name"
                                            className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white outline-none focus:border-accent text-sm"
                                            value={newPatientData.name}
                                            onChange={e => setNewPatientData({ ...newPatientData, name: e.target.value })}
                                        />
                                        <input
                                            required
                                            type="text"
                                            placeholder="Phone Number"
                                            className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white outline-none focus:border-accent text-sm"
                                            value={newPatientData.phone}
                                            onChange={e => setNewPatientData({ ...newPatientData, phone: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>
                                ) : (
                                    <div className="relative" ref={patientSearchRef}>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search patient name..."
                                                className="w-full bg-primary-bg pl-10 pr-4 py-3 rounded-xl border border-gray-700 text-white outline-none focus:border-accent transition-all text-sm"
                                                value={patientDropdownSearch}
                                                onFocus={() => setIsPatientDropdownOpen(true)}
                                                onChange={(e) => {
                                                    setPatientDropdownSearch(e.target.value);
                                                    setIsPatientDropdownOpen(true);
                                                }}
                                            />
                                        </div>

                                        {isPatientDropdownOpen && (
                                            <div className="absolute z-[100] mt-2 w-full bg-[#1a2233] border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar overflow-x-hidden">
                                                {patients
                                                    .filter(p => !patientDropdownSearch || p.name.toLowerCase().includes(patientDropdownSearch.toLowerCase()))
                                                    .length > 0 ? (
                                                    patients
                                                        .filter(p => !patientDropdownSearch || p.name.toLowerCase().includes(patientDropdownSearch.toLowerCase()))
                                                        .map(p => (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => {
                                                                    setFormData({ ...formData, patient_id: p.id });
                                                                    setPatientDropdownSearch(p.name);
                                                                    setIsPatientDropdownOpen(false);
                                                                }}
                                                                className={`p-3 hover:bg-accent/10 cursor-pointer border-b border-gray-800 last:border-0 transition-colors ${formData.patient_id == p.id ? 'bg-accent/20 border-l-4 border-l-accent' : ''}`}
                                                            >
                                                                <p className="text-white font-bold text-sm">{p.name}</p>
                                                                {p.phone && <p className="text-gray-500 text-xs mt-0.5">{p.phone}</p>}
                                                            </div>
                                                        ))
                                                ) : (
                                                    <div className="p-4 text-center text-gray-500 text-sm italic">No patients found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 font-poppins mb-1">Doctor</label>
                                <select required className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white outline-none focus:border-accent"
                                    value={formData.doctor_id} onChange={e => setFormData({ ...formData, doctor_id: e.target.value })}>
                                    <option value="">Select Doctor</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-1">Date</label>
                                    <input required type="date" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white outline-none focus:border-accent"
                                        style={{ colorScheme: 'dark' }}
                                        value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-1">Time</label>
                                    <input required type="time" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white outline-none focus:border-accent"
                                        style={{ colorScheme: 'dark' }}
                                        value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-cyan-400 font-poppins mb-1">Reminder Date</label>
                                    <input required type="date" className="w-full bg-primary-bg border border-cyan-500/30 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                                        style={{ colorScheme: 'dark' }}
                                        value={formData.reminder_date} onChange={e => setFormData({ ...formData, reminder_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-cyan-400 font-poppins mb-1">Reminder Time</label>
                                    <input required type="time" className="w-full bg-primary-bg border border-cyan-500/30 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                                        style={{ colorScheme: 'dark' }}
                                        value={formData.reminder_time} onChange={e => setFormData({ ...formData, reminder_time: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 font-poppins mb-1">Reason</label>
                                <input type="text" className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white outline-none focus:border-accent"
                                    placeholder="e.g. Skin Consultation"
                                    value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                            </div>
                            {editingApp && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-1">Status</label>
                                    <select className="w-full bg-primary-bg border border-gray-700 rounded-lg p-2.5 text-white outline-none focus:border-accent"
                                        value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            )}

                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl mt-2 transition-colors">
                                {editingApp ? 'Update Booking' : 'Confirm Booking'}
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
        </div>
    );
};

export default Appointments;
