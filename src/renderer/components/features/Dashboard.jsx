import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BriefcaseMedical, CalendarCheck, DollarSign, ArrowDownRight, TrendingUp, ShoppingBag, Receipt, Eye, EyeOff } from 'lucide-react';
import db from '../../database/db';
import PasswordModal from '../common/PasswordModal';

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        patients: 0,
        appointments: 0,
        revenue: 0,
        topPatient: 'None',
        topService: 'None',
        topProduct: 'None',
        totalSalesCount: 0
    });
    const [upcomingApps, setUpcomingApps] = useState([]);
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [financeStats, setFinanceStats] = useState({ sales: 0, expenses: 0, profit: 0, discounts: 0 });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showStats, setShowStats] = useState(false);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000); // 1 second
        return () => clearInterval(timer);
    }, []);

    const calculateTimeLeft = (date, time, type = 'appointment') => {
        if (!date || !time) return "N/A";
        const appointmentDate = new Date(`${date}T${time}`);
        const diff = appointmentDate - currentTime;

        if (diff <= 0) return type === 'appointment' ? "Patient Arrived" : "Reminder Due";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        let timeLeft = "";
        if (days > 0) timeLeft += `${days}D `;
        if (hours > 0) timeLeft += `${hours}H `;
        if (minutes > 0) timeLeft += `${minutes}M `;
        if (seconds > 0 || timeLeft === "") timeLeft += `${seconds}S`;

        return timeLeft.trim();
    };

    const fetchStats = async () => {
        try {
            const patients = await db.get("SELECT COUNT(*) as count FROM patients");
            const appointments = await db.get("SELECT COUNT(*) as count FROM appointments WHERE date(date) = date('now', 'localtime')");
            const revenue = await db.get("SELECT SUM(total) as total FROM invoices WHERE status='paid'");

            // Top Patient - based on total bills and sessions
            const topPat = await db.get(`
                SELECT p.name, 
                       (COUNT(DISTINCT i.id) + COUNT(DISTINCT s.id)) as count
                FROM patients p
                LEFT JOIN invoices i ON p.id = i.patient_id
                LEFT JOIN sessions s ON p.id = s.patient_id
                GROUP BY p.id
                HAVING count > 0
                ORDER BY count DESC
                LIMIT 1
            `);

            // Top Service
            const topServ = await db.get(`
                SELECT s.name, COUNT(iserv.id) as count
                FROM invoice_services iserv
                JOIN services s ON iserv.service_id = s.id
                GROUP BY iserv.service_id
                ORDER BY count DESC
                LIMIT 1
            `);

            // Top Product
            const topProd = await db.get(`
                SELECT p.name, COUNT(iprod.id) as count
                FROM invoice_products iprod
                JOIN products p ON iprod.product_id = p.id
                GROUP BY iprod.product_id
                ORDER BY count DESC
                LIMIT 1
            `);

            setStats({
                patients: patients?.count || 0,
                appointments: appointments?.count || 0,
                revenue: revenue?.total || 0,
                topPatient: topPat ? `${topPat.name} (${topPat.count})` : 'None',
                topService: topServ ? `${topServ.name} (${topServ.count})` : 'None',
                topProduct: topProd ? `${topProd.name} (${topProd.count})` : 'None'
            });

            const apps = await db.all(`
                SELECT a.date, a.time, a.reason, a.reminder_date, a.reminder_time, p.name as patient_name, p.phone
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE date(a.date) >= date('now', 'localtime') AND a.status = 'pending'
                ORDER BY a.date ASC, a.time ASC
                LIMIT 5
            `);
            setUpcomingApps(apps || []);
        } catch (error) {
            console.error("Failed to load dashboard stats:", error);
        }
    };

    const loadFinanceStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date(date) = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date(date) >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date(date) >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date(date) >= date('now', 'localtime', 'start of year')";

            // Total Sales (Gross)
            const salesRes = await db.get(`SELECT SUM(total + item_discount) as total FROM invoices i WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}`);
            const totalSales = salesRes?.total || 0;
            const expensesQuery = `SELECT SUM(amount) as total FROM expenses ${dateFilter ? 'WHERE ' + dateFilter : ''}`;
            const discountsQuery = `SELECT SUM(item_discount) as total FROM invoices WHERE status='paid' ${dateFilter ? 'AND ' + dateFilter : ''}`;

            const exp = await db.get(expensesQuery);
            const disc = await db.get(discountsQuery);

            const totalExp = exp?.total || 0;
            const totalDisc = disc?.total || 0;

            // Net Profit = Sales - Expenses - Discounts
            const netProfit = totalSales - totalExp - totalDisc;

            // --- PERIOD BASED TOP STATS ---
            const filterPrefixShort = dateFilter ? 'WHERE ' + dateFilter : '';
            const filterPrefixLong = dateFilter ? 'AND ' + dateFilter.replace('date(', 'date(i.') : '';
            const filterPrefixSessions = dateFilter ? 'WHERE ' + dateFilter.replace('date(', 'date(s.') : '';

            // Top Patient for period (matches Patients.jsx logic)
            const topPat = await db.get(`
                SELECT 
                    p.name,
                    (
                        (SELECT COUNT(*) FROM sessions WHERE patient_id = p.id ${filterPrefixShort ? 'AND ' + filterPrefixShort.replace('WHERE ', '') : ''}) + 
                        (SELECT COUNT(*) FROM invoices WHERE patient_id = p.id ${filterPrefixShort ? 'AND ' + filterPrefixShort.replace('WHERE ', '') : ''})
                    ) as count
                FROM patients p
                WHERE count > 0
                ORDER BY count DESC
                LIMIT 1
            `);

            // Top Service for period
            const topServ = await db.get(`
                SELECT s.name, COUNT(iserv.id) as count
                FROM invoice_services iserv
                JOIN services s ON iserv.service_id = s.id
                JOIN invoices i ON iserv.invoice_id = i.id
                WHERE i.status='paid' ${filterPrefixLong}
                GROUP BY iserv.service_id
                ORDER BY count DESC
                LIMIT 1
            `);

            // Top Product for period
            const topProd = await db.get(`
                SELECT p.name, COUNT(iprod.id) as count
                FROM invoice_products iprod
                JOIN products p ON iprod.product_id = p.id
                JOIN invoices i ON iprod.invoice_id = i.id
                WHERE i.status='paid' ${filterPrefixLong}
                GROUP BY iprod.product_id
                ORDER BY count DESC
                LIMIT 1
            `);

            // Total Sales Count (Products + Services quantities)
            const prodCountRes = await db.get(`
                SELECT SUM(ip.quantity) as count 
                FROM invoice_products ip 
                JOIN invoices i ON ip.invoice_id = i.id 
                WHERE i.status='paid' ${filterPrefixLong}
            `);
            const servCountRes = await db.get(`
                SELECT SUM(iserv.quantity) as count 
                FROM invoice_services iserv 
                JOIN invoices i ON iserv.invoice_id = i.id 
                WHERE i.status='paid' ${filterPrefixLong}
            `);
            const totalSalesCount = (prodCountRes?.count || 0) + (servCountRes?.count || 0);

            setFinanceStats({
                sales: totalSales,
                expenses: totalExp,
                profit: netProfit,
                discounts: totalDisc
            });

            setStats(prev => ({
                ...prev,
                topPatient: topPat ? `${topPat.name} (${topPat.count})` : 'None',
                topService: topServ ? `${topServ.name} (${topServ.count})` : 'None',
                topProduct: topProd ? `${topProd.name} (${topProd.count})` : 'None',
                totalSalesCount
            }));
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchStats();
        loadFinanceStats();
    }, []);

    useEffect(() => {
        loadFinanceStats();
    }, [statsPeriod]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            fetchStats();
            loadFinanceStats();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [statsPeriod]); // statsPeriod is used in loadFinanceStats

    const cards = [
        { title: 'Total Patients', value: stats.patients, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { title: 'Top Patient', value: stats.topPatient, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { title: 'Appointments Today', value: stats.appointments, icon: CalendarCheck, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        { title: 'Total Sales', value: stats.totalSalesCount, icon: ShoppingBag, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { title: 'Top Service', value: stats.topService, icon: BriefcaseMedical, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        { title: 'Top Product', value: stats.topProduct, icon: ShoppingBag, color: 'text-pink-400', bg: 'bg-pink-400/10' },
    ];

    return (
        <div className="p-6 h-screen overflow-y-auto custom-scrollbar flex flex-col gap-6">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Aesthetic Aura - Advance Skin & Laser Clinic</h1>

            {/* Overall Profit Section - Styled like the requested image */}
            <div className="bg-[#121826] border border-gray-800 rounded-3xl p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Financial Performance</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Financial Stats");
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                                <DollarSign size={24} />
                            </div>
                            <span className="text-gray-500 text-lg font-semibold mb-3 uppercase tracking-wide">Sales</span>
                            <h3 className="text-3xl font-semibold text-emerald-500 font-sans tracking-tight">Rs. {(financeStats.sales + financeStats.discounts).toLocaleString()}</h3>
                        </div>

                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-all">
                            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mb-4 text-rose-500">
                                <ArrowDownRight size={24} />
                            </div>
                            <span className="text-gray-500 text-lg font-semibold mb-3 uppercase tracking-wide">Expenses</span>
                            <h3 className="text-3xl font-semibold text-rose-500 font-sans tracking-tight">Rs. {financeStats.expenses.toLocaleString()}</h3>
                        </div>

                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all">
                            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 text-amber-500">
                                <Receipt size={24} />
                            </div>
                            <span className="text-gray-500 text-lg font-semibold mb-3 uppercase tracking-wide">Discounts</span>
                            <h3 className="text-3xl font-semibold text-amber-500 font-sans tracking-tight">Rs. {financeStats.discounts.toLocaleString()}</h3>
                        </div>

                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-accent-hover/30 transition-all relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1 h-full ${financeStats.profit >= 0 ? 'bg-accent' : 'bg-rose-500'}`}></div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${financeStats.profit >= 0 ? 'bg-accent/10 text-accent-hover' : 'bg-rose-500/10 text-rose-500'}`}>
                                <TrendingUp size={24} />
                            </div>
                            <span className="text-gray-500 text-lg font-semibold mb-3 uppercase tracking-wide">Net Profit</span>
                            <h3 className={`text-3xl font-semibold font-sans tracking-tight ${financeStats.profit >= 0 ? 'text-accent-hover' : 'text-rose-500'}`}>
                                Rs. {financeStats.profit.toLocaleString()}
                            </h3>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions - Full Width */}
            <div className="bg-secondary-bg p-8 rounded-3xl border border-gray-800 shadow-xl">
                <h3 className="text-2xl font-bold mb-6 text-white uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <button onClick={() => navigate('/billing', { state: { openNewInvoice: true } })} className="p-6 bg-[#0f1420] border border-gray-800 rounded-2xl hover:border-emerald-500/50 text-left transition-all group">
                        <span className="text-emerald-500 group-hover:text-emerald-400 font-manrope font-black capitalize tracking-tight block mb-1 text-2xl">New Bill</span>
                        <span className="text-sm text-gray-500 font-semibold">Create a new invoice</span>
                    </button>
                    <button onClick={() => navigate('/appointments', { state: { openNewAppointment: true } })} className="p-6 bg-[#0f1420] border border-gray-800 rounded-2xl hover:border-emerald-500/50 text-left transition-all group">
                        <span className="text-emerald-500 group-hover:text-emerald-400 font-manrope font-black capitalize tracking-tight block mb-1 text-2xl">New Appointment</span>
                        <span className="text-sm text-gray-500 font-semibold">Schedule a new appointment</span>
                    </button>
                    <button onClick={() => navigate('/expenses', { state: { openNewExpense: true } })} className="p-6 bg-[#0f1420] border border-gray-800 rounded-2xl hover:border-emerald-500/50 text-left transition-all group">
                        <span className="text-emerald-500 group-hover:text-emerald-400 font-manrope font-black capitalize tracking-tight block mb-1 text-2xl">New Expense</span>
                        <span className="text-sm text-gray-500 font-semibold">Record a new expense</span>
                    </button>
                    <button onClick={() => navigate('/sessions', { state: { openNewSession: true } })} className="p-6 bg-[#0f1420] border border-gray-800 rounded-2xl hover:border-emerald-500/50 text-left transition-all group">
                        <span className="text-emerald-500 group-hover:text-emerald-400 font-manrope font-black capitalize tracking-tight block mb-1 text-2xl">New Session</span>
                        <span className="text-sm text-gray-500 font-semibold">Log a new session</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {showStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    {cards.map((card, index) => (
                        <div key={index} className="bg-secondary-bg p-6 rounded-2xl shadow-sm border border-gray-800 hover:border-gray-700 transition-all duration-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-lg font-semibold mb-2 uppercase tracking-wide">{card.title}</p>
                                    <h3 className={`text-3xl font-semibold mt-2 text-gray-100 ${card.title.includes('Income') ? 'font-sans' : ''}`}>{card.value}</h3>
                                </div>
                                <div className={`p-4 rounded-xl ${card.bg} ${card.color}`}>
                                    <card.icon size={28} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upcoming Appointments */}
            <div className="bg-secondary-bg p-8 rounded-3xl border border-gray-800 shadow-xl mb-6">
                <h3 className="text-2xl font-bold mb-6 text-white uppercase tracking-wider flex items-center justify-between">
                    Upcoming Appointments
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-white font-semibold text-sm">Count:</span>
                        <span className="text-white font-semibold text-sm">{upcomingApps.length}</span>
                    </div>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {upcomingApps.length === 0 ? (
                        <div className="md:col-span-2 text-gray-500 text-center py-10 italic border-2 border-dashed border-gray-800 rounded-2xl opacity-60">
                            No scheduled appointments for today.
                        </div>
                    ) : (
                        upcomingApps.map((app, i) => (
                            <div key={i} className="bg-[#0f1420] border-2 border-gray-800 p-5 rounded-3xl flex flex-col gap-4 hover:border-accent-hover/40 transition-all shadow-lg group">
                                {/* Header: Patient Info */}
                                <div className="flex justify-between items-start border-b border-gray-800 pb-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-3">
                                            <span className="text-white text-2xl font-bold tracking-tight">{app.patient_name}</span>
                                            <span className="text-gray-400 font-semibold text-xs uppercase tracking-widest bg-gray-800/50 px-2 py-0.5 rounded"> {app.reason}</span>
                                        </div>
                                        <span className="text-gray-500 text-base font-semibold">{app.phone}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-gray-400 font-poppins text-sm font-medium uppercase tracking-wider">Booking Date: {app.date}</div>
                                    </div>
                                </div>

                                {/* Row 1: Appointment Info */}
                                <div className="grid grid-cols-2 gap-4 bg-gray-900/30 p-3 rounded-2xl border border-gray-800/50">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Appointment Time:</span>
                                        <span className="text-white text-lg font-bold">
                                            {new Date(`2000-01-01T${app.time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Time Remaining:</span>
                                        <span className={`text-lg font-bold uppercase ${calculateTimeLeft(app.date, app.time) === 'Patient Arrived' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {calculateTimeLeft(app.date, app.time)}
                                        </span>
                                    </div>
                                </div>

                                {/* Row 2: Reminder Info */}
                                <div className="grid grid-cols-2 gap-4 bg-cyan-500/5 p-3 rounded-2xl border border-cyan-500/10">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-cyan-500/60 uppercase font-semibold tracking-wider">Reminder Time:</span>
                                        <span className="text-cyan-400 text-lg font-bold">
                                            {app.reminder_time ? new Date(`2000-01-01T${app.reminder_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-xs text-cyan-500/60 uppercase font-semibold tracking-wider">Time Remaining:</span>
                                        <span className="text-cyan-400 text-lg font-bold uppercase">
                                            {app.reminder_time ? calculateTimeLeft(app.reminder_date || app.date, app.reminder_time, 'reminder') : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <PasswordModal
                isOpen={secureAction.isOpen}
                onClose={() => setSecureAction({ ...secureAction, isOpen: false })}
                onVerified={secureAction.onVerified}
                actionName={secureAction.actionName}
            />
        </div>
    );
};

export default Dashboard;
