
import React, { useState } from 'react';
import { useExercises } from '../context/ExerciseContext';
import { useNotification } from '../context/NotificationContext';

export function ImportExportModal({ onClose }) {
    const { masterList: exercises, handleSaveExercise, cleanResetCustomExercises, syncPersonalizedDbFromHistory } = useExercises();
    const { showNotification } = useNotification();
    const [jsonInput, setJsonInput] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleExport = () => {
        const customExercisesOnly = exercises.filter(ex => ex.isCustom);
        const exportData = JSON.stringify(customExercisesOnly, null, 2);
        navigator.clipboard.writeText(exportData)
            .then(() => {
                showNotification(`Exported ${customExercisesOnly.length} custom exercises to clipboard!`, 'success');
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showNotification('Failed to copy to clipboard.', 'error');
            });
    };

    const handleImport = async () => {
        if (!jsonInput.trim()) {
            showNotification('Input is empty. Paste your JSON data.', 'info');
            return;
        }

        try {
            const importedExercises = JSON.parse(jsonInput);
            
            if (!Array.isArray(importedExercises)) {
                 showNotification('Invalid format. Data must be a JSON array of exercises.', 'error');
                 return;
            }

            const importPromises = importedExercises.map(ex => {
                const { id, ...exerciseToSave } = ex;
                return handleSaveExercise({ ...exerciseToSave, isCustom: true });
            });

            await Promise.all(importPromises);
            
            showNotification(`${importedExercises.length} custom exercises imported successfully!`, 'success');
            onClose();

        } catch (error) {
            console.error('Import failed:', error);
            showNotification('Import failed. Check the JSON format and console for errors.', 'error');
        }
    };

    const handleSyncFromHistory = async () => {
        const ok = window.confirm("Sync Personalized DB to match ONLY the exercises logged in your workout history?");
        if (!ok) return;

        setIsSyncing(true);
        try {
            await syncPersonalizedDbFromHistory();
            showNotification('Personalized DB synced to match logged exercises!', 'success');
            onClose();
        } catch (err) {
            console.error('Sync failed:', err);
            showNotification('Sync failed. Check console for details.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleReset = async () => {
        const ok = window.confirm("Are you sure you want to reset your Personalized DB? This will remove accidentally imported presets and restore your exact personalized custom exercises.");
        if (!ok) return;

        setIsResetting(true);
        try {
            await cleanResetCustomExercises();
            showNotification('Personalized DB reset cleanly to your custom exercises!', 'success');
            onClose();
        } catch (err) {
            console.error('Reset failed:', err);
            showNotification('Reset failed. Check console for details.', 'error');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl mx-4">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3 flex-wrap gap-2">
                    <h2 className="text-2xl font-bold text-white">Import / Export & Sync DB</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSyncFromHistory}
                            disabled={isSyncing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 transition-colors shadow"
                            title="Extract and set Personalized DB to match only exercises present in your workout history"
                        >
                            {isSyncing ? 'Syncing Logs...' : '🔄 Sync DB from Workout Logs'}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={isResetting}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 transition-colors shadow"
                            title="Wipe accidental imports and restore pristine custom exercises"
                        >
                            {isResetting ? 'Resetting...' : '🧹 Restore Default DB'}
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Export Personalized DB</h3>
                        <p className="text-sm text-gray-400 mb-3">Copy your personalized custom exercise data ({exercises.filter(e => e.isCustom).length} items) to clipboard as JSON.</p>
                        <button 
                            onClick={handleExport}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                        >
                            Export Custom DB to Clipboard
                        </button>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-2">Import Custom Exercises</h3>
                        <p className="text-sm text-gray-400 mb-3">Paste JSON array here to import custom exercises.</p>
                        <textarea 
                            value={jsonInput}
                            onChange={e => setJsonInput(e.target.value)}
                            className="w-full bg-gray-900 text-sm font-mono p-2 rounded mt-1 h-40"
                            placeholder="Paste your JSON array here..."
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">
                        Close
                    </button>
                    <button onClick={handleImport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg">
                        Import Data
                    </button>
                </div>
            </div>
        </div>
    );
}
