import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Briefcase, Phone, DollarSign, Edit2, Trash2, Check, X, Filter, Settings, Plus, Calendar, Eye, EyeOff, ClipboardCheck, History } from 'lucide-react';
import db from '../../database/db';
import { format } from 'date-fns';
import PasswordModal from '../common/PasswordModal';

const Employees = () => {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [showStats, setShowStats] = useState(false);
    const [employeeStats, setEmployeeStats] = useState({ totalSalaries: 0, paidSalaries: 0, remainingSalaries: 0, totalEmployees: 0 });
    const [roleFilter, setRoleFilter] = useState('All');
    const [roles, setRoles] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [payConfirm, setPayConfirm] = useState(null);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [editingRole, setEditingRole] = useState(null);
    const [deleteRoleConfirm, setDeleteRoleConfirm] = useState(null);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [selectedEmpForAttendance, setSelectedEmpForAttendance] = useState(null);
    const [isAttendanceHistoryOpen, setIsAttendanceHistoryOpen] = useState(false);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [historyFilterEmployee, setHistoryFilterEmployee] = useState('All');
    const [historyFilterDate, setHistoryFilterDate] = useState('');
    const [historyFilterMonth, setHistoryFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [isAttendanceSheetOpen, setIsAttendanceSheetOpen] = useState(false);
    const [sheetData, setSheetData] = useState([]);
    const [daysInMonth, setDaysInMonth] = useState([]);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const [formData, setFormData] = useState({
        name: '', role: '', phone: '', salary: ''
    });

    useEffect(() => {
        const initAttendanceTable = async () => {
            try {
                await db.run(`
                    CREATE TABLE IF NOT EXISTS attendance (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        employee_id INTEGER NOT NULL,
                        status TEXT NOT NULL,
                        date TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (employee_id) REFERENCES employees(id),
                        UNIQUE(employee_id, date)
                    )
                `);
            } catch (err) { console.error("Failed to init attendance table:", err); }
        };
        initAttendanceTable();
    }, []);
    const loadEmployees = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        let query = `
            SELECT e.*, 
            (SELECT id FROM expenses 
             WHERE category='Salary' 
             AND title = 'Salary - ' || e.name 
             AND strftime('%Y-%m', date) = ? 
             LIMIT 1) as payment_id,
            (SELECT status FROM attendance
             WHERE employee_id = e.id
             AND date = ?
             LIMIT 1) as today_status
            FROM employees e
        `;
        const params = [selectedMonth, today];

        let whereClause = "WHERE 1=1";

        if (search) {
            whereClause += " AND (e.name LIKE ? OR e.role LIKE ? OR e.phone LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (roleFilter !== 'All') {
            whereClause += " AND e.role = ?";
            params.push(roleFilter);
        }

        query += ` ${whereClause}`;

        if (sortBy === 'latest') {
            query += " ORDER BY e.created_at DESC";
        } else if (sortBy === 'alpha') {
            query += " ORDER BY e.name ASC";
        } else if (sortBy === 'salary-desc') {
            query += " ORDER BY e.salary DESC";
        }

        const data = await db.all(query, params);
        setEmployees(data || []);
    };

    const loadEmployeeStats = async () => {
        try {
            // Total active employees and their total salaries for the selected month
            // Only count employees who were created on or before the last day of the selected month
            const empRes = await db.get(`
                SELECT COUNT(*) as count, SUM(salary) as total 
                FROM employees 
                WHERE status='active' 
                AND strftime('%Y-%m', created_at) <= ?
            `, [selectedMonth]);
            const totalCount = empRes?.count || 0;
            const totalSals = empRes?.total || 0;

            // Paid salaries for selected month (from expenses where category is Salary)
            const paidRes = await db.get(`SELECT SUM(amount) as total FROM expenses WHERE category='Salary' AND strftime('%Y-%m', date) = ?`, [selectedMonth]);
            const paidSals = paidRes?.total || 0;

            setEmployeeStats({
                totalSalaries: totalSals,
                paidSalaries: paidSals,
                remainingSalaries: totalSals - paidSals,
                totalEmployees: totalCount
            });
        } catch (err) { console.error(err); }
    };

    const fetchRoles = async () => {
        try {
            const r = await db.all("SELECT * FROM employee_roles ORDER BY name");
            setRoles(r || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    useEffect(() => { loadEmployees(); }, [search, sortBy, roleFilter, selectedMonth]);
    useEffect(() => { loadEmployeeStats(); }, [selectedMonth]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadEmployees();
            loadEmployeeStats();
            fetchRoles();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, sortBy, roleFilter, selectedMonth]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingEmployee) {
                await db.run(
                    "UPDATE employees SET name=?, role=?, phone=?, salary=? WHERE id=?",
                    [formData.name, formData.role, formData.phone, formData.salary, editingEmployee.id]
                );
            } else {
                await db.run(
                    "INSERT INTO employees (name, role, phone, salary) VALUES (?, ?, ?, ?)",
                    [formData.name, formData.role, formData.phone, formData.salary]
                );
            }
            setIsModalOpen(false);
            setEditingEmployee(null);
            setFormData({ name: '', role: '', phone: '', salary: '' });
            loadEmployees();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run("DELETE FROM employees WHERE id = ?", [id]);
                setDeleteConfirm(null);
                loadEmployees();
                loadEmployeeStats();
            } catch (err) {
                console.error(err);
                setDeleteConfirm(null);
            }
        }, 'Delete Employee');
    };

    const handlePaySalary = async (emp) => {
        requestSecureAction(async () => {
            try {
                const dateStr = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
                await db.run(
                    "INSERT INTO expenses (title, amount, category, date) VALUES (?, ?, ?, ?)",
                    [`Salary - ${emp.name}`, emp.salary, 'Salary', dateStr]
                );
                setPayConfirm(null);
                loadEmployeeStats();
                loadEmployees();
            } catch (err) {
                console.error(err);
                setPayConfirm(null);
            }
        }, `Pay Salary to ${emp.name}`);
    };

    const handleEdit = (emp) => {
        requestSecureAction(() => {
            setEditingEmployee(emp);
            setFormData(emp);
            setIsModalOpen(true);
        }, 'Edit Employee');
    };

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        try {
            if (editingRole) {
                await db.run("UPDATE employee_roles SET name = ? WHERE id = ?", [newRoleName.trim(), editingRole.id]);
            } else {
                await db.run("INSERT INTO employee_roles (name) VALUES (?)", [newRoleName.trim()]);
            }
            setNewRoleName('');
            setEditingRole(null);
            fetchRoles();
        } catch (e) { console.error(e); }
    };

    const handleDeleteRole = async (id) => {
        requestSecureAction(async () => {
            try {
                await db.run("DELETE FROM employee_roles WHERE id = ?", [id]);
                setDeleteRoleConfirm(null);
                fetchRoles();
            } catch (e) {
                console.error(e);
                setDeleteRoleConfirm(null);
            }
        }, 'Delete Employee Role');
    };

    const handleMarkAttendance = async (emp, status) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            await db.run(
                "INSERT OR REPLACE INTO attendance (employee_id, status, date) VALUES (?, ?, ?)",
                [emp.id, status, today]
            );
            setIsAttendanceModalOpen(false);
            setSelectedEmpForAttendance(null);
            loadEmployees();
        } catch (err) {
            console.error("Failed to mark attendance:", err);
            alert("Attendance already marked for today?");
        }
    };

    const handleUpdateAttendanceStatus = async (recordId, currentStatus, empId, date) => {
        requestSecureAction(async () => {
            try {
                const nextStatus = currentStatus === 'Present' ? 'Absent' : 'Present';
                if (recordId) {
                    await db.run("UPDATE attendance SET status = ? WHERE id = ?", [nextStatus, recordId]);
                } else {
                    await db.run("INSERT INTO attendance (employee_id, status, date) VALUES (?, ?, ?)", [empId, 'Present', date]);
                }
                loadAttendanceHistory();
                loadEmployees();
            } catch (err) {
                console.error("Failed to update attendance status:", err);
            }
        }, 'Update Attendance Status');
    };

    const loadAttendanceHistory = async () => {
        try {
            let query;
            let params = [];
            const filterDate = historyFilterDate;

            if (filterDate) {
                // Showing ALL employees for a specific date (including those not marked)
                query = `
                    SELECT 
                        e.id as employee_id, 
                        e.name as employee_name, 
                        e.role as employee_role,
                        a.id, 
                        a.status, 
                        COALESCE(a.date, ?) as date,
                        datetime(a.created_at, 'localtime') as created_at,
                        (SELECT COUNT(*) FROM attendance 
                         WHERE employee_id = e.id 
                         AND strftime('%Y-%m', date) = strftime('%Y-%m', ?) 
                         AND status = 'Present') as present_count,
                        (SELECT COUNT(*) FROM attendance 
                         WHERE employee_id = e.id 
                         AND strftime('%Y-%m', date) = strftime('%Y-%m', ?)) as total_count
                    FROM employees e
                    LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
                    WHERE e.status = 'active'
                `;
                params = [filterDate, filterDate, filterDate, filterDate];
                if (historyFilterEmployee !== 'All') {
                    query += " AND e.id = ?";
                    params.push(historyFilterEmployee);
                }
            } else {
                // Showing actual records for month/all-time
                query = `
                    SELECT a.id, a.employee_id, a.status, a.date, datetime(a.created_at, 'localtime') as created_at, 
                    e.name as employee_name, e.role as employee_role,
                    (SELECT COUNT(*) FROM attendance 
                     WHERE employee_id = a.employee_id 
                     AND strftime('%Y-%m', date) = strftime('%Y-%m', a.date) 
                     AND status = 'Present') as present_count,
                    (SELECT COUNT(*) FROM attendance 
                     WHERE employee_id = a.employee_id 
                     AND strftime('%Y-%m', date) = strftime('%Y-%m', a.date)) as total_count
                    FROM attendance a 
                    JOIN employees e ON a.employee_id = e.id 
                    WHERE 1=1
                `;
                if (historyFilterMonth) {
                    query += " AND strftime('%Y-%m', a.date) = ?";
                    params.push(historyFilterMonth);
                }
                if (historyFilterEmployee !== 'All') {
                    query += " AND e.id = ?";
                    params.push(historyFilterEmployee);
                }
                query += " ORDER BY a.date DESC, a.created_at DESC";
            }

            const data = await db.all(query, params);
            setAttendanceHistory(data || []);
            setIsAttendanceHistoryOpen(true);
        } catch (err) { console.error("Failed to load attendance history:", err); }
    };

    const loadMonthlySheet = async () => {
        try {
            const yearMonth = selectedMonth; // e.g., "2024-03"
            const [year, month] = yearMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            // Generate list of days in the month
            const days = [];
            for (let d = 1; d <= endDate.getDate(); d++) {
                const date = new Date(year, month - 1, d);
                days.push({
                    dayNum: d,
                    dayName: format(date, 'EEEEE'), // M, T, W, T, F, S, S
                    fullDate: format(date, 'yyyy-MM-dd'),
                    isSunday: date.getDay() === 0
                });
            }
            setDaysInMonth(days);

            // Fetch all employees
            const emps = await db.all("SELECT id, name FROM employees WHERE status='active' ORDER BY name");

            // Fetch all attendance for this month
            const attendance = await db.all(
                "SELECT employee_id, status, date FROM attendance WHERE strftime('%Y-%m', date) = ?",
                [yearMonth]
            );

            // Create a lookup map [empId][date] = status
            const attMap = {};
            attendance.forEach(a => {
                if (!attMap[a.employee_id]) attMap[a.employee_id] = {};
                attMap[a.employee_id][a.date] = a.status;
            });

            const sheetRows = emps.map(e => ({
                id: e.id,
                name: e.name,
                attendance: attMap[e.id] || {}
            }));

            setSheetData(sheetRows);
            setIsAttendanceSheetOpen(true);
        } catch (err) {
            console.error("Failed to load sheet data:", err);
        }
    };

    useEffect(() => {
        loadEmployees();
        loadEmployeeStats();
        if (isAttendanceSheetOpen) {
            loadMonthlySheet();
        }
    }, [selectedMonth, search, sortBy, roleFilter, isAttendanceSheetOpen]);

    useEffect(() => {
        if (isAttendanceHistoryOpen) {
            loadAttendanceHistory();
        }
    }, [historyFilterEmployee, historyFilterDate, historyFilterMonth]);

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Employees</h1>
            {/* Employee Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Employee Overview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Employee Overview");
                                } else {
                                    setShowStats(false);
                                }
                            }}
                            className="bg-[#1a2233] hover:bg-gray-800 text-white p-2 rounded-xl border border-gray-700 transition-all flex items-center gap-2 text-sm font-semibold"
                        >
                            {showStats ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showStats ? 'Hide Stats' : 'Show Stats'}
                        </button>
                        <div className="flex items-center gap-2 bg-[#1a2233] px-4 py-2 rounded-xl border border-gray-700">
                            <Calendar size={18} className="text-gray-400" />
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent text-white text-sm font-semibold outline-none cursor-pointer [color-scheme:dark]"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                    </div>
                </div>

                {showStats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Salaries</span>
                            <h3 className="text-3xl font-semibold text-white font-sans tracking-tight">Rs. {employeeStats.totalSalaries.toLocaleString()}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Paid Salaries</span>
                            <h3 className="text-3xl font-semibold text-emerald-500 font-sans tracking-tight">Rs. {employeeStats.paidSalaries.toLocaleString()}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-all">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Remaining</span>
                            <h3 className="text-3xl font-semibold text-rose-500 font-sans tracking-tight">Rs. {employeeStats.remainingSalaries.toLocaleString()}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all border-l-4 border-l-blue-500/20">
                            <span className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">Total Employees</span>
                            <h3 className="text-3xl font-semibold text-blue-400 font-sans tracking-tight">{employeeStats.totalEmployees}</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg gap-4">
                <div className="flex items-center gap-4 flex-1 w-full lg:max-w-2xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search employees..."
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
                            <option value="alpha" className="bg-gray-900">Name (A-Z)</option>
                            <option value="salary-desc" className="bg-gray-900">Salary (High to Low)</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Briefcase size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="All" className="bg-gray-900">All Roles</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.name} className="bg-gray-900">{r.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <button
                        onClick={loadMonthlySheet}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border border-indigo-700"
                    >
                        <ClipboardCheck size={18} /> Attendance
                    </button>
                    <button
                        onClick={() => setIsRoleModalOpen(true)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border border-gray-700"
                    >
                        <Settings size={18} /> Manage Categories
                    </button>
                    <button
                        onClick={() => {
                            setEditingEmployee(null);
                            setFormData({ name: '', role: '', phone: '', salary: '' });
                            setIsModalOpen(true);
                            loadEmployees();
                            loadEmployeeStats();
                            fetchRoles();
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        <UserPlus size={18} /> Add Employee
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{employees.length}</span>
            </div>

            <div className="bg-secondary-bg border border-gray-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xl min-h-[400px]">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-gray-300 table-fixed">
                        <thead className="table-header sticky top-0 z-10 bg-[#121826] mb-2">
                            <tr>
                                <th className="table-header-cell">Employee</th>
                                <th className="table-header-cell">Role</th>
                                <th className="table-header-cell">Contact</th>
                                <th className="table-header-cell">Salary</th>
                                <th className="table-header-cell text-center">Attendance</th>
                                <th className="table-header-cell text-center">Status</th>
                                <th className="table-header-cell text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {employees.length === 0 ? <tr><td colSpan="5" className="p-10 text-center text-gray-500 italic">No employees found.</td></tr> :
                                employees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-800/20 transition-colors group">
                                        <td className="table-data-cell">
                                            <div className="text-white text-sm">{emp.name}</div>
                                        </td>
                                        <td className="table-data-cell">
                                            <span className="text-white text-sm">{emp.role}</span>
                                        </td>
                                        <td className="table-data-cell text-white text-sm">
                                            {emp.phone}
                                        </td>
                                        <td className="table-data-cell">
                                            <span className="text-white text-sm">Rs. {emp.salary.toLocaleString()}</span>
                                        </td>
                                        <td className="table-data-cell text-center">
                                            {emp.today_status === 'Present' ? (
                                                <span className="px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                                    Present
                                                </span>
                                            ) : emp.today_status === 'Absent' ? (
                                                <span className="px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest">
                                                    Absent
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 rounded-full border border-gray-500/30 bg-gray-500/10 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                                                    Not Marked
                                                </span>
                                            )}
                                        </td>
                                        <td className="table-data-cell text-center">
                                            {emp.payment_id ? (
                                                <span className="px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest">
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-bold uppercase tracking-widest">
                                                    Unpaid
                                                </span>
                                            )}
                                        </td>
                                        <td className="table-data-cell">
                                            <div className="flex items-center justify-center gap-2">
                                                {deleteConfirm === emp.id ? (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                        <button
                                                            onClick={() => handleDelete(emp.id)}
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
                                                ) : payConfirm === emp.id ? (
                                                    <div className="flex items-center gap-1 bg-emerald-500/10 p-1 rounded-xl border border-emerald-500/20">
                                                        <button
                                                            onClick={() => handlePaySalary(emp)}
                                                            className="p-1.5 text-emerald-400 hover:bg-emerald-400/20 rounded-lg transition-all"
                                                            title="Confirm Payment"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setPayConfirm(null)}
                                                            className="p-1.5 text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all"
                                                            title="Cancel"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => { setSelectedEmpForAttendance(emp); setIsAttendanceModalOpen(true); }}
                                                            title="Mark Attendance"
                                                            className="p-2 text-amber-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all"
                                                        >
                                                            <ClipboardCheck size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => !emp.payment_id && setPayConfirm(emp.id)}
                                                            disabled={emp.payment_id}
                                                            title={emp.payment_id ? "Salary already paid for this month" : "Pay Salary"}
                                                            className={`p-2 rounded-xl transition-all ${emp.payment_id
                                                                ? 'text-gray-600 cursor-not-allowed opacity-50'
                                                                : 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-400/10'
                                                                }`}
                                                        >
                                                            <DollarSign size={18} />
                                                        </button>
                                                        <button onClick={() => handleEdit(emp)} title="Edit" className="p-2 text-white hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"><Edit2 size={18} /></button>
                                                        <button onClick={() => setDeleteConfirm(emp.id)} title="Delete" className="p-2 text-red-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"><Trash2 size={18} /></button>
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
                    <div className="bg-secondary-bg w-full max-w-lg rounded-2xl border border-gray-700 p-6 shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Full Name</label>
                                <input required placeholder="Adnan Khan" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Role</label>
                                <select
                                    required
                                    className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="" disabled className="bg-gray-900">Select Role</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.name} className="bg-gray-900">{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Phone</label>
                                    <input required placeholder="+92 3XX XXXXXXX" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                        value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Salary</label>
                                    <input required type="number" placeholder="25000" className="w-full bg-primary-bg p-3.5 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                        value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-4 border-t border-gray-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all">Save Employee</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Role Management Modal */}
            {isRoleModalOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsRoleModalOpen(false); }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-md rounded-2xl border border-gray-700 p-6 shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider text-amber-500">Manage Employee Roles</h3>
                            <button onClick={() => setIsRoleModalOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                placeholder="Enter role name..."
                                className="flex-1 bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-indigo-500 transition-colors"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                            />
                            <button
                                onClick={handleAddRole}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl transition-all"
                            >
                                {editingRole ? <Check size={20} /> : <Plus size={20} />}
                            </button>
                            {editingRole && (
                                <button
                                    onClick={() => { setEditingRole(null); setNewRoleName(''); }}
                                    className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                            {roles.length === 0 ? (
                                <p className="text-center text-gray-500 py-4 italic">No roles added yet.</p>
                            ) : roles.map(role => (
                                <div key={role.id} className="flex items-center justify-between bg-primary-bg/50 p-3 rounded-xl border border-gray-800 hover:border-gray-700 transition-all group">
                                    <span className="text-gray-200">{role.name}</span>
                                    <div className="flex items-center gap-1">
                                        {deleteRoleConfirm === role.id ? (
                                            <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-lg border border-rose-500/20">
                                                <button
                                                    onClick={() => handleDeleteRole(role.id)}
                                                    className="p-1 text-emerald-400 hover:bg-emerald-400/20 rounded-md transition-all"
                                                    title="Confirm Delete"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteRoleConfirm(null)}
                                                    className="p-1 text-rose-400 hover:bg-rose-400/20 rounded-md transition-all"
                                                    title="Cancel"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => { setEditingRole(role); setNewRoleName(role.name); }}
                                                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteRoleConfirm(role.id)}
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
                            onClick={() => setIsRoleModalOpen(false)}
                            className="w-full mt-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Attendance Marking Modal */}
            {isAttendanceModalOpen && selectedEmpForAttendance && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsAttendanceModalOpen(false); }} className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-secondary-bg w-full max-w-sm rounded-2xl border border-gray-700 p-6 shadow-2xl overflow-hidden text-center">
                        <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Mark Attendance</h3>
                        <p className="text-gray-400 mb-6">For: <span className="text-white font-semibold">{selectedEmpForAttendance.name}</span></p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleMarkAttendance(selectedEmpForAttendance, 'Present')}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
                            >
                                <Check size={24} /> Present
                            </button>
                            <button
                                onClick={() => handleMarkAttendance(selectedEmpForAttendance, 'Absent')}
                                className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
                            >
                                <X size={24} /> Absent
                            </button>
                            <button
                                onClick={() => setIsAttendanceModalOpen(false)}
                                className="w-full py-2 text-gray-500 hover:text-white mt-2 font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance History Modal */}
            {isAttendanceHistoryOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsAttendanceHistoryOpen(false); }} className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-secondary-bg w-full max-w-5xl rounded-3xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-[#121826]">
                            <div className="flex items-center gap-3">
                                <History className="text-indigo-400" size={24} />
                                <h3 className="text-2xl font-bold text-white tracking-wide">Attendance History</h3>
                            </div>
                            <button onClick={() => setIsAttendanceHistoryOpen(false)} className="text-gray-500 hover:text-white p-2">✕</button>
                        </div>

                        {/* Filter Bar */}
                        <div className="bg-[#1a2233] p-4 border-b border-gray-800 flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-3 bg-primary-bg px-4 py-2 rounded-xl border border-gray-700">
                                <Calendar size={18} className="text-white" />
                                <input
                                    type="date"
                                    value={historyFilterDate}
                                    onChange={(e) => setHistoryFilterDate(e.target.value)}
                                    className="bg-transparent text-white text-sm outline-none cursor-pointer"
                                    style={{ colorScheme: 'dark' }}
                                    title="Filter by Date"
                                />
                                {historyFilterDate && (
                                    <button onClick={() => setHistoryFilterDate('')} className="text-gray-500 hover:text-white ml-2">✕</button>
                                )}
                            </div>

                            <div className="flex items-center gap-3 bg-primary-bg px-4 py-2 rounded-xl border border-gray-700">
                                <Calendar size={18} className="text-white" />
                                <input
                                    type="month"
                                    value={historyFilterMonth}
                                    onChange={(e) => {
                                        setHistoryFilterMonth(e.target.value);
                                        setHistoryFilterDate(''); // Clear specific date if month is picked
                                    }}
                                    className="bg-transparent text-white text-sm outline-none cursor-pointer"
                                    style={{ colorScheme: 'dark' }}
                                    title="Filter by Month"
                                />
                                {historyFilterMonth !== format(new Date(), 'yyyy-MM') && (
                                    <button
                                        onClick={() => setHistoryFilterMonth(format(new Date(), 'yyyy-MM'))}
                                        className="text-gray-500 hover:text-white ml-2"
                                        title="Reset to current month"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3 bg-primary-bg px-4 py-2 rounded-xl border border-gray-700 min-w-[200px]">
                                <Briefcase size={18} className="text-indigo-400" />
                                <select
                                    value={historyFilterEmployee}
                                    onChange={(e) => setHistoryFilterEmployee(e.target.value)}
                                    className="bg-transparent text-white text-sm outline-none w-full cursor-pointer"
                                >
                                    <option value="All" className="bg-gray-900">All Employees</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id} className="bg-gray-900">{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-[#0f1420] text-gray-500 uppercase text-xs font-bold tracking-widest border-b border-gray-800">
                                    <tr>
                                        <th className="px-4 py-3">Date & Time</th>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-center">Total (P/T)</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {attendanceHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-4 py-10 text-center text-gray-500 italic font-medium">
                                                No attendance records found.
                                            </td>
                                        </tr>
                                    ) : (
                                        attendanceHistory.map(record => (
                                            <tr key={`${record.employee_id}-${record.date}`} className="hover:bg-gray-800/10 transition-colors">
                                                <td className="px-4 py-4 text-white font-medium">
                                                    {record.created_at
                                                        ? format(new Date(record.created_at), 'yyyy-MM-dd hh:mm a')
                                                        : `${record.date} (--)`}
                                                </td>
                                                <td className="px-4 py-4 text-white">{record.employee_name}</td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${record.status === 'Present'
                                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                        : record.status === 'Absent'
                                                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                        }`}>
                                                        {record.status || 'Not Marked'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center text-indigo-400 font-bold">
                                                    {record.present_count || 0} / {record.total_count || 0}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => handleUpdateAttendanceStatus(record.id, record.status, record.employee_id, record.date)}
                                                        className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                        title={record.status ? "Change Status" : "Mark as Present"}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 bg-[#121826] border-t border-gray-800 flex justify-end">
                            <button
                                onClick={() => setIsAttendanceHistoryOpen(false)}
                                className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly Attendance Sheet (Full Page) */}
            {isAttendanceSheetOpen && (
                <div className="fixed inset-0 z-[100] bg-white overflow-auto flex flex-col p-8 animate-in fade-in duration-300">
                    <div className="max-w-[1400px] mx-auto w-full">
                        {/* Header Section */}
                        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
                            <div>
                                <h1 className="text-3xl font-serif text-black uppercase tracking-tighter mb-2" style={{ fontFamily: '"Libre Baskerville", serif' }}>Monthly Attendance Sheet for Employees</h1>
                                <p className="text-xs text-gray-600 uppercase tracking-widest font-bold">AESTHETIC AURA CLINIC - CITY CENTER PLAZA, NEW CITY PHASE 2, WAH - 0300-0140566</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <button
                                    onClick={() => setIsAttendanceSheetOpen(false)}
                                    className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold mb-4 no-print print:hidden"
                                >
                                    Close Sheet
                                </button>
                                <div className="text-right">
                                    <div className="flex gap-4 text-xs font-bold text-black border border-black p-2 bg-gray-50">
                                        <div>
                                            <span className="uppercase tracking-tight text-[10px] text-gray-500 block">Number of Attendees:</span>
                                            <span className="text-lg">{sheetData.length}</span>
                                        </div>
                                        <div className="border-l border-black pl-4">
                                            <span className="uppercase tracking-tight text-[10px] text-gray-500 block">Date:</span>
                                            <span className="text-lg">{format(new Date(), 'dd-MM-yy')}</span>
                                        </div>
                                        <div className="border-l border-black pl-4 flex flex-col no-print">
                                            <span className="uppercase tracking-tight text-[10px] text-gray-500 block">Select Month:</span>
                                            <div className="flex items-center gap-1">
                                                <div className="flex items-center gap-0 border border-black/20 rounded bg-white hover:border-black/40 transition-colors px-1">
                                                    <select
                                                        value={selectedMonth.split('-')[1]}
                                                        onChange={(e) => setSelectedMonth(`${selectedMonth.split('-')[0]}-${e.target.value}`)}
                                                        className="bg-transparent text-black text-[13px] font-bold outline-none cursor-pointer py-0.5"
                                                    >
                                                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => (
                                                            <option key={m} value={m}>{format(new Date(2000, parseInt(m) - 1), 'MMMM')}</option>
                                                        ))}
                                                    </select>
                                                    <span className="text-black/30 font-light mx-0.5">|</span>
                                                    <select
                                                        value={selectedMonth.split('-')[0]}
                                                        onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonth.split('-')[1]}`)}
                                                        className="bg-transparent text-black text-[13px] font-bold outline-none cursor-pointer py-0.5"
                                                    >
                                                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {selectedMonth !== format(new Date(), 'yyyy-MM') && (
                                                    <button
                                                        onClick={() => setSelectedMonth(format(new Date(), 'yyyy-MM'))}
                                                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                                                        title="Back to current month"
                                                    >
                                                        <X size={14} className="text-gray-500" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="border-l border-black pl-4 print:block hidden">
                                            <span className="uppercase tracking-tight text-[10px] text-gray-500 block">Month/Year:</span>
                                            <span className="text-lg">{format(new Date(selectedMonth + '-01'), 'MMMM yy')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grid Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-black text-black text-[10px]">
                                <thead>
                                    <tr>
                                        <th rowSpan="2" className="border-2 border-black bg-blue-100/50 p-2 text-center w-56 uppercase font-bold tracking-tight text-[14px]">
                                            Employee<br />Name
                                        </th>
                                        {daysInMonth.map(d => (
                                            <th key={`dayname-${d.dayNum}`} className="border border-black bg-blue-50/50 p-1 text-center font-bold text-gray-600 border-b-2">
                                                {d.dayName}
                                            </th>
                                        ))}
                                        <th rowSpan="2" className="border-2 border-black bg-blue-100/50 p-1 text-center w-20 uppercase font-semibold tracking-tighter text-[12px]">
                                            Total<br />Presents
                                        </th>
                                        <th rowSpan="2" className="border-2 border-black bg-blue-100/50 p-1 text-center w-20 uppercase font-semibold tracking-tighter text-[12px]">
                                            Total<br />Absents
                                        </th>
                                    </tr>
                                    <tr>
                                        {daysInMonth.map(d => (
                                            <th key={`daynum-${d.dayNum}`} className="border border-black bg-white p-1 text-center font-bold text-base">
                                                {d.dayNum}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sheetData.map((row, idx) => (
                                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                                            <td className="border-2 border-black p-2 font-black uppercase tracking-tight truncate max-w-56 bg-blue-50/30 text-[13px]">
                                                {row.name}
                                            </td>
                                            {daysInMonth.map(d => {
                                                const status = row.attendance[d.fullDate];
                                                const isSunday = d.isSunday;
                                                return (
                                                    <td
                                                        key={`${row.id}-${d.dayNum}`}
                                                        className={`border border-black text-center p-0 h-8 font-black text-[15px] ${status === 'Present' ? 'bg-emerald-100' :
                                                            status === 'Absent' ? 'bg-rose-100' :
                                                                isSunday ? 'bg-blue-200/40' : ''
                                                            }`}
                                                    >
                                                        {status === 'Present' ? 'P' : status === 'Absent' ? 'A' : ''}
                                                    </td>
                                                );
                                            })}
                                            <td className="border-2 border-black text-center p-0 h-8 font-black text-[14px] bg-blue-50/30">
                                                {Object.values(row.attendance).filter(s => s === 'Present').length}
                                            </td>
                                            <td className="border-2 border-black text-center p-0 h-8 font-black text-[14px] bg-blue-50/30">
                                                {Object.values(row.attendance).filter(s => s === 'Absent').length}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Empty rows to match the image look if needed */}
                                    {[...Array(Math.max(0, 15 - sheetData.length))].map((_, i) => (
                                        <tr key={`empty-${i}`}>
                                            <td className="border-2 border-black p-2 h-8 bg-blue-50/30"></td>
                                            {daysInMonth.map(d => (
                                                <td key={`empty-${i}-${d.dayNum}`} className={`border border-black h-8 ${d.isSunday ? 'bg-blue-200/40' : ''}`}></td>
                                            ))}
                                            <td className="border-2 border-black h-8 bg-blue-50/30"></td>
                                            <td className="border-2 border-black h-8 bg-blue-50/30"></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>


                    </div>

                    <style>
                        {`
                        @media print {
                            .no-print { display: none !important; }
                            body { background: white !important; }
                            @page { size: landscape; margin: 0.5cm; }
                        }
                        `}
                    </style>
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

export default Employees;
