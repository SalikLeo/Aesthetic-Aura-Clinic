import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, BriefcaseMedical, CreditCard, Activity, ShoppingBag, UserCircle, Receipt, FileText, Clipboard, Settings } from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/appointments', label: 'Appointments', icon: Calendar },
        { path: '/patients', label: 'Patients', icon: Users },
        { path: '/sessions', label: 'Sessions', icon: Clipboard },
        { path: '/expenses', label: 'Expenses', icon: Receipt },
        { path: '/employees', label: 'Employees', icon: UserCircle },
        { path: '/doctors', label: 'Doctors', icon: BriefcaseMedical },
        { path: '/services', label: 'Services', icon: Activity },
        { path: '/products', label: 'Products', icon: ShoppingBag },
        { path: '/reports', label: 'Reports', icon: FileText },
        { path: '/billing', label: 'Billing', icon: CreditCard },
        { path: '/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="w-64 bg-secondary-bg h-screen flex flex-col border-r border-gray-800 overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="p-6">
                {/* Logo */}
                <div className="flex justify-center mb-4">
                    <img
                        src="resources/logo.jpeg"
                        alt="Clinic Logo"
                        className="w-[160px] h-auto object-contain rounded-3xl shadow-lg border border-gray-800/50"
                        style={{ imageRendering: '-webkit-optimize-contrast' }}
                        onError={(e) => {
                            const currentSrc = e.target.src;
                            if (currentSrc.includes('/resources/logo.jpeg')) {
                                // Try external assets as backup
                                e.target.src = 'asset://logo.jpeg';
                            } else if (currentSrc.includes('asset://logo.jpeg')) {
                                e.target.src = 'asset://logo.png';
                            } else if (currentSrc.includes('asset://logo.png')) {
                                e.target.src = 'asset://logo.jpg';
                            } else {
                                // Hide image if all formats fail
                                e.target.style.display = 'none';
                            }
                        }}
                    />
                </div>

                <h1 className="text-2xl font-bold text-emerald-500">
                    Aesthetic Aura
                </h1>
                <p className="text-sm text-gray-300 font-semibold mt-1">By Dr. Maryum Qazi</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-600/20'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-800">
                <div className="text-center px-4 py-2 font-poppins">
                    <p className="text-sm text-white/70 font-medium">Software by</p>
                    <p className="text-lg font-bold text-white mt-1">PrimeSoft Agency</p>
                    <p className="text-sm text-white/50 mt-1">0309-5369472</p>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;

