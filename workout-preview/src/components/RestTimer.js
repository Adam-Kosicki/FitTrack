import React, { useState, useEffect } from 'react';
import { XIcon, PlayIcon, PauseIcon } from './Icons';

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

export function RestTimer({ startTime, onClose, targetSeconds }) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [pausedAt, setPausedAt] = useState(null);

    useEffect(() => {
        if (!startTime) {
            setElapsedSeconds(0);
            setIsPaused(false);
            setPausedAt(null);
            return;
        }

        if (isPaused) {
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const start = pausedAt ? startTime + (now - pausedAt) : startTime;
            setElapsedSeconds(Math.floor((now - start) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, isPaused, pausedAt]);

    const handlePauseToggle = () => {
        if (isPaused) {
            // Resuming
            setPausedAt(null);
        } else {
            // Pausing
            setPausedAt(Date.now());
        }
        setIsPaused(!isPaused);
    };

    if (!startTime) return null;

    return (
        <div className="fixed bottom-4 left-4 bg-gray-900 border border-indigo-500 rounded-lg shadow-2xl p-4 w-64 z-50 animate-slide-in-up">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-indigo-300">{isPaused ? 'Rest Paused' : 'Resting...'}</h4>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
            {typeof targetSeconds === 'number' && targetSeconds > 0 ? (
                <div>
                    <div className="flex items-center justify-center space-x-4">
                        <p className={`text-5xl font-mono text-center ${elapsedSeconds >= targetSeconds ? 'text-green-400' : 'text-white'}`}>
                            {formatTime(Math.max(0, targetSeconds - elapsedSeconds))}
                        </p>
                        <button onClick={handlePauseToggle} className="text-white p-2 rounded-full bg-indigo-600 hover:bg-indigo-700">
                            {isPaused ? <PlayIcon className="h-6 w-6" /> : <PauseIcon className="h-6 w-6" />}
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-1">Remaining • Elapsed {formatTime(elapsedSeconds)}</p>
                </div>
            ) : (
                <div className="flex items-center justify-center space-x-4">
                    <p className="text-5xl font-mono text-center text-white">
                        {formatTime(elapsedSeconds)}
                    </p>
                    <button onClick={handlePauseToggle} className="text-white p-2 rounded-full bg-indigo-600 hover:bg-indigo-700">
                        {isPaused ? <PlayIcon className="h-6 w-6" /> : <PauseIcon className="h-6 w-6" />}
                    </button>
                </div>
            )}
        </div>
    );
}
