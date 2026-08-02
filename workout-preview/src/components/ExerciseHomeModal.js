import React, { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { XIcon, EditIcon, TrashIcon, PlayIcon } from './Icons';
import { ConfirmationDialog } from './UI';
import { appId } from '../constants';
import { useExercises } from '../context/ExerciseContext';

export function ExerciseHomeModal({ userId, exercise, onClose, onStart, onEdit, onDelete }) {
    const { handleSaveExercise, generateExerciseDetails } = useExercises();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('overview'); // overview | history | metadata
    const [notesDraft, setNotesDraft] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const [targetSets, setTargetSets] = useState(3);
    const [targetReps, setTargetReps] = useState(10);
    const [targetRepRange, setTargetRepRange] = useState([8,12]);
    const [targetWeight, setTargetWeight] = useState(0);
    const [targetRPE, setTargetRPE] = useState(0); // percentage (0-100)

    // Variant editor state
    const [varLegMode, setVarLegMode] = useState(''); // 'single' | 'double' | 'alternating'
    const [varArmMode, setVarArmMode] = useState(''); // 'single' | 'double' | 'alternating'
    const [varIsometric, setVarIsometric] = useState(false);
    const [varEquipment, setVarEquipment] = useState('');
    const [varEquipmentSub, setVarEquipmentSub] = useState('');
    const [varAngleDeg, setVarAngleDeg] = useState('');
    const [varIsAngled, setVarIsAngled] = useState(false);

    const fetchHistory = useCallback(() => {
        if (!userId || !exercise?.id) return () => {};
        setLoading(true);
        const historyRef = collection(db, 'performanceHistory');
        const q = query(historyRef, where('userId', '==', userId), where('exerciseId', '==', exercise.id), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(historyData);
            setLoading(false);
        }, () => setLoading(false));
        return unsubscribe;
    }, [userId, exercise?.id]);

    useEffect(() => {
        const un = fetchHistory();
        return () => { try { un(); } catch(_){} };
    }, [fetchHistory]);

    useEffect(() => {
        setNotesDraft(exercise?.notes || '');
        setTargetSets(Number(exercise?.targetSets || 3));
        setTargetReps(Number(exercise?.targetReps || 10));
        setTargetRepRange(Array.isArray(exercise?.targetRepRange) ? exercise.targetRepRange : [8,12]);
        setTargetWeight(Number(exercise?.targetWeight || 0));
        setTargetRPE(Number(exercise?.targetRPE || 0));
        const meta = exercise?.variantMeta || {};
        setVarLegMode(meta.legMode || (exercise?.masterData?.muscleGroup === 'Legs' && exercise?.masterData?.unilateral ? 'single' : ''));
        setVarArmMode(meta.armMode || (exercise?.masterData?.muscleGroup !== 'Legs' ? 'double' : ''));
        setVarIsometric(Boolean(meta.isometric || (exercise?.masterData?.forceType || '').toLowerCase() === 'static'));
        setVarEquipment(String(meta.equipment || '').toLowerCase());
        setVarEquipmentSub(String(meta.equipmentSubType || (exercise?.masterData?.equipment?.[0] || '')).toLowerCase());
        setVarIsAngled(Boolean(meta.isAngled || typeof meta.angleDeg === 'number'));
        setVarAngleDeg(typeof meta.angleDeg === 'number' ? String(meta.angleDeg) : '');
    }, [exercise]);

    const currentVolume = history[0]?.volume || 0;
    const prevVolume = history[1]?.volume || 0;
    const latestSessionNote = history[0]?.sessionNote || exercise?.lastSessionNote || '';

    const saveNotes = async () => {
        if (!userId || !exercise?.id) return;
        setSavingNotes(true);
        try {
            const ref = doc(db, `artifacts/${appId}/users/${userId}/exercises`, exercise.id);
            await updateDoc(ref, { notes: notesDraft });
        } catch (e) {
            console.error('Failed to save notes', e);
        }
        setSavingNotes(false);
    };

    const saveTargets = async () => {
        if (!userId || !exercise?.id) return;
        try {
            const ref = doc(db, `artifacts/${appId}/users/${userId}/exercises`, exercise.id);
            await updateDoc(ref, {
                targetSets: Number(targetSets) || 0,
                targetReps: Number(targetReps) || 0,
                targetRepRange: Array.isArray(targetRepRange) ? targetRepRange : [8,12],
                targetWeight: Number(targetWeight) || 0,
                targetRPE: Number(targetRPE) || 0
            });
        } catch (e) {
            console.error('Failed to save targets', e);
        }
    };

    const formatTime = (seconds) => {
        if (seconds === undefined || seconds === null) return 'N/A';
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const makeDisplayNameFrom = (name, baseName, masterData = {}) => {
        if (baseName) return baseName;
        let n = String(name || '').trim();
        n = n.replace(/\([^)]*\)/g, '').trim();
        const removeTokens = [
            'smith machine','machine','db','dumbbell','dumbbells','bb','barbell','ez bar','ez-bar','cable','band',
            'seated','standing','lying','neutral-grip','close-grip','wide-grip','incline','decline',
            'single-leg','single leg','double-leg','double leg','alternate-leg','alternate leg','alternating',
            'iso','isometric','rear foot elevated','rear-foot-elevated','rfe'
        ];
        let lowered = n.toLowerCase();
        removeTokens.forEach(tok => { lowered = lowered.replace(new RegExp(`(^|\\s)${tok}(\\s|$)`, 'g'), ' '); });
        lowered = lowered.replace(/\s+/g, ' ').trim();
        lowered = lowered.replace(/lat-?pulldown/g, 'lat pulldown');
        lowered = lowered.replace(/t-?bar row/g, 't-bar row');
        lowered = lowered.replace(/pull-?up(s)?/g, 'pull-ups');
        lowered = lowered.replace(/pogos?/g, 'pogos');
        lowered = lowered.replace(/wall\s*sit(s)?/g, 'wall sit');
        const title = lowered.replace(/\b\w/g, c => c.toUpperCase());
        return title || name;
    };

    const saveVariants = async () => {
        if (!userId || !exercise?.id) return;
        try {
            const angleDegNum = varIsAngled ? (varAngleDeg === '' ? null : Number(varAngleDeg)) : null;
            const payload = {
                variantMeta: {
                    legMode: varLegMode || null,
                    armMode: varArmMode || null,
                    unilateral: (varLegMode === 'single') || (varArmMode === 'single'),
                    isometric: Boolean(varIsometric),
                    equipment: varEquipment || null,
                    equipmentSubType: varEquipmentSub || null,
                    isAngled: Boolean(varIsAngled),
                    angleDeg: angleDegNum,
                    angleRange: null
                },
                displayName: makeDisplayNameFrom(exercise.name, exercise.baseName, exercise.masterData || {})
            };
            const ref = doc(db, `artifacts/${appId}/users/${userId}/exercises`, exercise.id);
            await updateDoc(ref, payload);
        } catch (e) {
            console.error('Failed to save variants', e);
        }
    };

    if (!exercise) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl mx-4 flex flex-col" style={{height: '90vh'}}>
                <div className="flex justify-between items-center mb-4">
                    <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-indigo-300 break-words">{exercise.name}</h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {[exercise.masterData?.muscleGroup, exercise.masterData?.mechanics, exercise.masterData?.forceType].map((tagValue, i) => (
                                tagValue ? <span key={i} className="bg-gray-700 text-white px-2 py-1 rounded-full text-xs font-semibold">{tagValue}</span> : null
                            ))}
                            {exercise.variantMeta?.equipment && <span className="bg-gray-700 text-white px-2 py-1 rounded-full text-xs font-semibold">{exercise.variantMeta.equipment}</span>}
                            {exercise.variantMeta?.unilateral && <span className="bg-indigo-700 text-white px-2 py-1 rounded-full text-xs font-semibold">Unilateral</span>}
                            {exercise.variantMeta?.isometric && <span className="bg-purple-700 text-white px-2 py-1 rounded-full text-xs font-semibold">Isometric</span>}
                            {typeof exercise.variantMeta?.angleDeg === 'number' && <span className="bg-gray-700 text-white px-2 py-1 rounded-full text-xs font-semibold">{exercise.variantMeta.angleDeg}°</span>}
                            {Array.isArray(exercise.variantMeta?.angleRange) && <span className="bg-gray-700 text-white px-2 py-1 rounded-full text-xs font-semibold">{exercise.variantMeta.angleRange[0]}–{exercise.variantMeta.angleRange[1]}°</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Last: {exercise.lastPerformed?.toDate?.().toLocaleDateString?.() || 'N/A'}{typeof exercise.lastVolume === 'number' ? ` • Vol: ${exercise.lastVolume} lbs` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onStart && onStart(exercise)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"><PlayIcon className="h-5 w-5 mr-2"/>Start</button>
                        <button onClick={() => onEdit && onEdit(exercise)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg"><EditIcon className="h-5 w-5"/></button>
                        <button onClick={() => setConfirmDelete(true)} className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg"><TrashIcon className="h-5 w-5"/></button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white"><XIcon className="h-6 w-6"/></button>
                    </div>
                </div>

                {confirmDelete && (
                    <ConfirmationDialog
                        message="This will delete the tracked performance history for this exercise. Are you sure?"
                        onConfirm={() => { setConfirmDelete(false); onDelete && onDelete(exercise.id); onClose && onClose(); }}
                        onCancel={() => setConfirmDelete(false)}
                    />
                )}

                <div className="flex gap-2 mb-3">
                    {['overview','history','metadata'].map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded ${tab===t?'bg-indigo-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t[0].toUpperCase()+t.slice(1)}</button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    {tab === 'overview' && (
                        <div className="space-y-3">
                            <div className="bg-gray-900 p-4 rounded">
                                <h3 className="font-semibold mb-2">Overview</h3>
                                <p className="text-sm text-gray-400">Last performed: {exercise.lastPerformed?.toDate?.().toLocaleString?.() || 'N/A'}</p>
                                <div className="text-sm text-gray-300 mt-2">
                                    <div className="font-semibold">Total Volume: {currentVolume} lbs</div>
                                    <div className="mt-1">Volume: {currentVolume} lbs</div>
                                    <div>Last: {prevVolume} lbs {prevVolume ? '' : '(N/A)'}</div>
                                </div>
                            </div>
                            {/* Recent History moved to History tab */}
                            <div className="bg-gray-900 p-4 rounded">
                                <h3 className="font-semibold mb-2">Session Note</h3>
                                {latestSessionNote ? <p className="text-sm text-gray-300 italic">{latestSessionNote}</p> : <p className="text-sm text-gray-500">No session note recorded.</p>}
                            </div>
                            <div className="bg-gray-900 p-4 rounded">
                                <h3 className="font-semibold mb-2">Exercise Note (permanent)</h3>
                                <textarea value={notesDraft} onChange={(e)=>setNotesDraft(e.target.value)} className="w-full bg-gray-700 p-2 rounded mt-1 h-24" placeholder="Permanent cues/instructions"></textarea>
                                <div className="mt-2 text-right">
                                    <button onClick={saveNotes} disabled={savingNotes} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">{savingNotes ? 'Saving…' : 'Save Note'}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'history' && (
                        <div className="space-y-4">
                            {loading ? <p>Loading history…</p> : history.length === 0 ? <p className="text-gray-500">No past performance data found for this exercise.</p> : (
                                history.map(log => (
                                    <div key={log.id} className="bg-gray-900 p-4 rounded">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-semibold text-indigo-300">{log.date.toDate().toLocaleDateString()}</h4>
                                            <span className="text-sm text-gray-300">Total Volume: {log.volume || 0} lbs</span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            {log.sets.map((set, index) => (
                                                <div key={index} className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm p-1 bg-gray-800 rounded">
                                                    <span>Set {index + 1}: {set.weight ?? 'N/A'} lbs x {set.reps ?? 'N/A'} reps</span>
                                                    <div className="text-gray-400">
                                                        <span>Set: {formatTime(set.setDuration)}</span>
                                                        <span className="ml-2">Rest: {formatTime(set.restDuration)}</span>
                                                    </div>
                                                    {set.failed && <span className="text-red-500 font-bold">Failed</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {tab === 'metadata' && (() => {
                        const targetsView = {
                            targetSets: Number(exercise?.targetSets ?? 0),
                            targetReps: Number(exercise?.targetReps ?? 0),
                            targetRepRange: Array.isArray(exercise?.targetRepRange) ? exercise.targetRepRange : null,
                            targetWeight: Number(exercise?.targetWeight ?? 0),
                            targetRPE: Number(exercise?.targetRPE ?? 0),
                            historicalRepRange: Array.isArray(exercise?.historicalRepRange) ? exercise.historicalRepRange : null
                        };
                        const variantView = exercise?.variantMeta || {};
                        const historyView = (history || []).map(h => ({
                            id: h.id,
                            dateISO: h.date?.toDate?.()?.toISOString?.() || null,
                            volume: h.volume || 0,
                            sets: Array.isArray(h.sets) ? h.sets.map(s => ({ weight: s.weight, reps: s.reps, failed: !!s.failed, setDuration: s.setDuration || 0, restDuration: s.restDuration || 0 })) : []
                        }));
                        const fullView = {
                            id: exercise?.id,
                            name: exercise?.name,
                            baseName: exercise?.baseName || null,
                            groupKey: exercise?.groupKey || null,
                            displayName: exercise?.displayName || null,
                            lastPerformed: exercise?.lastPerformed || null,
                            lastVolume: exercise?.lastVolume || null,
                            lastSets: exercise?.lastSets || null,
                            lastReps: exercise?.lastReps || [],
                            lastSetsData: exercise?.lastSetsData || [],
                            notes: exercise?.notes || '',
                            lastSessionNote: exercise?.lastSessionNote || '',
                            masterData: exercise?.masterData || {},
                            targets: targetsView,
                            variantMeta: variantView,
                            variantPresets: exercise?.variantPresets || [],
                            history: historyView
                        };
                        return (
                            <div className="space-y-4">
                                <div className="bg-yellow-900/30 border border-yellow-800 text-yellow-200 p-3 rounded text-xs">
                                    Work-in-progress: Metadata is AI-generated and read-only here. Editing will be enabled in a future update.
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <h3 className="font-semibold mb-2">Entire Exercise (metadata)</h3>
                                    <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(fullView, null, 2)}</pre>
                                    <div className="mt-2 text-sm text-gray-300">
                                        <div><span className="text-gray-400">id:</span> {exercise?.id}</div>
                                        <div><span className="text-gray-400">name:</span> {exercise?.name}</div>
                                        <div><span className="text-gray-400">baseName:</span> {exercise?.baseName || '—'}</div>
                                        <div><span className="text-gray-400">lastPerformed:</span> {exercise?.lastPerformed?.toDate?.().toLocaleDateString?.() || 'N/A'}</div>
                                        <div><span className="text-gray-400">lastVolume:</span> {typeof exercise?.lastVolume === 'number' ? exercise.lastVolume : 0} lbs</div>
                                        <div><span className="text-gray-400">lastSets:</span> {exercise?.lastSets || 0}</div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <h3 className="font-semibold mb-2">Details (masterData)</h3>
                                    <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(exercise?.masterData || {}, null, 2)}</pre>
                                    <div className="mt-2 text-sm text-gray-300">
                                        <div><span className="text-gray-400">muscleGroup:</span> {exercise?.masterData?.muscleGroup || '—'}</div>
                                        <div><span className="text-gray-400">primaryMuscle:</span> {exercise?.masterData?.primaryMuscle || '—'}</div>
                                        <div><span className="text-gray-400">mechanics:</span> {exercise?.masterData?.mechanics || '—'}</div>
                                        <div><span className="text-gray-400">movementPattern:</span> {(exercise?.masterData?.movementPattern || []).join(', ') || '—'}</div>
                                        <div><span className="text-gray-400">equipment:</span> {(exercise?.masterData?.equipment || []).join(', ') || '—'}</div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <h3 className="font-semibold mb-2">Targets</h3>
                                    <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(targetsView, null, 2)}</pre>
                                    <div className="mt-2 text-sm text-gray-300">
                                        <div><span className="text-gray-400">targetSets:</span> {targetsView.targetSets || 0}</div>
                                        <div><span className="text-gray-400">targetReps:</span> {targetsView.targetReps || 0}</div>
                                        <div><span className="text-gray-400">targetRepRange:</span> {Array.isArray(targetsView.targetRepRange) ? targetsView.targetRepRange.join(' - ') : '—'}</div>
                                        <div><span className="text-gray-400">targetWeight:</span> {targetsView.targetWeight || 0}</div>
                                        <div><span className="text-gray-400">targetRPE:</span> {targetsView.targetRPE || 0}</div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <h3 className="font-semibold mb-2">Variants (variantMeta)</h3>
                                    <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(variantView, null, 2)}</pre>
                                    <div className="mt-2 text-sm text-gray-300">
                                        <div><span className="text-gray-400">equipment:</span> {variantView.equipment || '—'}</div>
                                        <div><span className="text-gray-400">equipmentSubType:</span> {variantView.equipmentSubType || '—'}</div>
                                        <div><span className="text-gray-400">legMode:</span> {variantView.legMode || '—'}</div>
                                        <div><span className="text-gray-400">armMode:</span> {variantView.armMode || '—'}</div>
                                        <div><span className="text-gray-400">isAngled:</span> {String(!!variantView.isAngled)}</div>
                                        <div><span className="text-gray-400">angleDeg:</span> {variantView.isAngled && typeof variantView.angleDeg === 'number' ? variantView.angleDeg : '—'}</div>
                                        <div><span className="text-gray-400">isometric:</span> {String(!!variantView.isometric)}</div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <h3 className="font-semibold mb-2">History</h3>
                                    <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(historyView, null, 2)}</pre>
                                    <div className="mt-2 text-sm text-gray-300 space-y-1">
                                        {(history || []).slice(0,5).map(h => (
                                            <div key={h.id} className="border border-gray-800 rounded p-2">
                                                <div><span className="text-gray-400">Date:</span> {h.date?.toDate?.().toLocaleDateString?.() || 'N/A'}</div>
                                                <div><span className="text-gray-400">Volume:</span> {h.volume || 0} lbs</div>
                                                <div className="text-xs text-gray-400">{Array.isArray(h.sets) ? h.sets.map((s,i)=>`Set ${i+1}: ${s.weight || 0} x ${s.reps || 0}${s.failed ? ' (Failed)' : ''}`).join(' • ') : ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}


