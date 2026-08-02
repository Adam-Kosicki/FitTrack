import React, { useState } from 'react';
import { useExercises } from '../context/ExerciseContext';
import { useNotification } from '../context/NotificationContext';
import { SparklesIcon } from './Icons';
import { collection, addDoc, Timestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export function AILogParserModal({ userId, onClose }) {
    const { masterList: exercises, handleSaveExercise, parseWorkoutLog, updateExerciseSummaryFromHistory } = useExercises();
    const { showNotification } = useNotification();
    const [logText, setLogText] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleParse = async () => {
        if (!logText.trim()) {
            showNotification("Please paste your workout log.", 'info');
            return;
        }
        setIsLoading(true);
        setError(null);
        setParsedData(null);
        try {
            const exerciseNames = exercises.map(e => e.name);
            const result = await parseWorkoutLog(logText, exerciseNames);
            setParsedData(result);
        } catch (e) {
            console.error(e);
            setError("Failed to parse log. Please check the format and try again.");
            showNotification("Failed to parse log.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveLog = async () => {
        if (!parsedData) return;

        setIsLoading(true);
        try {
            const historyRef = collection(db, 'performanceHistory');
            
            // Normalize date to avoid timezone issues. We'll check for the whole day.
            const workoutDate = new Date(parsedData.date || new Date());
            const startOfDay = new Date(workoutDate.getFullYear(), workoutDate.getMonth(), workoutDate.getDate(), 0, 0, 0);
            const endOfDay = new Date(workoutDate.getFullYear(), workoutDate.getMonth(), workoutDate.getDate(), 23, 59, 59);

            for (const item of parsedData.workout) {
                let exercise = exercises.find(e => e.name.trim().toLowerCase() === item.exerciseName.trim().toLowerCase());
                let exerciseId = exercise?.id;

                if (!exercise) {
                     if (!item.exerciseName || !item.exerciseName.trim()) {
                        console.warn("Skipping log entry with empty exercise name.", item);
                        continue;
                    }
                    const newExercise = { name: item.exerciseName, masterData: {} };
                    const newDocRef = await handleSaveExercise(newExercise);
                     if (newDocRef && newDocRef.id) {
                        exerciseId = newDocRef.id;
                    } else {
                        console.error("Failed to create new exercise and get its ID for:", item.exerciseName);
                        showNotification(`Failed to save new exercise: ${item.exerciseName}`, 'error');
                        continue;
                    }
                }
                
                if (!exerciseId) {
                    console.error("Could not find or create exercise ID for", item.exerciseName);
                    continue;
                }

                // De-duplication: Check for and delete existing logs for this exercise on this day.
                const q = query(historyRef, 
                    where("userId", "==", userId),
                    where("exerciseId", "==", exerciseId),
                    where("date", ">=", Timestamp.fromDate(startOfDay)),
                    where("date", "<=", Timestamp.fromDate(endOfDay))
                );

                const existingLogsSnapshot = await getDocs(q);
                for (const doc of existingLogsSnapshot.docs) {
                    await deleteDoc(doc.ref);
                }

                const totalVolume = item.sets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0);

                await addDoc(historyRef, {
                    userId,
                    date: Timestamp.fromDate(workoutDate),
                    exerciseId: exerciseId,
                    exerciseName: item.exerciseName,
                    volume: totalVolume,
                    sets: item.sets.map(s => ({
                        weight: s.weight || 0,
                        reps: s.reps || 0,
                        failed: s.failed || false,
                        setDuration: 0,
                        restDuration: 0,
                        volume: (s.weight || 0) * (s.reps || 0)
                    }))
                });

                await updateExerciseSummaryFromHistory(exerciseId);
            }
            showNotification("Workout log saved successfully!", "success");
            onClose();
        } catch (e) {
            console.error("Error saving log:", e);
            showNotification("Failed to save workout log.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl mx-4">
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                    <SparklesIcon className="h-6 w-6 mr-2 text-indigo-400" /> AI Log Parser
                </h2>
                
                {!parsedData ? (
                    <>
                        <p className="text-sm text-gray-400 mb-4">Paste your unstructured workout notes below, and the AI will attempt to parse them into a structured log.</p>
                        <textarea
                            value={logText}
                            onChange={e => setLogText(e.target.value)}
                            placeholder="e.g., A1. Deep Back Squat..."
                            className="w-full bg-gray-900 text-sm font-mono p-2 rounded mt-1 h-64"
                            disabled={isLoading}
                        />
                         {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                    </>
                ) : (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Review Parsed Data</h3>
                        <p className="text-sm text-gray-400 mb-3">Detected Date: <span className="font-semibold text-indigo-300">{parsedData.date ? new Date(parsedData.date).toLocaleDateString() : 'Today'}</span></p>
                        <div className="bg-gray-900 p-4 rounded-lg max-h-80 overflow-y-auto">
                            {parsedData.workout.map((item, index) => (
                                <div key={index} className="mb-4 pb-2 border-b border-gray-700 last:border-b-0">
                                    <p className="font-bold text-indigo-300">{item.exerciseName}</p>
                                    <ul className="list-disc list-inside text-sm text-gray-300">
                                        {item.sets.map((set, sIndex) => (
                                            <li key={sIndex} className={`${set.failed ? 'text-red-400' : ''}`}>
                                                {set.weight} lbs x {set.reps} reps {set.failed ? '(Failed)' : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
               
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                        Cancel
                    </button>
                    {!parsedData ? (
                        <button onClick={handleParse} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">
                            {isLoading ? 'Parsing...' : 'Parse Log'}
                        </button>
                    ) : (
                        <button onClick={handleSaveLog} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg">
                            {isLoading ? 'Saving...' : 'Save Log'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
