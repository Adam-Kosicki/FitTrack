import React from 'react';

// Simple 0–10 pain scale with colored gradient and selectable ticks
// Props: value (number 0..10), onChange(number)
export function PainScale({ value = 0, onChange }) {
    const colors = [
        '#22c55e', '#39c45f', '#51c261', '#69c164', '#81bf66',
        '#99be69', '#b1bc6b', '#c9bb6e', '#e19a5f', '#ef4444', '#dc2626'
    ];

    return (
        <div className="w-full">
            <div className="relative h-6 rounded" style={{
                background: 'linear-gradient(90deg, #22c55e 0%, #eab308 55%, #ef4444 100%)'
            }} />
            <div className="mt-2 grid grid-cols-11 gap-2">
                {Array.from({ length: 11 }).map((_, i) => (
                    <button
                        key={i}
                        onClick={() => onChange && onChange(i)}
                        className={`flex flex-col items-center text-xs focus:outline-none ${i === value ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                        title={`${i}/10`}
                    >
                        <div
                            className={`w-8 h-8 rounded-full border-2 ${i === value ? 'border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: colors[i] }}
                        />
                        <span className="mt-1 text-gray-300">{i}</span>
                    </button>
                ))}
            </div>
            <div className="mt-2 flex justify-between text-gray-400 text-xs">
                <span>No Pain</span>
                <span>Worst Pain</span>
            </div>
        </div>
    );
}

export default PainScale;


