import React from 'react';
import { ChevronDownIcon } from '../Icons';

export function GroupCard({
    group,
    workouts,
    isCollapsed,
    onOpen,
    onToggleCollapse,
    renderWorkoutTile
}) {
    return (
        <div className="bg-gray-900 rounded-lg p-4 shadow-lg border border-gray-700 cursor-pointer md:col-span-2" onClick={onOpen} title="Open overview/options">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-indigo-300 truncate mr-2">{group.name}</h3>
                </div>
                {group.description ? (
                    <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{group.description}</p>
                ) : null}
            </div>
            <div className="text-xs text-gray-400">Click to open overview</div>
            {group.aiSummary ? (
                <div className="mt-3 text-center text-gray-300 text-sm italic px-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">AI summary</div>
                    {group.aiSummary}
                </div>
            ) : null}
            <div className="mt-3 flex justify-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
                    className="flex items-center gap-2 text-gray-300 hover:text-white text-sm px-4 py-3 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700 w-full justify-center"
                    title={isCollapsed ? `See ${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}` : 'Collapse workouts'}
                >
                    <span>{isCollapsed ? `Click to see ${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}` : 'Click to collapse'}</span>
                    <ChevronDownIcon className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                </button>
            </div>
            {!isCollapsed && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workouts.map(renderWorkoutTile)}
                </div>
            )}
        </div>
    );
}


