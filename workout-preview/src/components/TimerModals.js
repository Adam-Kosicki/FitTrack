import React, { useState, useEffect, useRef } from 'react';
import { StopIcon } from '../components/Icons';

export function TimerModal({ show, title, onStop }) {
    const [seconds, setSeconds] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (show) {
            setSeconds(0); // Reset on show
            intervalRef.current = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [show]);

    const handleStop = () => {
        clearInterval(intervalRef.current);
        onStop(seconds);
    };

    const formatTime = (sec) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex justify-center items-center z-50" onClick={handleStop}>
            <div className="text-center">
                <p className="text-8xl font-mono mb-8 text-white">{formatTime(seconds)}</p>
                <div className="flex justify-center space-x-4">
                     <div className="bg-red-600 text-white font-bold rounded-full flex items-center justify-center w-24 h-24">
                        <StopIcon className="h-10 w-10" />
                    </div>
                </div>
            </div>
        </div>
    );
} 