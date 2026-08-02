import React, { useState, useEffect } from 'react';
import { SparklesIcon, TrashIcon } from './Icons';

export function ExerciseEditModal({ exercise, onSave, onCancel, onRegenerate }) {
    const [name, setName] = useState('');
    const [masterData, setMasterData] = useState({});
    const [baseName, setBaseName] = useState('');
    const [groupKey, setGroupKey] = useState('');

    useEffect(() => {
        if (exercise) {
            setName(exercise.name || '');
            setMasterData(exercise.masterData || {});
            setBaseName(exercise.baseName || '');
            setGroupKey(exercise.groupKey || '');
        }
    }, [exercise]);

    const handleMasterDataChange = (key, value) => {
        setMasterData(prev => ({ ...prev, [key]: value }));
    };

    const handleAddField = () => {
        const newKey = prompt("Enter the name for the new field:");
        if (newKey && !masterData.hasOwnProperty(newKey)) {
            handleMasterDataChange(newKey, '');
        }
    };

    const handleRemoveField = (keyToRemove) => {
        setMasterData(prev => {
            const newMasterData = { ...prev };
            delete newMasterData[keyToRemove];
            return newMasterData;
        });
    };

    const handleSave = () => {
        onSave({
            ...exercise,
            name,
            masterData,
            baseName: baseName || undefined,
            groupKey: groupKey || undefined
        });
    };

    if (!exercise) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Edit Exercise</h2>

                <div className="flex-grow overflow-y-auto pr-2">
                <div className="space-y-4">
                    <div>
                            <label className="text-sm font-semibold text-gray-300">Exercise Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                className="w-full bg-gray-700 p-2 rounded mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-300">Base Name (Group)</label>
                                <input
                                    type="text"
                                    value={baseName}
                                    onChange={e => {
                                        const v = e.target.value;
                                        setBaseName(v);
                                        if (!groupKey && v) {
                                            const slug = v.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
                                            setGroupKey(slug);
                                        }
                                    }}
                                    placeholder="e.g., Bench Press"
                                    className="w-full bg-gray-700 p-2 rounded mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-300">Group Key (slug)</label>
                                <input
                                    type="text"
                                    value={groupKey}
                                    onChange={e => setGroupKey(e.target.value)}
                                    placeholder="e.g., bench-press"
                                    className="w-full bg-gray-700 p-2 rounded mt-1"
                                />
                            </div>
                        </div>

                        {Object.entries(masterData).map(([key, value]) => (
                            <div key={key} className="flex items-end space-x-2">
                                <div className="flex-grow">
                                    <label className="text-sm font-semibold text-gray-300 capitalize">{key.replace(/_/g, ' ')}</label>
                                    <input
                                        type="text"
                                        value={Array.isArray(value) ? value.join(', ') : value}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            handleMasterDataChange(key, Array.isArray(value) ? newValue.split(',').map(s => s.trim()) : newValue);
                                        }}
                                        className="w-full bg-gray-700 p-2 rounded mt-1"
                                    />
                                </div>
                                <button onClick={() => handleRemoveField(key)} className="p-2 text-red-500 hover:text-red-400">
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                    </div>
                        ))}
                    </div>
                     <button onClick={handleAddField} className="mt-4 text-indigo-400 hover:text-indigo-300 font-semibold text-sm">+ Add New Field</button>
                </div>

                <div className="flex-shrink-0 flex flex-wrap justify-between items-center mt-6 gap-2">
                    <button 
                        onClick={() => onRegenerate(exercise)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors text-sm"
                    >
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        Regenerate with AI
                    </button>
                    <div className="flex space-x-4">
                        <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">
                        Save
                    </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 