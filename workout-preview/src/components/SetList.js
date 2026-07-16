import React from 'react';

export function SetList({
    exercise,
    logForExercise,
    formatTime,
    onStartSet,
    onMarkDone,
    onChangeSet,
}) {
    if (!Array.isArray(logForExercise)) return null;
    return (
        <div className="space-y-2">
            {logForExercise.map((currentSet, setIndex) => {
                if (!currentSet) return null;
                const { weight, reps, status, failed, setDuration, restDuration } = currentSet;
                return (
                    <div key={setIndex} className={`p-2 rounded-md transition-colors ${failed ? 'bg-red-900/60' : status === 'completed' ? 'bg-green-900/50' : 'bg-gray-900'}`}>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-2 flex-grow">
                                <span className="font-bold text-gray-400 w-8 text-center">{setIndex + 1}</span>
                                <div className="flex-1 min-w-0">
                                    {(!exercise.loadType || exercise.loadType === 'weighted') && (
                                        <>
                                            <label className="text-xs text-gray-500">Weight</label>
                                            <input type="number" step="0.5" value={weight} onChange={(e) => onChangeSet(setIndex, { 'weight': e.target.value })} onFocus={(e) => e.target.select()} className="bg-gray-700 rounded p-2 w-full text-lg" />
                                        </>
                                    )}
                                    {exercise.loadType === 'bodyweight' && (
                                        <p className="text-sm text-gray-400">Bodyweight</p>
                                    )}
                                    {exercise.loadType === 'isometric' && (
                                        <p className="text-sm text-gray-400">Hold {exercise.holdSeconds || 30}s</p>
                                    )}
                                    {exercise.loadType === 'plyometric' && (
                                        <p className="text-sm text-gray-400">Plyometric (no external load)</p>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <label className="text-xs text-gray-500">Reps</label>
                                    <input type="number" step="1" value={reps} onChange={(e) => onChangeSet(setIndex, { 'reps': e.target.value })} onFocus={(e) => e.target.select()} className="bg-gray-700 rounded p-2 w-full text-lg" />
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <div className="text-xs text-gray-400 text-right">
                                    <div>Set: {formatTime(setDuration)}</div>
                                    <div>Rest: {formatTime(restDuration)}</div>
                                </div>
                                {status === 'pending' && (
                                    <>
                                        <button onClick={() => onStartSet(setIndex)} className="p-3 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors" title="Start Set Timer">
                                            {/* Play icon passed in parent if desired */}
                                            ▶
                                        </button>
                                        <button onClick={() => onMarkDone(setIndex)} className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors" title="Mark Set as Done">
                                            ✓
                                        </button>
                                    </>
                                )}
                                {status === 'completed' && (
                                    <>
                                        <button 
                                            onClick={() => onChangeSet(setIndex, { 'failed': !failed })} 
                                            className={`py-2 px-3 rounded text-sm font-semibold transition-colors ${failed ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                                        >
                                            {failed ? 'Un-fail' : 'Fail'}
                                        </button>
                                        <button 
                                            onClick={() => onChangeSet(setIndex, { status: 'pending', failed: false, setDuration: 0, restDuration: 0 })} 
                                            className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                                            title="Reset Set"
                                        >
                                            ↺
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}


