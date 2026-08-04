
import React, { useState } from 'react';
import { useExercises } from '../context/ExerciseContext';
import { useNotification } from '../context/NotificationContext';

export function ImportExportModal({ onClose }) {
    const { masterList: exercises, handleSaveExercise, purgeAndResetUserCustomExercises } = useExercises();
    const { showNotification } = useNotification();
    const [jsonInput, setJsonInput] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    const handleExport = () => {
        const exportData = JSON.stringify(exercises, null, 2);
        navigator.clipboard.writeText(exportData)
            .then(() => {
                showNotification('Exercise data copied to clipboard!', 'success');
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
                return handleSaveExercise({ ...exerciseToSave, isCustom: exerciseToSave.isCustom !== undefined ? exerciseToSave.isCustom : true, source: exerciseToSave.source || 'user' });
            });

            await Promise.all(importPromises);
            
            showNotification(`${importedExercises.length} exercises imported successfully!`, 'success');
            onClose();

        } catch (error) {
            console.error('Import failed:', error);
            showNotification('Import failed. Check the JSON format and console for errors.', 'error');
        }
    };

    const handleResetAdminCustomExercises = async () => {
        if (!window.confirm("This will purge all exercises from your database and re-sync ONLY the exercises that appear in your performance history workout logs. Proceed?")) return;
        setIsResetting(true);
        try {
            await purgeAndResetUserCustomExercises();
            showNotification(`Database reset complete: Re-synced exercises from your workout logs.`, 'success');
            onClose();
        } catch (error) {
            console.error('Reset failed:', error);
            showNotification('Failed to reset exercises from logs.', 'error');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Import / Export Exercises</h2>

                <div className="space-y-6 overflow-y-auto pr-2 flex-grow">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Export</h3>
                        <p className="text-sm text-gray-400 mb-3">Copy all your exercise data to the clipboard as JSON.</p>
                        <button 
                            onClick={handleExport}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                        >Export to Clipboard
                        </button>
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <h3 className="text-lg font-semibold mb-2 text-purple-300">Reset & Re-Sync From Workout Logs</h3>
                        <p className="text-sm text-gray-400 mb-3">Purges all existing exercise records from your database and re-syncs only the exercises found in your performance history workout logs.</p>
                        <button 
                            onClick={handleResetAdminCustomExercises}
                            disabled={isResetting}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                            {isResetting ? 'Re-Syncing From Workout Logs...' : 'Re-Sync Exercises from Workout Logs'}
                        </button>
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <h3 className="text-lg font-semibold mb-2">Import JSON</h3>
                        <p className="text-sm text-gray-400 mb-3">Paste JSON data here to import exercises.</p>
                        <textarea 
                            value={jsonInput}
                            onChange={e => setJsonInput(e.target.value)}
                            className="w-full bg-gray-900 text-sm font-mono p-2 rounded mt-1 h-36"
                            placeholder="Paste your JSON array here..."
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-4 mt-6 flex-shrink-0">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Close
                    </button>
                    <button onClick={handleImport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg">Import Data
                    </button>
                </div>
            </div>
        </div>
    );
}
