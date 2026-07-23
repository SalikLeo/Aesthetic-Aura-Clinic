import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Stethoscope, Edit2, Trash2, CheckCircle, XCircle, Check, X, Filter, Eye, EyeOff } from 'lucide-react';
import db from '../../database/db';
import PasswordModal from '../common/PasswordModal';

const Doctors = () => {
    const [doctors, setDoctors] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [showStats, setShowStats] = useState(false);
    const [doctorStats, setDoctorStats] = useState({ total: 0, active: 0, totalSessions: 0, totalBills: 0, totalDiscount: 0 });
    const [specializationFilter, setSpecializationFilter] = useState('All');
    const [specializations, setSpecializations] = useState([]);
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const [formData, setFormData] = useState({
        name: '', department: '', specialization: '', mobile: '', visit_fee: ''
    });

    const loadDoctors = async () => {
        let query = `
            SELECT d.*, 
                   (SELECT COUNT(*) FROM invoice_doctors id JOIN invoices i ON id.invoice_id = i.id WHERE id.doctor_id = d.id AND i.status = 'paid') as visit_count,
                   (SELECT COUNT(*) FROM sessions s WHERE s.doctor_id = d.id) as session_count,
                   (SELECT SUM(id.discount) FROM invoice_doctors id JOIN invoices i ON id.invoice_id = i.id WHERE id.doctor_id = d.id AND i.status = 'paid') as total_discount
            FROM doctors d
        `;
        const params = [];

        let whereClause = "WHERE 1=1";

        if (search) {
            whereClause += " AND (d.name LIKE ? OR d.department LIKE ? OR d.specialization LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (specializationFilter !== 'All') {
            whereClause += " AND d.specialization = ?";
            params.push(specializationFilter);
        }

        query += ` ${whereClause}`;

        query += " GROUP BY d.id";

        if (sortBy === 'latest') {
            query += " ORDER BY d.id DESC";
        } else if (sortBy === 'alpha') {
            query += " ORDER BY d.name ASC";
        } else if (sortBy === 'fee-asc') {
            query += " ORDER BY d.visit_fee ASC";
        } else if (sortBy === 'fee-desc') {
            query += " ORDER BY d.visit_fee DESC";
        } else if (sortBy === 'bills-desc') {
            query += " ORDER BY visit_count DESC";
        } else if (sortBy === 'sessions-desc') {
            query += " ORDER BY session_count DESC";
        } else if (sortBy === 'revenue-desc') {
            query += " ORDER BY (COUNT(DISTINCT a.id) * d.visit_fee) DESC";
        } else if (sortBy === 'revenue-asc') {
            query += " ORDER BY (COUNT(DISTINCT a.id) * d.visit_fee) ASC";
        }

        const data = await db.all(query, params);
        setDoctors(data || []);
    };

    const loadDoctorStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date(date) = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date(date) >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date(date) >= date('now', 'localtime', 'start of year')";

            const totalRes = await db.get("SELECT COUNT(*) as count FROM doctors");
            const activeRes = await db.get("SELECT COUNT(*) as count FROM doctors WHERE status='active'");
            const sessionsRes = await db.get(`SELECT COUNT(*) as count FROM sessions ${dateFilter ? 'WHERE ' + dateFilter : ''}`);
            const billsRes = await db.get(`
                SELECT COUNT(DISTINCT id.invoice_id) as count 
                FROM invoice_doctors id
                JOIN invoices i ON id.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter.replace('date(date)', 'date(i.date)') : ''}
            `);
            const discountRes = await db.get(`
                SELECT SUM(id.discount) as total 
                FROM invoice_doctors id
                JOIN invoices i ON id.invoice_id = i.id
                WHERE i.status='paid' ${dateFilter ? 'AND ' + dateFilter.replace('date(date)', 'date(i.date)') : ''}
            `);

            setDoctorStats({
                total: totalRes?.count || 0,
                active: activeRes?.count || 0,
                totalSessions: sessionsRes?.count || 0,
                totalBills: billsRes?.count || 0,
                totalDiscount: discountRes?.total || 0
            });
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const fetchSpecs = async () => {
            try {
                const specs = await db.all("SELECT DISTINCT specialization FROM doctors ORDER BY specialization");
                setSpecializations(specs.map(s => s.specialization).filter(Boolean));
            } catch (e) {
                console.error(e);
            }
        };
        fetchSpecs();
    }, []);

    useEffect(() => { loadDoctors(); }, [search, sortBy, specializationFilter]);
    useEffect(() => { loadDoctorStats(); }, [statsPeriod]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadDoctors();
            loadDoctorStats();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, sortBy, specializationFilter, statsPeriod]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingDoctor) {
                await db.run(
                    "UPDATE doctors SET name=?, department=?, specialization=?, mobile=?, visit_fee=? WHERE id=?",
                    [formData.name, formData.department, formData.specialization, formData.mobile, formData.visit_fee, editingDoctor.id]
                );
            } else {
                await db.run(
                    "INSERT INTO doctors (name, department, specialization, mobile, visit_fee) VALUES (?, ?, ?, ?, ?)",
                    [formData.name, formData.department, formData.specialization, formData.mobile, formData.visit_fee]
                );
            }
            setIsModalOpen(false);
            setEditingDoctor(null);
            setFormData({ name: '', department: '', specialization: '', mobile: '', visit_fee: '' });
            loadDoctors();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run("DELETE FROM appointments WHERE doctor_id = ?", [id]);
                await db.run("DELETE FROM doctors WHERE id = ?", [id]);
                setDeleteConfirm(null);
                loadDoctors();
                loadDoctorStats();
            } catch (err) {
                console.error(err);
                setDeleteConfirm(null);
            }
        }, 'Delete Doctor');
    };

    const handleEdit = (doc) => {
        requestSecureAction(() => {
            setEditingDoctor(doc);
            setFormData(doc);
            setIsModalOpen(true);
        }, 'Edit Doctor');
    };



    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Doctors</h1>
            {/* Specialist Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Doctor Overview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Doctor Overview");
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
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Doctors</span>
                            <h3 className="text-3xl font-semibold text-white font-sans tracking-tight">{doctorStats.total}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Sessions</span>
                            <h3 className="text-3xl font-semibold text-blue-400 font-sans tracking-tight">{doctorStats.totalSessions}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all border-l-4 border-l-amber-500/20">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Bills</span>
                            <h3 className="text-3xl font-semibold text-amber-500 font-sans tracking-tight">{doctorStats.totalBills}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide font-poppins">Discounts</span>
                            <h3 className="text-3xl font-semibold text-rose-500 font-sans tracking-tight leading-none">Rs. {Math.round(doctorStats.totalDiscount || 0).toLocaleString()}</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg gap-4">
                <div className="flex items-center gap-4 flex-1 w-full lg:max-w-4xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search doctors..."
                            className="w-full bg-primary-bg pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-all"
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
                            <option value="alpha" className="bg-gray-900">A-Z</option>
                            <option value="revenue-desc" className="bg-gray-900">Revenue: High to Low</option>
                            <option value="bills-desc" className="bg-gray-900">Bills: High to Low</option>
                            <option value="sessions-desc" className="bg-gray-900">Sessions: High to Low</option>
                            <option value="fee-desc" className="bg-gray-900">Fee: High to Low</option>
                            <option value="fee-asc" className="bg-gray-900">Fee: Low to High</option>
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingDoctor(null);
                        setFormData({ name: '', department: '', specialization: '', mobile: '', visit_fee: '' });
                        setIsModalOpen(true);
                        loadDoctors();
                        loadDoctorStats();
                    }}
                    className="w-full lg:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                    <UserPlus size={18} /> Add Doctor
                </button>
            </div>

            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{doctors.length}</span>
            </div>

            <div className="bg-secondary-bg border border-gray-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xl min-h-[400px]">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-gray-300 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826] mb-2">
                            <tr>
                                <th className="table-header-cell">Doctor</th>
                                <th className="table-header-cell text-center">Bills</th>
                                <th className="table-header-cell text-center">Sessions</th>
                                <th className="table-header-cell">Contact</th>
                                <th className="table-header-cell">Visit Fee</th>
                                <th className="table-header-cell text-center">Subtotal</th>
                                <th className="table-header-cell text-center text-rose-400">Discounts</th>
                                <th className="table-header-cell text-center">Total</th>
                                <th className="table-header-cell text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {doctors.length === 0 ? <tr><td colSpan="7" className="p-10 text-center text-gray-500 italic">No doctors found.</td></tr> :
                                doctors.map(doc => (
                                    <tr key={doc.id} className="hover:bg-gray-800/20 transition-colors group">
                                        <td className="table-data-cell">
                                            <div className="text-white text-sm">{doc.name}</div>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <span className="text-white text-sm">{doc.visit_count || 0}</span>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <span className="text-cyan-400 text-sm font-semibold">{doc.session_count || 0}</span>
                                        </td>
                                        <td className="table-data-cell">
                                            <span className="text-white text-sm">{doc.mobile}</span>
                                        </td>
                                        <td className="table-data-cell">
                                            <span className="text-white text-sm">Rs. {doc.visit_fee.toLocaleString()}</span>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <span className="text-indigo-400 text-sm font-semibold">Rs. {((doc.visit_count || 0) * doc.visit_fee).toLocaleString()}</span>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <span className="text-rose-400 text-sm font-semibold">Rs. {(doc.total_discount || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            <span className="text-emerald-400 text-sm font-semibold text-lg">Rs. {(((doc.visit_count || 0) * doc.visit_fee) - (doc.total_discount || 0)).toLocaleString()}</span>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex items-center justify-center gap-2">
                                                {deleteConfirm === doc.id ? (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                        <button
                                                            onClick={() => handleDelete(doc.id)}
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
                                                        <button onClick={() => handleEdit(doc)} title="Edit" className="p-2 text-white hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"><Edit2 size={18} /></button>
                                                        <button onClick={() => setDeleteConfirm(doc.id)} title="Delete" className="p-2 text-red-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"><Trash2 size={18} /></button>
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
            {
                isModalOpen && (
                    <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-secondary-bg w-full max-w-lg rounded-2xl border border-gray-700 p-6 shadow-2xl overflow-hidden">
                            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                                <h3 className="text-xl font-bold text-white uppercase tracking-wider">{editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Full Name</label>
                                    <input required placeholder="Dr. John Doe" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Department</label>
                                        <input required placeholder="Dermatology" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                            value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Specialization</label>
                                        <input required placeholder="Dermatologist" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                            value={formData.specialization} onChange={e => setFormData({ ...formData, specialization: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Contact Info</label>
                                        <input required placeholder="+92 3XX XXXXXXX" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                            value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Visit Fee</label>
                                        <input required type="number" placeholder="5000" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                            value={formData.visit_fee} onChange={e => setFormData({ ...formData, visit_fee: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-4 border-t border-gray-800">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all">Cancel</button>
                                    <button type="submit" className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all">Save Doctor</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            <PasswordModal
                isOpen={secureAction.isOpen}
                onClose={() => setSecureAction({ ...secureAction, isOpen: false })}
                onVerified={secureAction.onVerified}
                actionName={secureAction.actionName}
            />
        </div>
    );
};

export default Doctors;
