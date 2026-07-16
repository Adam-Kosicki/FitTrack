import React, { useState, useEffect } from 'react';
import { SparklesIcon } from './Icons';
import { useExercises } from '../context/ExerciseContext';

export function GeminiExerciseGeneratorModal({ onSave, onCancel, existingExercise }) {
    const { generateExerciseDetails, parseBulkExercises } = useExercises();
    const [prompt, setPrompt] = useState('');
    const [generatedExercise, setGeneratedExercise] = useState(null);
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkInput, setBulkInput] = useState('');
    const [bulkParsed, setBulkParsed] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (existingExercise?.name) {
            setPrompt(existingExercise.name);
        }
    }, [existingExercise]);

    const handleGenerate = async () => {
        if (!bulkMode && !prompt.trim()) { setError("Please enter an exercise name or prompt."); return; }
        if (bulkMode && !bulkInput.trim()) { setError("Please paste exercises to parse."); return; }
        setIsLoading(true);
        setError(null);
        setGeneratedExercise(null);
        setBulkParsed([]);

        try {
            if (bulkMode) {
                const parsed = await parseBulkExercises(bulkInput);
                setBulkParsed(parsed);
            } else {
                const result = await generateExerciseDetails(prompt);
                setGeneratedExercise(result);
            }
        } catch (e) {
            console.error(e);
            setError("Failed to process. Check the console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!bulkMode) {
            if (generatedExercise) {
                let dataToSave = generatedExercise;
                if (existingExercise) dataToSave.id = existingExercise.id;
                onSave(dataToSave);
            }
            return;
        }
        if (bulkParsed.length > 0) {
            // Save all parsed items individually
            bulkParsed.forEach(item => {
                const base = {
                    name: item.name,
                    notes: item.notes || '',
                    masterData: {
                        muscleGroup: null,
                        primaryMuscle: null,
                        secondaryMuscle: null,
                        musclesInvolved: [],
                        mechanics: item.isIsometric ? 'Isolation' : null,
                        forceType: item.isIsometric ? 'Isometric' : null,
                        movementPattern: [],
                        jointAction: [],
                        equipment: [],
                        grip: null,
                        planeOfMotion: null,
                        unilateral: null,
                        tags: item.isIsometric ? ['isometric'] : []
                    }
                };
                onSave(base);
            });
            onCancel();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg mx-4">
                <h2 className="text-2xl font-bold mb-4 flex items-center"><SparklesIcon className="h-6 w-6 mr-2 text-indigo-400" /> AI Exercise Generator</h2>
                
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Mode</label>
                        <label className="text-xs text-gray-300 flex items-center gap-2">
                            <input type="checkbox" checked={bulkMode} onChange={e => setBulkMode(e.target.checked)} /> Bulk Import
                        </label>
                    </div>
                    {!bulkMode ? (
                        <div>
                            <label className="text-xs text-gray-400">Exercise Prompt</label>
                            <textarea 
                                value={prompt} 
                                onChange={e => setPrompt(e.target.value)} 
                                placeholder="e.g., A unique bicep exercise using only resistance bands"
                                className="w-full bg-gray-700 p-2 rounded mt-1 h-20"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs text-gray-400">Paste Exercises (one per line or paragraph)</label>
                            <textarea 
                                value={bulkInput} 
                                onChange={e => setBulkInput(e.target.value)} 
                                placeholder={`e.g.\nSingle-leg Leg Extension (60°) — 5 x 30–45s holds. Choose a load...\nSpanish Squat (60–90°) — 5 x 30–45s holds, torso upright.`}
                                className="w-full bg-gray-700 p-2 rounded mt-1 h-40"
                            />
                        </div>
                    )}
                    <button 
                        onClick={handleGenerate} 
                        disabled={isLoading || (!bulkMode && !prompt) || (bulkMode && !bulkInput)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors"
                    >
                        {isLoading ? 'Processing...' : (bulkMode ? 'Parse Exercises' : 'Generate Exercise')}
                    </button>
                </div>

                {error && <p className="text-red-500 mt-4">{error}</p>}

                {!bulkMode && generatedExercise && (
                    <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700 overflow-auto max-h-64">
                        <h3 className="text-xl font-bold text-indigo-300">{generatedExercise.name}</h3>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap">{JSON.stringify(generatedExercise.masterData, null, 2)}</pre>
                        {Array.isArray(generatedExercise.variantPresets) && generatedExercise.variantPresets.length > 0 && (
                            <div className="mt-3">
                                <h4 className="text-sm font-semibold text-gray-200">Variant presets</h4>
                                <ul className="list-disc list-inside text-xs text-gray-300 mt-1">
                                    {generatedExercise.variantPresets.map((vp, idx) => (
                                        <li key={idx}><span className="text-indigo-300 font-semibold">{vp.label}:</span> {JSON.stringify(vp.variantMeta)}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                {bulkMode && bulkParsed.length > 0 && (
                    <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700 overflow-auto max-h-64 text-xs text-gray-300">
                        <p className="mb-2">Parsed {bulkParsed.length} exercises. They will be created with notes only (and isometric tag when detected).</p>
                        <ol className="list-decimal list-inside space-y-1">
                            {bulkParsed.map((it, idx) => (
                                <li key={idx}><span className="text-indigo-300 font-semibold">{it.name}</span>{it.isIsometric ? ' — isometric' : ''}{it.notes ? ` — ${it.notes}` : ''}</li>
                            ))}
                        </ol>
                    </div>
                )}

                <div className="flex justify-end space-x-4 mt-8">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={(bulkMode ? bulkParsed.length === 0 : !generatedExercise) || isLoading}
                        className="bg-green-600 hover:bg-green-500 disabled:bg-green-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        {bulkMode ? 'Save All' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
} 