import { useEffect, useRef } from 'react';

// Simple WebAudio metronome. Plays a short beep at a fixed interval.
export function Metronome({ enabled, bpm = 60, volume = 0.2 }) {
    const audioCtxRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }

        if (!audioCtxRef.current) {
            try {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('AudioContext not supported');
                return;
            }
        }

        const ctx = audioCtxRef.current;
        const intervalMs = Math.max(100, 60000 / (bpm || 60));

        const tick = () => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = Math.max(0, Math.min(1, volume));
            osc.frequency.value = 880; // A5 tick
            osc.connect(gain);
            gain.connect(ctx.destination);
            const now = ctx.currentTime;
            osc.start(now);
            osc.stop(now + 0.05); // 50 ms click
        };

        tick(); // immediate first tick
        intervalRef.current = setInterval(tick, intervalMs);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [enabled, bpm, volume]);

    return null;
}


