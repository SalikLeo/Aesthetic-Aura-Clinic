import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Filter, Receipt, DollarSign, Calendar as CalIcon, Clock, Edit2, Trash2, Check, X, Settings, Eye, EyeOff } from 'lucide-react';
import db from '../../database/db';
import { format } from 'date-fns';
import PasswordModal from '../common/PasswordModal';

const Expenses = () => {
    const location = useLocation();

    useEffect(() => {
        if (location.state?.openNewExpense) {
            setEditingExpense(null);
            setFormData({ title: '', amount: '', category: '', date: format(new Date(), 'yyyy-MM-dd') });
            setIsModalOpen(true);
            loadExpenses();
            loadExpenseStats();
            fetchCategories();
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const [expenses, setExpenses] = useState([]);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [expenseStats, setExpenseStats] = useState({ total: 0, salaries: 0, operations: 0, others: 0 });
    const [showStats, setShowStats] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [editingCat, setEditingCat] = useState(null);
    const [categories, setCategories] = useState([]);
    const [deleteCatConfirm, setDeleteCatConfirm] = useState(null);
    const [formData, setFormData] = useState({ title: '', amount: '', category: '', date: format(new Date(), 'yyyy-MM-dd') });
    const [categoryFilter, setCategoryFilter] = useState('All');

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const loadExpenses = async () => {
        let query = "SELECT * FROM expenses WHERE 1=1";
        const params = [];
        if (search) {
            query += " AND (title LIKE ? OR category LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (categoryFilter !== 'All') {
            query += " AND category = ?";
            params.push(categoryFilter);
        }

        if (statsPeriod === 'Daily') {
            query += " AND date(date) = date('now', 'localtime')";
        } else if (statsPeriod === 'Weekly') {
            query += " AND date(date) >= date('now', 'localtime', '-7 days')";
        } else if (statsPeriod === 'Monthly') {
            query += " AND date(date) >= date('now', 'localtime', 'start of month')";
        } else if (statsPeriod === 'Annual') {
            query += " AND date(date) >= date('now', 'localtime', 'start of year')";
        }
        if (sortBy === 'latest') query += " ORDER BY date DESC, id DESC";
        else if (sortBy === 'oldest') query += " ORDER BY date ASC, id ASC";
        else if (sortBy === 'amount-desc') query += " ORDER BY amount DESC";
        else if (sortBy === 'amount-asc') query += " ORDER BY amount ASC";

        const data = await db.all(query, params);
        setExpenses(data || []);
    };

    const loadExpenseStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date(date) = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date(date) >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date(date) >= date('now', 'localtime', 'start of year')";

            const baseQuery = `SELECT SUM(amount) as total FROM expenses ${dateFilter ? 'WHERE ' + dateFilter : ''}`;

            const totalRes = await db.get(baseQuery);
            const salRes = await db.get(baseQuery + (dateFilter ? " AND " : " WHERE ") + "category='Salary'");
            const otherRes = await db.get(baseQuery + (dateFilter ? " AND " : " WHERE ") + "category != 'Salary'");

            setExpenseStats({
                total: totalRes?.total || 0,
                salaries: salRes?.total || 0,
                others: otherRes?.total || 0
            });
        } catch (err) { console.error(err); }
    };

    const fetchCategories = async () => {
        try {
            const data = await db.all("SELECT * FROM expense_categories ORDER BY name");
            setCategories(data || []);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { loadExpenses(); }, [search, categoryFilter, sortBy, statsPeriod]);
    useEffect(() => { loadExpenseStats(); }, [statsPeriod]);
    useEffect(() => { fetchCategories(); }, []); // Load categories on component mount

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadExpenses();
            loadExpenseStats();
            fetchCategories();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, categoryFilter, sortBy, statsPeriod]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const timePart = editingExpense ? (editingExpense.date.includes(' ') ? editingExpense.date.split(' ')[1] : format(new Date(), 'HH:mm:ss')) : format(new Date(), 'HH:mm:ss');
            const saveDate = `${formData.date} ${timePart} `;

            if (editingExpense) {
                await db.run(
                    "UPDATE expenses SET title=?, amount=?, category=?, date=? WHERE id=?",
                    [formData.title, formData.amount, formData.category, saveDate, editingExpense.id]
                );
            } else {
                await db.run(
                    "INSERT INTO expenses (title, amount, category, date) VALUES (?, ?, ?, ?)",
                    [formData.title, formData.amount, formData.category, saveDate]
                );
            }
            setIsModalOpen(false);
            setEditingExpense(null);
            setFormData({ title: '', amount: '', category: '', date: format(new Date(), 'yyyy-MM-dd') });
            loadExpenses();
            // loadFinanceStats(); // Removed as per instruction
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run("DELETE FROM expenses WHERE id = ?", [id]);
                setDeleteConfirm(null);
                loadExpenses();
                loadExpenseStats();
            } catch (err) {
                console.error(err);
                setDeleteConfirm(null);
            }
        }, 'Delete Expense');
    };

    const handleEdit = (exp) => {
        requestSecureAction(() => {
            setEditingExpense(exp);
            setFormData({
                title: exp.title,
                amount: exp.amount,
                category: exp.category,
                date: format(new Date(exp.date), 'yyyy-MM-dd')
            });
            setIsModalOpen(true);
        }, 'Edit Expense');
    };

    const handleAddCat = async () => {
        if (!newCatName.trim()) return;
        try {
            if (editingCat) {
                await db.run("UPDATE expense_categories SET name = ? WHERE id = ?", [newCatName.trim(), editingCat.id]);
            } else {
                await db.run("INSERT INTO expense_categories (name) VALUES (?)", [newCatName.trim()]);
            }
            setNewCatName('');
            setEditingCat(null);
            fetchCategories();
        } catch (err) { console.error(err); }
    };

    const handleDeleteCat = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run("DELETE FROM expense_categories WHERE id = ?", [id]);
                setDeleteCatConfirm(null);
                fetchCategories();
            } catch (err) {
                console.error(err);
                setDeleteCatConfirm(null);
            }
        }, 'Delete Expense Category');
    };

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Expenses</h1>
            {/* Expense Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Expense Analytics</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Expense Analytics");
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
                    <div className="animate-in fade-in slide-in-from-top-4 duration-300">

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-500/30 transition-all">
                                <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Expense</span>
                                <h3 className="text-3xl font-semibold text-white font-sans tracking-tight">Rs. {expenseStats.total.toLocaleString()}</h3>
                            </div>
                            <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-all">
                                <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Salaries</span>
                                <h3 className="text-3xl font-semibold text-rose-500 font-sans tracking-tight">Rs. {expenseStats.salaries.toLocaleString()}</h3>
                            </div>
                            <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all border-l-4 border-l-amber-500/20">
                                <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Others</span>
                                <h3 className="text-3xl font-semibold text-amber-500 font-sans tracking-tight">Rs. {expenseStats.others.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg gap-4">

                <div className="flex items-center gap-4 flex-1 w-full xl:max-w-4xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by title or category..."
                            className="w-full bg-primary-bg pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="All" className="bg-gray-900">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name} className="bg-gray-900">{cat.name}</option>
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
                            <option value="amount-desc" className="bg-gray-900">Amount: High to Low</option>
                            <option value="amount-asc" className="bg-gray-900">Amount: Low to High</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <button
                        onClick={() => setIsCatModalOpen(true)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border border-gray-700"
                    >
                        <Settings size={18} /> Manage Categories
                    </button>
                    <button
                        onClick={() => {
                            setEditingExpense(null);
                            setFormData({ title: '', amount: '', category: '', date: format(new Date(), 'yyyy-MM-dd') });
                            setIsModalOpen(true);
                            loadExpenses();
                            loadExpenseStats();
                            fetchCategories();
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                        <Plus size={18} /> Add Expense
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{expenses.length}</span>
            </div>

            <div className="bg-secondary-bg rounded-2xl border border-gray-800 flex-1 flex flex-col overflow-hidden shadow-xl min-h-[400px]">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-gray-300 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                            <tr>
                                <th className="table-header-cell">Date</th>
                                <th className="table-header-cell">Title</th>
                                <th className="table-header-cell">Category</th>
                                <th className="table-header-cell text-right">Amount</th>
                                <th className="table-header-cell text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {expenses.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-500 italic">No expenses recorded.</td></tr>
                            ) : (
                                expenses.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors group">
                                        <td className="table-data-cell">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <CalIcon size={14} className="text-blue-400" />
                                                    <span className="text-sm text-white font-medium">
                                                        {format(new Date(item.date), 'dd MMM yy')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={12} className="text-gray-500" />
                                                    <span className="text-sm text-gray-400 uppercase tracking-wider font-bold">
                                                        {format(new Date(item.date), 'hh:mm a')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="text-white text-sm">{item.title}</div>
                                        </td>
                                        <td className="table-data-cell">
                                            <span className="text-sm text-white">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="table-data-cell text-right">
                                            <div className="text-sm text-white">Rs. {item.amount}</div>
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex items-center justify-center gap-2">
                                                {deleteConfirm === item.id ? (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
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
                                                            onClick={() => handleEdit(item)}
                                                            className="p-2 text-white hover:bg-blue-400/10 rounded-xl transition-all"
                                                            title="Edit Expense"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(item.id)}
                                                            className="p-2 text-red-500 hover:bg-rose-400/10 rounded-xl transition-all"
                                                            title="Delete Expense"
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

            {/* Add/Edit Expense Modal */}
            {isModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-md rounded-2xl border border-gray-700 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Title</label>
                                <input
                                    required
                                    className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Amount</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-emerald-500"
                                        style={{ colorScheme: 'dark' }}
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2 px-1">Category</label>
                                <select
                                    required
                                    className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option value="" disabled className="bg-gray-900">Select Category</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.name} className="bg-gray-900">{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all">
                                    {editingExpense ? 'Update Expense' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Category Management Modal */}
            {isCatModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsCatModalOpen(false); }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-md rounded-2xl border border-gray-700 p-6 shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider text-amber-500">Manage Expense Categories</h3>
                            <button onClick={() => setIsCatModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                placeholder="Enter category name..."
                                className="flex-1 bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                            />
                            <button
                                onClick={handleAddCat}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl transition-all"
                            >
                                {editingCat ? <Check size={20} /> : <Plus size={20} />}
                            </button>
                            {editingCat && (
                                <button
                                    onClick={() => { setEditingCat(null); setNewCatName(''); }}
                                    className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                            {categories.length === 0 ? (
                                <p className="text-center text-gray-500 py-4 italic">No categories added yet.</p>
                            ) : categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between bg-primary-bg/50 p-3 rounded-xl border border-gray-800 hover:border-gray-700 transition-all group">
                                    <span className="text-gray-200">{cat.name}</span>
                                    <div className="flex items-center gap-1">
                                        {deleteCatConfirm === cat.id ? (
                                            <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-lg border border-rose-500/20">
                                                <button
                                                    onClick={() => handleDeleteCat(cat.id)}
                                                    className="p-1 text-emerald-400 hover:bg-emerald-400/20 rounded-md transition-all"
                                                    title="Confirm Delete"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteCatConfirm(null)}
                                                    className="p-1 text-rose-400 hover:bg-rose-400/20 rounded-md transition-all"
                                                    title="Cancel"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => { setEditingCat(cat); setNewCatName(cat.name); }}
                                                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteCatConfirm(cat.id)}
                                                    className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setIsCatModalOpen(false)}
                            className="w-full mt-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all"
                        >
                            Close
                        </button>
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

export default Expenses;
