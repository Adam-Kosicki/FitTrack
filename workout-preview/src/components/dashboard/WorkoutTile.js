import React from 'react';

export function WorkoutTile({ workout, isActive, isSelected, isGroupingMode, onClick }) {
    const ringClass = isSelected ? 'ring-2 ring-yellow-500' : (isActive ? 'ring-2 ring-green-500' : '');
    return (
        <div className={`bg-gray-800 rounded-lg p-5 flex flex-col justify-between shadow-lg hover:shadow-indigo-500/30 transition-shadow relative ${ringClass}`} onClick={onClick}>
            <div className="flex items-start justify-between">
                <div className="flex-grow cursor-pointer">
                    <h2 className="text-xl font-bold mb-1 text-indigo-300">{workout.name}</h2>
                    <p className="text-gray-400 mb-4 text-sm h-10 overflow-hidden">{workout.description}</p>
                </div>
            </div>
            <div className="text-center mt-4">
                <p className="text-xs text-gray-500">{isGroupingMode ? 'Click to select' : 'Click for details'}</p>
            </div>
        </div>
    );
}


