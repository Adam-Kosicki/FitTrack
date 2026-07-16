import React, { useEffect, useRef } from 'react';

export function Modal({ onClose, children, title, maxWidthClass }) {
    const dialogRef = useRef(null);
    const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        const dialogEl = dialogRef.current;
        if (!dialogEl) return;

        // Focus first focusable element inside the modal
        const focusable = dialogEl.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
            focusable.focus();
        }

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
            }

            if (e.key === 'Tab') {
                // Simple focus trap
                const focusables = dialogEl.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const elements = Array.from(focusables);
                if (elements.length === 0) return;
                const first = elements[0];
                const last = elements[elements.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
        };
    }, [onClose]);

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose?.();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50" onMouseDown={handleOverlayClick} aria-hidden="false">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`bg-gray-800 p-4 md:p-6 rounded-lg shadow-xl w-full ${maxWidthClass || 'max-w-lg'} max-h-[85vh] overflow-y-auto`}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 id={titleId} className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-white">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function Button({ onClick, children, disabled, className }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition-colors ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {children}
        </button>
    );
}

export function TextArea({ value, onChange, placeholder, rows }) {
    return (
        <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 text-white"
        />
    );
}


export function ConfirmationDialog({ message, onConfirm, onCancel }) {
    const dialogRef = useRef(null);
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onCancel?.();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [onCancel]);

    const onOverlay = (e) => { if (e.target === e.currentTarget) onCancel?.(); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50" onMouseDown={onOverlay}>
            <div ref={dialogRef} role="dialog" aria-modal="true" className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <p className="text-lg mb-4">{message}</p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Cancel</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Confirm</button>
                </div>
            </div>
        </div>
    );
}

export const NumberStepper = ({ value, onValueChange, step: customStep, min = 0, showButtons = true, allowDecimal = false }) => {
    const step = customStep ?? (allowDecimal ? 0.5 : 1);
    const parse = allowDecimal ? parseFloat : (val) => parseInt(val, 10);

    const handleIncrement = () => onValueChange(Math.max(min, (parse(value) || 0) + step));
    const handleDecrement = () => onValueChange(Math.max(min, (parse(value) || 0) - step));
    const handleChange = (e) => {
        const numericValue = parse(e.target.value);
        if (!isNaN(numericValue)) {
            onValueChange(Math.max(min, numericValue));
        } else if (e.target.value === '') {
            onValueChange(min);
        }
    };

    return (
        <div className="flex items-center">
            {showButtons && <button onClick={handleDecrement} className="p-2 bg-gray-600 rounded-l-md hover:bg-gray-500">-</button>}
            <input 
                type="number" 
                value={value} 
                onChange={handleChange} 
                onFocus={(e) => e.target.select()}
                step={step}
                className={`w-16 text-center bg-gray-700 p-3 text-lg ${showButtons ? '' : 'rounded-md'}`} 
            />
            {showButtons && <button onClick={handleIncrement} className="p-2 bg-gray-600 rounded-r-md hover:bg-gray-500">+</button>}
        </div>
    );
};

export function ActionDialog({ title, message, buttons, onCancel }) {
    const titleId = useRef(`action-title-${Math.random().toString(36).slice(2)}`).current;
    const onOverlay = (e) => { if (e.target === e.currentTarget) onCancel?.(); };
    useEffect(() => {
        const onKeyDown = (e) => { if (e.key === 'Escape') onCancel?.(); };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [onCancel]);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50" onMouseDown={onOverlay}>
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <h2 id={titleId} className="text-xl font-bold mb-4">{title}</h2>
                <p className="text-lg mb-6">{message}</p>
                <div className="flex flex-col space-y-3">
                    {buttons.map((button, index) => (
                        <button
                            key={index}
                            onClick={button.onClick}
                            className={`${button.className} text-white font-bold py-2 px-6 rounded-lg w-full`}
                        >
                            {button.text}
                        </button>
                    ))}
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg w-full">
                        Stay
                    </button>
                </div>
            </div>
        </div>
    );
}

export function WorkoutStatsHud({ totalRestTime, elapsedTime }) {
    const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    const restPercentage = elapsedTime > 0 ? ((totalRestTime / elapsedTime) * 100).toFixed(0) : 0;

    return (
        <div className="fixed bottom-4 left-4 bg-gray-950 bg-opacity-80 backdrop-blur-sm text-white p-4 rounded-lg shadow-2xl border border-gray-700 w-64 z-40" data-hud>
            <h3 className="text-lg font-bold text-indigo-300 mb-3">Workout Vitals</h3>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Time:</span>
                    <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Rest:</span>
                    <span className="font-mono text-lg">{formatTime(totalRestTime)}</span>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700">
                 <p className="text-center text-gray-400">You've been resting for</p>
                 <p className="text-center text-yellow-400 font-bold text-3xl">{restPercentage}%</p>
                 <p className="text-center text-xs text-gray-500">of this session.</p>
            </div>
        </div>
    );
} 