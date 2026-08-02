import React from 'react';
import { NumberStepper } from './UI';
import { SetList } from './SetList';
import { TrashIcon, SparklesIcon, LockClosedIcon, LockOpenIcon, CloudUploadIcon } from './Icons';

export function ExerciseCard({
    exercise,
    dbExercise,
    isCompleted,
    isLocked,
    isCollapsed,
    onToggleCollapse,
    onToggleLock,
    onRemove,
    exLog,
    completedVolume,
    expectedVolume,
    volumeCompletionPercentage,
    getVolumePercentageChange,
    onExerciseChange,
    formatTime,
    onStartSet,
    onMarkSetDone,
    onChangeSet,
    onMarkAllDone,
    onUpdateExercise
}) {
    return (
        <div className={`p-4 rounded-lg mb-4 transition-all duration-300 ${isCompleted ? 'bg-green-900/30' : 'bg-gray-800'}`}>
            <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={onToggleCollapse}>
                <div className="w-full">
                    <div className="flex items-center gap-3">
                        <p className="text-xl font-bold text-indigo-300">{exercise.name}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {isCompleted && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                            className="text-gray-400 hover:text-white p-1"
                        >
                            {isLocked ? <LockClosedIcon className="h-5 w-5" /> : <LockOpenIcon className="h-5 w-5" />}
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-red-500 hover:text-red-400 p-1 ml-2 flex-shrink-0">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
            <>
                <div className="flex justify-between items-center mb-4 text-sm">
                    <span className="text-indigo-300 font-mono">
                        Volume: {completedVolume} / {expectedVolume} lbs ({volumeCompletionPercentage}% complete)
                    </span>
                    {dbExercise && (
                        <div className="text-right text-gray-400">
                            <div>
                                Last: {dbExercise.lastVolume || 0} lbs
                            </div>
                            <div className="flex justify-end items-baseline space-x-2">
                                <span>C: {getVolumePercentageChange(completedVolume, dbExercise.lastVolume)}</span>
                                <span>P: {getVolumePercentageChange(expectedVolume, dbExercise.lastVolume)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Variant badges removed in workout session */}

                <fieldset disabled={isLocked} className="disabled:opacity-70">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center space-x-4">
                            {(!exercise.loadType || exercise.loadType === 'weighted') && (
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Weight</label>
                                    <NumberStepper value={exercise.weight || 0} onValueChange={(v) => onExerciseChange('weight', v)} showButtons={false} allowDecimal={true} />
                                </div>
                            )}
                            {exercise.loadType === 'isometric' && (
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Hold (sec)</label>
                                    <NumberStepper value={exercise.holdSeconds || 30} onValueChange={(v) => onExerciseChange('holdSeconds', v)} showButtons={false} allowDecimal={false} />
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Sets</label>
                                <NumberStepper value={exercise.sets.length} onValueChange={(v) => onExerciseChange('sets', v)} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Reps</label>
                                <NumberStepper value={exercise.reps} onValueChange={(v) => onExerciseChange('reps', v)} />
                            </div>
                        </div>
                        
                    </div>
                </fieldset>

                {dbExercise && dbExercise.lastPerformed && (
                    <div className="mt-2 mb-4 p-3 bg-gray-900/50 rounded-lg text-xs text-gray-400">
                        <h4 className="font-bold text-gray-300 mb-2">Last Performance ({dbExercise.lastPerformed.toDate().toLocaleDateString()}):</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                            <div><span className="font-semibold">Volume:</span> {dbExercise.lastVolume || 0} lbs</div>
                            <div><span className="font-semibold">Sets:</span> {dbExercise.lastSets || 0}</div>
                            <div className="md:col-span-2"><span className="font-semibold">Reps:</span> {(dbExercise.lastReps || []).join(', ')}</div>
                        </div>
                        {dbExercise.notes && <p className="mt-2 pt-2 border-t border-gray-700/50 italic">Note: {dbExercise.notes}</p>}
                    </div>
                )}

                {/* Last variant references removed in workout session */}

                <fieldset disabled={isLocked}>
                    <SetList
                        exercise={exercise}
                        logForExercise={exLog}
                        formatTime={formatTime}
                        onStartSet={(setIndex) => onStartSet(setIndex)}
                        onMarkDone={(setIndex) => onMarkSetDone(setIndex)}
                        onChangeSet={(setIndex, updates) => onChangeSet(setIndex, updates)}
                    />
                </fieldset>

                <div className="mt-4 flex space-x-2">
                    {onUpdateExercise && (
                        <button
                            onClick={onUpdateExercise}
                            className="w-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                            <CloudUploadIcon className="h-5 w-5 mr-2" />
                            Update Exercise in DB
                        </button>
                    )}
                    <button
                        onClick={() => onMarkAllDone()}
                        className="w-full flex items-center justify-center bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                        Mark All Done
                    </button>
                </div>
            </>)}
        </div>
    );
}


