import React, { useState, useEffect } from 'react';
import { Bell, X, Phone, User, Calendar, Clock } from 'lucide-react';
import db from '../../database/db';
import { format, isPast, parseISO } from 'date-fns';

const ReminderManager = () => {
    const [reminders, setReminders] = useState([]);
    const [audio] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')); // Optional: add a subtle sound

    const checkReminders = async () => {
        try {
            const now = new Date();
            const nowDate = format(now, 'yyyy-MM-dd');
            const nowTime = format(now, 'HH:mm');

            // Find reminders for today that are due and haven't been notified
            const query = `
                SELECT a.*, p.name as patient_name, p.phone as patient_phone
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.status = 'pending'
                AND a.reminder_notified = 0
                AND (
                    a.reminder_date < ? 
                    OR (a.reminder_date = ? AND a.reminder_time <= ?)
                )
            `;
            const dueReminders = await db.all(query, [nowDate, nowDate, nowTime]);

            if (dueReminders && dueReminders.length > 0) {
                setReminders(prev => [...prev, ...dueReminders]);
                // audio.play().catch(e => console.log("Audio play failed", e));

                // Mark as notified in DB immediately to avoid duplicate popups
                for (const r of dueReminders) {
                    await db.run("UPDATE appointments SET reminder_notified = 1 WHERE id = ?", [r.id]);
                }
            }
        } catch (err) {
            console.error("Failed to check reminders:", err);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                // Migration: Add reminder columns if they don't exist
                await db.run("ALTER TABLE appointments ADD COLUMN reminder_date TEXT");
            } catch (err) { }
            try {
                await db.run("ALTER TABLE appointments ADD COLUMN reminder_time TEXT");
            } catch (err) { }
            try {
                await db.run("ALTER TABLE appointments ADD COLUMN reminder_notified INTEGER DEFAULT 0");
            } catch (err) { }

            checkReminders();
        };
        init();
        const interval = setInterval(checkReminders, 1000);
        return () => clearInterval(interval);
    }, []);

    const dismissReminder = (id) => {
        setReminders(prev => prev.filter(r => r.id !== id));
    };

    if (reminders.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4 max-w-sm w-full">
            {reminders.map((reminder) => (
                <div
                    key={reminder.id}
                    className="bg-[#1a2233] border-2 border-cyan-500 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] overflow-hidden animate-in slide-in-from-right-full duration-500"
                >
                    <div className="bg-cyan-500 p-3 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <Bell size={18} className="animate-bounce" />
                            <span className="font-bold uppercase tracking-wider text-sm">Appointment Reminder</span>
                        </div>
                        <button onClick={() => dismissReminder(reminder.id)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                                <User size={20} />
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg leading-tight">{reminder.patient_name}</p>
                                <div className="flex items-center gap-1.5 text-gray-400 mt-1">
                                    <Phone size={14} className="text-emerald-400" />
                                    <p className="text-sm font-medium">{reminder.patient_phone || 'No Phone'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-gray-900/50 p-2.5 rounded-xl border border-gray-800">
                            <div className="flex items-center gap-2">
                                <Calendar size={18} className="text-cyan-400" />
                                <span className="text-sm text-gray-200 font-medium uppercase">{format(new Date(reminder.date), 'dd MMM')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={18} className="text-cyan-400" />
                                <span className="text-sm text-gray-200 font-medium uppercase">{format(new Date(`2000-01-01T${reminder.time}`), 'p')}</span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <div
                                className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                            >
                                <Phone size={18} /> Call Patient Now: {reminder.patient_phone || 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReminderManager;
