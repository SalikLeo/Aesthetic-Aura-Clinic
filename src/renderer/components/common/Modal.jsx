import React from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

const Modal = ({ isOpen, onClose, title, children, icon: Icon, type = 'default' }) => {
    if (!isOpen) return null;

    const bgClasses = {
        default: 'bg-secondary-bg border-gray-700',
        success: 'bg-green-900/10 border-green-500/20',
        danger: 'bg-red-900/10 border-red-500/20',
    };

    const headerColor = {
        default: 'text-gray-100',
        success: 'text-green-400',
        danger: 'text-red-400',
    };

    return createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl border ${bgClasses[type]} bg-secondary-bg overflow-hidden transform transition-all scale-100`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        {Icon && <Icon className={`w-6 h-6 ${headerColor[type]}`} />}
                        <h3 className={`text-xl font-bold ${headerColor[type]}`}>{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
