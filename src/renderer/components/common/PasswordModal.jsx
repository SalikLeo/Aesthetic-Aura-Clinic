import React, { useState, useEffect } from 'react';
import { Lock, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import db from '../../database/db';

const PasswordModal = ({ isOpen, onClose, onVerified, actionName }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setInitialLoading(true);
            const checkEmpty = async () => {
                try {
                    const setting = await db.get("SELECT value FROM settings WHERE key = 'action_password'");
                    const correctPassword = setting?.value || '';
                    if (correctPassword === '') {
                        onVerified();
                        onClose();
                    } else {
                        setInitialLoading(false);
                    }
                } catch (err) {
                    console.error("DB check failed", err);
                    setInitialLoading(false);
                }
            };
            checkEmpty();
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(false);

        try {
            const setting = await db.get("SELECT value FROM settings WHERE key = 'action_password'");
            const correctPassword = setting?.value || '';

            // If no password is set, allow action
            if (correctPassword === '' || password === correctPassword) {
                onVerified();
                onClose();
                setPassword('');
            } else {
                setError(true);
            }
        } catch (err) {
            console.error("Password verification failed:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || initialLoading) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#121826] w-full max-w-md rounded-3xl shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-cyan-600 p-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <Lock size={24} className="animate-pulse" />
                        <div>
                            <h3 className="text-lg font-bold uppercase tracking-wider">Security Required</h3>
                            <p className="text-xs text-white/70 font-medium">Verify password to proceed</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="bg-cyan-500/10 p-5 rounded-full mb-4">
                            <ShieldCheck className="text-cyan-400" size={40} />
                        </div>
                        <h4 className="text-xl font-bold text-white mb-2">Restricted Action</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            A security password is required to <span className="text-rose-400 font-bold">{actionName || 'perform this action'}</span>.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-300 px-1 text-center">Enter Security Password</label>
                            <input
                                autoFocus
                                required
                                type="password"
                                placeholder="••••••••"
                                className={`w-full bg-[#0f1420] border-2 ${error ? 'border-rose-500 shadow-lg shadow-rose-900/10' : 'border-gray-800'} text-center text-2xl tracking-[0.5em] py-4 rounded-2xl text-white outline-none focus:border-cyan-500/50 transition-all font-mono`}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError(false);
                                }}
                            />
                            {error && (
                                <p className="text-rose-500 text-xs font-bold text-center animate-bounce mt-2 flex items-center justify-center gap-1">
                                    <ShieldAlert size={14} /> Incorrect password. Please try again.
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-2xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-cyan-900/20"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Verify & Proceed</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PasswordModal;
