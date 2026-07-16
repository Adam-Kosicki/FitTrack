import React from 'react';
import { Modal, NumberStepper } from './UI';

export function TargetsModal({ exercise, onClose, onChange, getVariantsForName, exerciseDatabase, handleSaveExercise }) {
    if (!exercise) return null;
    const range = Array.isArray(exercise.targetRepRange) ? exercise.targetRepRange : [8, 12];
    const minRep = Number(range[0] || 0);
    const maxRep = Number(range[1] || 0);
    return (
        <Modal title="Targets & Options" onClose={onClose} maxWidthClass="max-w-xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Load Type</label>
                        <select
                            value={exercise.loadType || 'weighted'}
                            onChange={(e) => onChange('loadType', e.target.value)}
                            className="w-full bg-gray-700 rounded p-2"
                        >
                            <option value="weighted">Weighted</option>
                            <option value="bodyweight">Bodyweight</option>
                            <option value="isometric">Isometric</option>
                            <option value="plyometric">Plyometric</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Unilateral</label>
                        <select
                            value={String(!!exercise.unilateral)}
                            onChange={(e) => onChange('unilateral', e.target.value === 'true')}
                            className="w-full bg-gray-700 rounded p-2"
                        >
                            <option value="false">Bilateral</option>
                            <option value="true">Unilateral (Single-leg/arm)</option>
                        </select>
                    </div>
                    {Array.isArray(exercise.variantOptions) && exercise.variantOptions.length > 0 && (
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Variant</label>
                            <select
                                value={exercise.selectedVariant || ''}
                                onChange={(e) => {
                                    const selected = e.target.value;
                                    const { baseName, options } = getVariantsForName(selected || exercise.name);
                                    onChange('selectedVariant', selected);
                                    onChange('baseName', baseName);
                                    onChange('variantOptions', options);
                                    // Keep the exercise name as the canonical base name to avoid creating new DB docs per variant
                                    const canonicalName = baseName || exercise.name;
                                    onChange('name', canonicalName);
                                    // Prefill sets from the chosen variant's last sets if available
                                    const dbVar = exerciseDatabase.find(dbEx => dbEx.name === selected);
                                    if (dbVar && Array.isArray(dbVar.lastSetsData) && dbVar.lastSetsData.length > 0) {
                                        const first = dbVar.lastSetsData[0];
                                        const newSetsCount = dbVar.lastSetsData.length;
                                        onChange('weight', Number(first.weight) || 0);
                                        onChange('reps', Number(first.reps) || 10);
                                        onChange('sets', newSetsCount);
                                    }
                                }}
                                className="w-full bg-gray-700 rounded p-2"
                            >
                                <option value="">Select…</option>
                                {exercise.variantOptions.map((opt, i) => (
                                    <option key={i} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Equipment</label>
                        <select
                            value={exercise.equipmentPrimary || ''}
                            onChange={(e) => onChange('equipmentPrimary', e.target.value)}
                            className="w-full bg-gray-700 rounded p-2"
                        >
                            <option value="">Default</option>
                            <option value="dumbbell">Dumbbell</option>
                            <option value="barbell">Barbell</option>
                            <option value="machine">Machine</option>
                            <option value="cable">Cable</option>
                            <option value="bodyweight">Bodyweight</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Angle (°)</label>
                        <NumberStepper value={Number(exercise.angleDeg || 0)} onValueChange={(v) => onChange('angleDeg', Number(v))} allowDecimal={false} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Angle Range (min–max °)</label>
                        <div className="grid grid-cols-2 gap-2">
                            <NumberStepper value={Number((exercise.angleRange && exercise.angleRange[0]) || 0)} onValueChange={(v) => onChange('angleRange', [Number(v), Number((exercise.angleRange && exercise.angleRange[1]) || 0)])} allowDecimal={false} />
                            <NumberStepper value={Number((exercise.angleRange && exercise.angleRange[1]) || 0)} onValueChange={(v) => onChange('angleRange', [Number((exercise.angleRange && exercise.angleRange[0]) || 0), Number(v)])} allowDecimal={false} />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target Sets</label>
                        <NumberStepper value={Number(exercise.targetSets || 0)} onValueChange={(v) => onChange('targetSets', v)} allowDecimal={false} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target Reps</label>
                        <NumberStepper value={Number(exercise.targetReps || 0)} onValueChange={(v) => onChange('targetReps', v)} allowDecimal={false} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target Rep Range (Min)</label>
                        <NumberStepper value={minRep} onValueChange={(v) => onChange('targetRepRange', [Number(v), Number(maxRep)])} allowDecimal={false} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target Rep Range (Max)</label>
                        <NumberStepper value={maxRep} onValueChange={(v) => onChange('targetRepRange', [Number(minRep), Number(v)])} allowDecimal={false} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target RPE</label>
                        <NumberStepper value={Number(typeof exercise.targetRPE === 'number' ? exercise.targetRPE : 8)} onValueChange={(v) => onChange('targetRPE', v)} allowDecimal={true} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target Weight</label>
                        <NumberStepper value={Number(exercise.targetWeight || 0)} onValueChange={(v) => onChange('targetWeight', v)} allowDecimal={true} />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Close</button>
                </div>
            </div>
        </Modal>
    );
}


