import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, where, addDoc, getDocs, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { TrashIcon, SparklesIcon, EditIcon } from '../components/Icons';
import { ConfirmationDialog } from '../components/UI';
import { useExercises } from '../context/ExerciseContext';
import { useNotification } from '../context/NotificationContext';
import { AILogParserModal } from '../components/AILogParserModal';
import { appId } from '../constants';


export function LogView({ userId }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingLog, setDeletingLog] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const { updateExerciseSummaryFromHistory } = useExercises();
    const { showNotification } = useNotification();
    const [filter, setFilter] = useState('all'); // all | jumpersKnee | normal
    const [workouts, setWorkouts] = useState([]);

    useEffect(() => {
        if (!userId) {
            setLogs([]);
            setLoading(false);
            return;
        }

        const historyRef = collection(db, 'performanceHistory');
        let qObj = query(historyRef, where('userId', '==', userId), orderBy('date', 'desc'));

        const unsubscribe = onSnapshot(qObj, (snapshot) => {
            const logsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setLogs(logsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching performance history:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    useEffect(() => {
        const loadWorkouts = async () => {
            if (!userId) {
                setWorkouts([]);
                return;
            }
            try {
                const snap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/workouts`));
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setWorkouts(data);
            } catch (e) {
                console.error('Failed to fetch workouts', e);
            }
        };
        loadWorkouts();
    }, [userId]);

    const handleExport = (timeframe) => {
        const matchesFilter = (l) => {
            if (filter === 'all') return true;
            if (filter === 'jumpersKnee') return (l.category === 'jumpersKnee');
            return !l.category || l.category !== 'jumpersKnee';
        };
        const base = logs.filter(matchesFilter);
        const logsToExport = timeframe === 'today'
            ? base.filter(log => {
                const logDate = log.date.toDate();
                const today = new Date();
                return logDate.getDate() === today.getDate() &&
                       logDate.getMonth() === today.getMonth() &&
                       logDate.getFullYear() === today.getFullYear();
            })
            : base;

        if (logsToExport.length === 0) {
            showNotification('No data to export for the selected period.', 'error');
            return;
        }

        const formattedText = logsToExport.map(log => {
            const date = log.date.toDate().toLocaleString();
            const exercises = log.sets.map((set, index) => {
                const timeBits = [];
                if (set.setStartedAt) timeBits.push(`Started: ${set.setStartedAt.toDate ? set.setStartedAt.toDate().toLocaleTimeString() : '-'}`);
                if (set.setFinishedAt) timeBits.push(`Finished: ${set.setFinishedAt.toDate ? set.setFinishedAt.toDate().toLocaleTimeString() : '-'}`);
                if (set.setDuration && set.setDuration > 0) timeBits.push(`Set: ${formatTime(set.setDuration)}`);
                if (set.restDuration && set.restDuration > 0) timeBits.push(`Rest: ${formatTime(set.restDuration)}`);
                const failed = set.failed ? ' - Failed' : '';
                const timeLine = timeBits.length ? `\n    ${timeBits.join(' ')}` : '';
                return `  Set ${index + 1}: ${set.weight ?? 'N/A'} lbs x ${set.reps ?? 'N/A'} reps${timeLine}${failed}`;
            }).join('\n');
            const note = log.sessionNote ? `\nSession Note: ${log.sessionNote}` : '';
            const wStart = log.workoutStartedAt ? (log.workoutStartedAt.toDate ? log.workoutStartedAt.toDate().toLocaleString() : '') : '';
            const wEnd = log.workoutFinishedAt ? (log.workoutFinishedAt.toDate ? log.workoutFinishedAt.toDate().toLocaleString() : '') : '';
            const headExtras = [wStart && `Start: ${wStart}`, wEnd && `End: ${wEnd}`].filter(Boolean).join('  ');
            return `${log.exerciseName} - ${date}${headExtras ? `\n${headExtras}` : ''}\nTotal Volume: ${log.volume || 0} lbs${note}\n${exercises}`;
        }).join('\n\n');

        navigator.clipboard.writeText(formattedText)
            .then(() => showNotification('Data copied to clipboard!', 'success'))
            .catch(() => showNotification('Failed to copy data.', 'error'));
    };
    
    const handleEditLog = (log) => {
        showNotification('Editing will be implemented in a future update!', 'info');
    };

    const handleConfirmDelete = async () => {
        if (!deletingLog) return;
        try {
            await deleteDoc(doc(db, 'performanceHistory', deletingLog.id));
            await updateExerciseSummaryFromHistory(deletingLog.exerciseId);
        } catch (error) {
            console.error("Error deleting log:", error);
        } finally {
            setDeletingLog(null);
        }
    };

    const formatTime = (seconds) => {
        if (seconds === undefined || seconds === null) return 'N/A';
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    if (loading) return <p>Loading logs...</p>;

    const filteredLogs = logs.filter(l => {
        if (filter === 'all') return true;
        if (filter === 'jumpersKnee') return (l.category === 'jumpersKnee');
        return !l.category || l.category !== 'jumpersKnee';
    });

    const groupedLogs = filteredLogs.reduce((acc, log) => {
        const isRealWorkout = log.workoutId && !['ad-hoc', 'new'].includes(String(log.workoutId));
        const dateStr = log.date.toDate().toLocaleDateString();
        const key = (log.workoutName && isRealWorkout)
            ? `workout:${log.workoutName}::${log.workoutId}::date:${dateStr}`
            : `date:${dateStr}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(log);
        return acc;
    }, {});

    const sortedGroups = Object.keys(groupedLogs).sort((a, b) => {
        const aDate = groupedLogs[a][0]?.date?.toDate?.() || new Date(0);
        const bDate = groupedLogs[b][0]?.date?.toDate?.() || new Date(0);
        return bDate - aDate;
    });

    // Build previous-volume lookup per log to display deltas
    const prevVolumeByLogId = (() => {
        const map = {};
        const buckets = {};
        logs.forEach(l => {
            const key = l.exerciseId || `name:${(l.exerciseName || '').trim().toLowerCase()}`;
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(l);
        });
        Object.values(buckets).forEach(list => {
            list.sort((a, b) => b.date.toDate() - a.date.toDate());
            list.forEach((l, idx) => {
                const prev = list[idx + 1];
                if (prev) map[l.id] = prev.volume || 0;
            });
        });
        return map;
    })();

    const renderDelta = (current, previous) => {
        if (previous === undefined || previous === null || previous === 0) return <span className="text-yellow-400">(N/A)</span>;
        const change = ((Number(current || 0) - Number(previous)) / Number(previous)) * 100;
        const color = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-yellow-400';
        const sign = change > 0 ? '+' : '';
        return <span className={color}>({sign}{change.toFixed(1)}%)</span>;
    };

    const handleGoToWorkout = async (groupKey) => {
        // For existing workout, navigate to log view with workoutId
        if (groupKey.startsWith('workout:')) {
            const parts = groupKey.replace('workout:', '').split('::');
            const workoutId = parts[1];
            if (workoutId && workoutId !== 'ad-hoc' && workoutId !== 'new') {
                // Use global navigate via window event to avoid prop-drilling
                window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'log', context: { workoutId } } }));
                return;
            }
        }
        // For date groups or ad-hoc, build a new workout template from the group and navigate
        const logsInGroup = groupedLogs[groupKey];
        const uniqueExercises = [];
        logsInGroup.forEach(l => {
            const name = l.exerciseName;
            if (!uniqueExercises.find(e => e.name === name)) {
                uniqueExercises.push({ name, sets: l.sets && l.sets.length > 0 ? l.sets : [{}, {}, {}] });
            }
        });
        let workoutName = groupKey.startsWith('workout:') ? groupKey.split('::')[0].replace('workout:', '') : `Session ${logsInGroup[0].date.toDate().toLocaleDateString()}`;
        const proposed = window.prompt('Name this workout', workoutName);
        if (proposed) workoutName = proposed;
        // Persist a real template so it can be reused
        try {
            const workoutsRef = collection(db, `artifacts/${appId}/users/${logsInGroup[0].userId}/workouts`);
            const docRef = await addDoc(workoutsRef, {
                name: workoutName,
                description: `Auto-created from log group ${workoutName}`,
                createdAt: new Date(),
                exercises: uniqueExercises.map(ex => ({ name: ex.name }))
            });
            window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'log', context: { workoutId: docRef.id } } }));
        } catch (e) {
            console.error('Failed creating workout from logs', e);
        }
    };

    const getGroupExerciseNames = (groupKey) => {
        const set = new Set();
        (groupedLogs[groupKey] || []).forEach(l => set.add((l.exerciseName || '').trim().toLowerCase()));
        return Array.from(set);
    };

    const suggestMatchingWorkout = (groupKey) => {
        const names = getGroupExerciseNames(groupKey);
        if (names.length === 0) return null;
        let best = null;
        workouts.forEach(w => {
            const templateNames = (w.exercises || []).map(ex => (ex.name || '').trim().toLowerCase());
            const templateSet = new Set(templateNames);
            const overlap = names.filter(n => templateSet.has(n)).length;
            const similarity = overlap / Math.max(1, Math.max(names.length, templateNames.length));
            if (!best || similarity > best.similarity) {
                best = { workout: w, similarity };
            }
        });
        return best;
    };

    const handleLinkWorkout = async (groupKey) => {
        const best = suggestMatchingWorkout(groupKey);
        let selected = null;
        if (best && best.similarity >= 0.6) {
            const ok = window.confirm(`Link to suggested workout "${best.workout.name}"? (match ${(best.similarity * 100).toFixed(0)}%)`);
            if (ok) selected = best.workout;
        }
        if (!selected) {
            const nameInput = window.prompt('Type the workout name to link this session to:', best?.workout?.name || '');
            if (!nameInput) return;
            const match = workouts.find(w => (w.name || '').trim().toLowerCase() === nameInput.trim().toLowerCase());
            if (!match) {
                alert('No workout found with that name.');
                return;
            }
            selected = match;
        }
        try {
            const items = groupedLogs[groupKey] || [];
            const promises = items.map(item => setDoc(doc(db, 'performanceHistory', item.id), {
                workoutId: selected.id,
                workoutName: selected.name || null
            }, { merge: true }));
            await Promise.all(promises);
            showNotification('Session linked to workout.', 'success');
        } catch (e) {
            console.error('Failed to link workout', e);
            showNotification('Failed to link workout.', 'error');
        }
    };

    const handleUnlinkWorkout = async (groupKey) => {
        try {
            const items = groupedLogs[groupKey] || [];
            const promises = items.map(item => setDoc(doc(db, 'performanceHistory', item.id), {
                workoutId: deleteField(),
                workoutName: deleteField()
            }, { merge: true }));
            await Promise.all(promises);
            showNotification('Workout link removed for this date group.', 'success');
        } catch (e) {
            console.error('Failed to unlink workout', e);
            showNotification('Failed to unlink workout.', 'error');
        }
    };

    // Renaming the linked workout per-session was removed per user request.

    // Renaming the actual template from here was removed per user request.

    // Secondary unlink variant removed; using the deleteField() version above.

    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            {deletingLog && (
                <ConfirmationDialog
                    message="Are you sure you want to delete this performance record?"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeletingLog(null)}
                />
            )}
            {isParsing && <AILogParserModal userId={userId} onClose={() => setIsParsing(false)} />}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Performance Log</h1>
                <div className="flex space-x-2">
                     <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="bg-gray-700 p-2 rounded-lg">
                        <option value="all">All</option>
                        <option value="jumpersKnee">Knee-only</option>
                        <option value="normal">Non-Knee</option>
                    </select>
                     <button onClick={() => setIsParsing(true)} className="flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        Parse Log
                    </button>
                    <button onClick={() => handleExport('today')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Export Today</button>
                    <button onClick={() => handleExport('all')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Export All</button>
                </div>
            </div>
            <div className="space-y-6">
                {sortedGroups.map(groupKey => (
                    <div key={groupKey} className="bg-gray-900 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
                            <h2 className="text-2xl font-bold text-white">
                                {groupKey.startsWith('workout:') ? (
                                    (() => {
                                        const name = groupKey.split('::')[0].replace('workout:', '');
                                        const datePart = groupKey.includes('::date:') ? groupKey.split('::date:')[1] : '';
                                        return `${name}${datePart ? ' — ' + datePart : ''}`;
                                    })()
                                ) : (
                                    groupKey.replace('date:', '')
                                )}
                            </h2>
                            <div className="flex items-center gap-2">
                                {groupKey.startsWith('workout:') && (
                                    <button onClick={() => handleUnlinkWorkout(groupKey)} className="bg-red-700 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">
                                        Unlink
                                    </button>
                                )}
                                {!groupKey.startsWith('workout:') && (
                                    <button onClick={() => handleLinkWorkout(groupKey)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded text-sm">
                                        Link to Existing
                                    </button>
                                )}
                                <button onClick={() => handleGoToWorkout(groupKey)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded text-sm">
                                    {groupKey.startsWith('workout:') ? 'Open Workout' : 'Create Workout'}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {groupedLogs[groupKey].map(log => (
                                <div key={log.id} className="bg-gray-800 p-4 rounded-md">
                                    <div className="flex justify-between items-baseline mb-3">
                                        <div>
                                            <h3 className="text-xl font-bold text-indigo-300">{log.exerciseName}</h3>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {log.workoutStartedAt && (<span>Start: {log.workoutStartedAt.toDate ? log.workoutStartedAt.toDate().toLocaleTimeString() : ''}</span>)}
                                                {log.workoutFinishedAt && (<span className="ml-2">End: {log.workoutFinishedAt.toDate ? log.workoutFinishedAt.toDate().toLocaleTimeString() : ''}</span>)}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <p className="text-sm text-gray-400">Total Volume: {log.volume || 0} lbs</p>
                                            <button onClick={() => handleEditLog(log)} className="text-gray-400 hover:text-white p-1" title="Edit Log">
                                                <EditIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => setDeletingLog(log)} className="text-red-500 hover:text-red-400 p-1" title="Delete Log">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm text-gray-300 mb-1">
                                            <span className="font-mono">Volume: {log.volume || 0} lbs</span>
                                            <span className="font-mono">Last: {prevVolumeByLogId[log.id] || 0} lbs {renderDelta(log.volume || 0, prevVolumeByLogId[log.id])}</span>
                                        </div>
                                        {log.sessionNote && (
                                            <div className="text-sm text-gray-300 ml-1 mb-2">
                                                <span className="font-semibold">Session Note:</span> {log.sessionNote}
                                            </div>
                                        )}
                                        {log.sets.map((set, index) => (
                                            <div key={index} className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm ml-4 p-1 bg-gray-700 rounded">
                                                <span>Set {index + 1}: {set.weight ?? 'N/A'} lbs x {set.reps ?? 'N/A'} reps</span>
                                                {(set.setDuration > 0 || set.restDuration > 0) && (
                                                    <div className="text-gray-400">
                                                        {set.setDuration > 0 && <span>Set: {formatTime(set.setDuration)}</span>}
                                                        {set.restDuration > 0 && <span className="ml-2">Rest: {formatTime(set.restDuration)}</span>}
                                                    </div>
                                                )}
                                                {set.failed && <span className="text-red-500 font-bold">Failed</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 