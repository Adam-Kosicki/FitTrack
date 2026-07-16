import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { XIcon, TrashIcon } from './Icons';
import { ConfirmationDialog } from './UI';
import { useExercises } from '../context/ExerciseContext';

export function ExerciseHistoryModal({ userId, exercise, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingHistory, setDeletingHistory] = useState(null);
    const { updateExerciseSummaryFromHistory } = useExercises();

    const fetchHistory = useCallback(() => {
        if (!userId || !exercise.id) return;
        setLoading(true);
        const historyRef = collection(db, 'performanceHistory');
        const q = query(historyRef, where('userId', '==', userId), where('exerciseId', '==', exercise.id), orderBy("date", "desc"));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(historyData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching exercise history:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, exercise.id]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleConfirmDelete = async () => {
        if (!deletingHistory) return;
        try {
            await deleteDoc(doc(db, 'performanceHistory', deletingHistory.id));
            await updateExerciseSummaryFromHistory(deletingHistory.exerciseId);
        } catch (error) {
            console.error("Error deleting history entry:", error);
        } finally {
            setDeletingHistory(null);
        }
    };

    const formatTime = (seconds) => {
        if (seconds === undefined || seconds === null) return 'N/A';
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const buildPrevVolumes = (list) => {
        const sorted = [...list].sort((a, b) => b.date.toDate() - a.date.toDate());
        const map = {};
        sorted.forEach((l, idx) => {
            const prev = sorted[idx + 1];
            if (prev) map[l.id] = prev.volume || 0;
        });
        return map;
    };
    const prevById = buildPrevVolumes(history);

    const renderDelta = (current, previous) => {
        if (previous === undefined || previous === null || previous === 0) return <span className="text-yellow-400">(N/A)</span>;
        const change = ((Number(current || 0) - Number(previous)) / Number(previous)) * 100;
        const color = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-yellow-400';
        const sign = change > 0 ? '+' : '';
        return <span className={color}>({sign}{change.toFixed(1)}%)</span>;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-3xl mx-4 flex flex-col" style={{height: '90vh'}}>
                {deletingHistory && (
                    <ConfirmationDialog
                        message="Are you sure you want to delete this performance record?"
                        onConfirm={handleConfirmDelete}
                        onCancel={() => setDeletingHistory(null)}
                    />
                )}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">History for: <span className="text-indigo-300">{exercise.name}</span></h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><XIcon className="h-6 w-6" /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2">
                    {loading ? (
                        <p>Loading history...</p>
                    ) : history.length === 0 ? (
                        <p className="text-gray-500">No past performance data found for this exercise.</p>
                    ) : (
                        <div className="space-y-6">
                            {history.map(log => (
                                <div key={log.id} className="bg-gray-900 p-4 rounded-lg">
                                    <div className="flex justify-between items-baseline mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-indigo-300">{log.date.toDate().toLocaleDateString()}</h3>
                                            {log.sessionNote && (
                                                <p className="text-xs text-gray-400">Note on {log.date.toDate().toLocaleString()}: <span className="italic">{log.sessionNote}</span></p>
                                            )}
                                            {log.workoutName && (
                                                <p className="text-xs text-gray-500">Workout: {log.workoutName}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <p className="text-sm text-gray-400">Total Volume: {log.volume || 0} lbs {renderDelta(log.volume || 0, prevById[log.id])}</p>
                                            <button onClick={() => setDeletingHistory(log)} className="text-red-500 hover:text-red-400 p-1">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {log.sets.map((set, index) => (
                                            <div key={index} className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm ml-4 p-1 bg-gray-800 rounded">
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
                                        {log.sessionNote && (
                                            <div className="text-xs text-gray-400 mt-2 ml-1 italic">Session note recorded on {log.date.toDate().toLocaleString()}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 