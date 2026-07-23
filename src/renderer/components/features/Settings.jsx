import React, { useState, useEffect } from 'react';
import { Save, Lock, ShieldCheck, ShieldAlert, Key, Trash2, Check, X } from 'lucide-react';
import db from '../../database/db';
import PasswordModal from '../common/PasswordModal';

const Settings = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [hasPassword, setHasPassword] = useState(false);

    // Security state for removal
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });
    const [isClearingConfirmed, setIsClearingConfirmed] = useState(false);

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const setting = await db.get("SELECT value FROM settings WHERE key = 'action_password'");
            if (setting && setting.value) {
                setHasPassword(true);
            } else {
                setHasPassword(false);
            }
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match!' });
            return;
        }

        setSaving(true);
        try {
            await db.run("UPDATE settings SET value = ? WHERE key = 'action_password'", [password]);
            setMessage({ type: 'success', text: 'Security password updated successfully!' });
            setPassword('');
            setConfirmPassword('');
            loadSettings(); // Refresh status

            // Dispatch event to notify layout (if needed)
            window.dispatchEvent(new CustomEvent('db-update'));
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to update password.' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    const handleRemovePassword = () => {
        requestSecureAction(async () => {
            try {
                await db.run("UPDATE settings SET value = ? WHERE key = 'action_password'", ['']);
                setMessage({ type: 'success', text: 'Security password removed!' });
                setHasPassword(false);
                window.dispatchEvent(new CustomEvent('db-update'));
            } catch (err) {
                console.error(err);
                setMessage({ type: 'error', text: 'Failed to remove password.' });
            } finally {
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        }, "Remove Security Password");
    };

    const handleClearAllData = () => {
        requestSecureAction(async () => {
            try {
                setSaving(true);
                const tables = [
                    'attendance',
                    'appointments',
                    'invoice_products',
                    'invoice_services',
                    'invoice_doctors',
                    'invoices',
                    'sessions',
                    'expenses',
                    'patients',
                    'doctors',
                    'employees',
                    'services',
                    'products'
                ];

                for (const table of tables) {
                    await db.run(`DELETE FROM ${table}`);
                    try {
                        await db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, [table]);
                    } catch (e) {
                        // ignore if sequence doesn't exist
                    }
                }

                setIsClearingConfirmed(false);
                setMessage({ type: 'success', text: 'All application data has been permanently cleared!' });
                window.dispatchEvent(new CustomEvent('db-update'));
            } catch (err) {
                console.error(err);
                setMessage({ type: 'error', text: 'Failed to clear data.' });
            } finally {
                setSaving(false);
                setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            }
        }, "Clear All Application Data");
    };

    if (loading) {
        return <div className="p-10 text-center text-gray-500 italic">Loading settings...</div>;
    }

    return (
        <div className="p-8 h-screen overflow-y-auto custom-scrollbar bg-primary-bg">
            <div className="max-w-4xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-4xl font-bold text-cyan-400 tracking-tight flex items-center gap-3">
                        <Lock className="text-cyan-400" size={36} />
                        Security Settings
                    </h1>
                    <p className="text-gray-400 mt-2 text-lg">Manage application access and action protection</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Password Section */}
                    <div className="bg-[#121826] border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Key size={120} />
                        </div>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-cyan-500/10 p-3 rounded-2xl">
                                <ShieldCheck className="text-cyan-400" size={24} />
                            </div>
                            <h2 className="text-2xl font-semibold text-white">Action Protection</h2>
                        </div>

                        <p className="text-gray-400 mb-8 leading-relaxed">
                            Set a password that will be required whenever someone attempts to
                            <span className="text-rose-400 font-semibold mx-1">Edit</span> or
                            <span className="text-rose-400 font-semibold mx-1">Delete</span>
                            records in this application.
                        </p>

                        <form onSubmit={handleSavePassword} className="space-y-6">
                            <div className="space-y-2 text-right">
                                <label className="block text-sm font-medium text-gray-300 text-left px-1">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                    <input
                                        required
                                        type="password"
                                        placeholder="Enter secure password"
                                        className="w-full bg-[#0f1420] border-2 border-gray-800 pl-12 pr-4 py-3.5 rounded-2xl text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300 px-1">Confirm Password</label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                    <input
                                        required
                                        type="password"
                                        placeholder="Confirm secure password"
                                        className="w-full bg-[#0f1420] border-2 border-gray-800 pl-12 pr-4 py-3.5 rounded-2xl text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {message.text && (
                                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                    }`}>
                                    {message.type === 'success' ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                                    <span className="text-sm font-medium">{message.text}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-cyan-900/20 group"
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Save size={20} className="group-hover:scale-110 transition-transform" />
                                        Update Security Password
                                    </>
                                )}
                            </button>

                            {hasPassword && (
                                <button
                                    type="button"
                                    onClick={handleRemovePassword}
                                    className="w-full bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 border border-rose-500/30 mt-4 group"
                                >
                                    <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
                                    Remove Protection
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Information Card */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-[#121826] border border-gray-800 rounded-3xl p-8 shadow-2xl">
                            <h3 className="text-xl font-semibold text-white mb-4">How it works</h3>
                            <ul className="space-y-4 text-gray-400">
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-cyan-400 text-xs font-bold">1</span>
                                    </div>
                                    <p>Set a master password in the Action Protection form.</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-cyan-400 text-xs font-bold">2</span>
                                    </div>
                                    <p>Any attempt to modify or delete a record will trigger a verification popup.</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-cyan-400 text-xs font-bold">3</span>
                                    </div>
                                    <p>Only with the correct password can the action be completed.</p>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <ShieldAlert className="text-rose-500" size={24} />
                                <h3 className="text-xl font-semibold text-white">Advanced Options</h3>
                            </div>
                            <p className="text-gray-400 mb-6 leading-relaxed">
                                Use these options with extreme caution. Clearing data is permanent and cannot be undone.
                            </p>
                            {isClearingConfirmed ? (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <button
                                        onClick={handleClearAllData}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20"
                                    >
                                        <Check size={20} />
                                        Confirm
                                    </button>
                                    <button
                                        onClick={() => setIsClearingConfirmed(false)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border border-gray-700"
                                    >
                                        <X size={20} />
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsClearingConfirmed(true)}
                                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-rose-900/20 group"
                                >
                                    <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
                                    Clear All Application Data
                                </button>
                            )}
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 shadow-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <ShieldAlert className="text-amber-500" size={24} />
                                <h3 className="text-xl font-semibold text-white">Security Tip</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                                Avoid using simple passwords. Leave the field empty if you want to disable password protection (not recommended for production environments).
                            </p>
                        </div>
                    </div>
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

export default Settings;
