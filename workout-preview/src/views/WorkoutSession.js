import React, { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { collection, doc, addDoc, setDoc, getDoc, getDocs, query, where, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { SparklesIcon } from '../components/Icons';
import { NumberStepper, WorkoutStatsHud } from '../components/UI';
import { TargetsModal } from '../components/TargetsModal';
import { ExerciseCard } from '../components/ExerciseCard';
import { TimerModal } from '../components/TimerModals';
import { appId } from '../constants';
import { useExercises } from '../context/ExerciseContext';
import { useNotification } from '../context/NotificationContext';
import { GeminiExerciseGeneratorModal } from '../components/GeminiExerciseGeneratorModal';
import { RestTimer } from '../components/RestTimer';
import { Metronome } from '../components/Metronome';
import { FinishFlowDialog } from '../components/FinishFlowDialog';

function AddExerciseFromDBModal({ isOpen, onClose, exerciseDatabase, onAddExercises, onGenerateExercise }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedExercises, setSelectedExercises] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedExercises([]);
            setSearchTerm('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSelectExercise = (exercise) => {
        setSelectedExercises(prev =>
            prev.some(ex => ex.id === exercise.id)
                ? prev.filter(ex => ex.id !== exercise.id)
                : [...prev, exercise]
        );
    };

    const filteredExercises = exerciseDatabase.filter(ex =>
        ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col" style={{height: '90vh'}}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Add Exercises from Database</h2>
                    <button onClick={onGenerateExercise} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors">
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        Generate with AI
                    </button>
                </div>
                <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded mb-4"
                />
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {filteredExercises.map(ex => (
                        <div
                            key={ex.id}
                            onClick={() => handleSelectExercise(ex)}
                            className={`p-3 rounded-lg cursor-pointer flex items-center ${selectedExercises.some(selEx => selEx.id === ex.id) ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedExercises.some(selEx => selEx.id === ex.id)}
                                readOnly
                                className="mr-4 h-5 w-5 rounded text-indigo-500 focus:ring-0"
                            />
                            <div>
                                <p className="font-semibold">{ex.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onAddExercises(selectedExercises);
                            onClose();
                        }}
                        disabled={selectedExercises.length === 0}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500"
                    >
                        Add Selected ({selectedExercises.length})
                    </button>
                </div>
            </div>
        </div>
    );
}


// Reducer for log transitions to avoid deep clones and centralize updates
function logReducer(state, action) {
    switch (action.type) {
        case 'reset': {
            return action.value || {};
        }
        case 'ensure': {
            const { instanceId, length } = action;
            const existing = state[instanceId] || [];
            if (existing.length === length) return state;
            const next = Array.from({ length }, (_, i) => existing[i] || { weight: '', reps: '', failed: false, setDuration: 0, restDuration: 0, status: 'pending' });
            return { ...state, [instanceId]: next };
        }
        case 'updateSet': {
            const { instanceId, index, updates } = action;
            const existing = state[instanceId] || [];
            const base = existing.map(s => ({ ...s }));
            if (!base[index]) return state;
            const set = base[index];
            if (set.status === 'completed' && updates.status && updates.status !== 'completed') {
                const isExplicitReset = updates.status === 'pending' && updates.failed === false && updates.setDuration === 0 && updates.restDuration === 0;
                if (!isExplicitReset) {
                    const { status, ...rest } = updates;
                    Object.assign(set, rest);
                    return { ...state, [instanceId]: base };
                }
            }
            if (updates.status === 'pending') {
                set.setStartedAt = null;
                set.setFinishedAt = null;
            }
            Object.assign(set, updates);
            return { ...state, [instanceId]: base };
        }
        case 'bulkApply': {
            const { instanceId, mapper } = action;
            const existing = state[instanceId] || [];
            return { ...state, [instanceId]: existing.map(mapper) };
        }
        default:
            return state;
    }
}

export function WorkoutSession({ userId, workoutId, navigate, activeWorkout, setActiveWorkout, workout: adHocWorkout }) {
    const { masterList: exerciseDatabase, loading: exercisesLoading, handleSaveExercise, deriveVariantMeta, buildVariantKey } = useExercises();
    const [workoutTemplate, setWorkoutTemplate] = useState(null);
    const [originalTemplate, setOriginalTemplate] = useState(null);
    const [log, dispatchLog] = useReducer(logReducer, {});
    const [startTime, setStartTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [timerModal, setTimerModal] = useState({ show: false, title: '', onStop: null });
    const [finishModalOpen, setFinishModalOpen] = useState(false);
    const [addExerciseModalOpen, setAddExerciseModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [shouldNavigate, setShouldNavigate] = useState(false);
    const [lastSetCompletedTime, setLastSetCompletedTime] = useState(null);
    const [showRestTimer, setShowRestTimer] = useState(false);
    const [collapsedExercises, setCollapsedExercises] = useState({});
    const [lockedExercises, setLockedExercises] = useState({});
    const [unlockedExerciseNotes, setUnlockedExerciseNotes] = useState({});
    const { showNotification } = useNotification();
    const [metronomeOn, setMetronomeOn] = useState(false);
    const [exerciseTimestamps, setExerciseTimestamps] = useState({}); // { [instanceId]: { startedAt, finishedAt } }
    const hasHydratedFromActiveRef = useRef(false);
    const loadedIdentifierRef = useRef(null);
    const [targetSettingsFor, setTargetSettingsFor] = useState(null);
    const getVariantsForName = useCallback((exerciseName) => ({ baseName: undefined, options: [] }), []);

    const workoutIdentifier = adHocWorkout ? adHocWorkout.id : (workoutId || 'new_workout');
    const adHocId = adHocWorkout ? adHocWorkout.id : null;

    const detectStructuralChanges = () => {
        if (!originalTemplate || !workoutTemplate) return false;

        // 1. Check for name/description changes
        if (originalTemplate.name !== workoutTemplate.name || 
            originalTemplate.description !== workoutTemplate.description) {
            return true;
        }

        // 2. Check for added/removed exercises
        if (originalTemplate.exercises.length !== workoutTemplate.exercises.length) {
            return true;
        }

        // 3. Check if exercises or their notes have changed
        for (let i = 0; i < originalTemplate.exercises.length; i++) {
            const originalEx = originalTemplate.exercises[i];
            const currentEx = workoutTemplate.exercises[i];
            if (originalEx.id !== currentEx.id || (originalEx.notes || '') !== (currentEx.notes || '')) {
                return true;
            }
        }
        
        return false;
    }

    const handleExportExerciseToDB = async (instanceId) => {
        const exercise = workoutTemplate.exercises.find(e => e.instanceId === instanceId);
        if (!exercise) return;

        const loggedSets = log[instanceId];

        if (!exercise.name) {
            showNotification('Exercise must have a name to be saved.', 'error');
            return;
        }

        const validSets = loggedSets.filter(s => s.weight !== '' && s.reps !== '');
        if (validSets.length === 0) {
            showNotification('No sets with weight and reps entered to export.', 'error');
            return;
        }

        const totalVolume = validSets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);

        const exerciseData = {
            name: exercise.name,
            lastPerformed: Timestamp.fromDate(new Date()),
            lastVolume: totalVolume,
            lastSets: validSets.length,
            lastReps: validSets.map(s => Number(s.reps) || 0),
            notes: exercise.notes || '',
            lastSessionNote: exercise.sessionNote || '',
            lastSetsData: validSets.map(s => ({
                weight: Number(s.weight) || 0,
                reps: Number(s.reps) || 0,
                failed: s.failed || false,
                volume: (Number(s.weight) || 0) * (Number(s.reps) || 0),
                setDuration: s.setDuration || 0,
                restDuration: s.restDuration || 0,
                setStartedAt: s.setStartedAt ? Timestamp.fromDate(new Date(s.setStartedAt)) : null,
                setFinishedAt: s.setFinishedAt ? Timestamp.fromDate(new Date(s.setFinishedAt)) : null,
                skippedAt: s.skippedAt ? Timestamp.fromDate(new Date(s.skippedAt)) : null
            })),
            // Targets
            targetSets: Number(exercise.targetSets || 3),
            targetReps: Number(exercise.targetReps || 10),
            targetRepRange: exercise.targetRepRange || [8, 12],
            targetWeight: Number(validSets[0]?.weight || exercise.targetWeight || 0),
            targetRPE: typeof exercise.targetRPE === 'number' ? exercise.targetRPE : 8,
            variantMeta: {
                ...(exercise.variantMeta || deriveVariantMeta(exercise.name, (exercise.masterData || {}))),
                isometric: (exercise.loadType === 'isometric') || (exercise.variantMeta?.isometric || false),
                unilateral: typeof exercise.unilateral === 'boolean' ? exercise.unilateral : (exercise.variantMeta?.unilateral || false),
                angleDeg: typeof exercise.angleDeg === 'number' ? exercise.angleDeg : (exercise.variantMeta?.angleDeg ?? null),
                angleRange: Array.isArray(exercise.angleRange) ? exercise.angleRange : (exercise.variantMeta?.angleRange || null),
                equipment: exercise.equipmentPrimary || exercise.variantMeta?.equipment || null
            }
        };

        try {
            const exercisesRef = collection(db, `artifacts/${appId}/users/${userId}/exercises`);
            const q = query(exercisesRef, where("name", "==", exercise.name), limit(1));
            const snapshot = await getDocs(q);

            let docId;
            if (snapshot.empty) {
                const newDocRef = await addDoc(exercisesRef, exerciseData);
                docId = newDocRef.id;
                showNotification(`'${exercise.name}' added to your database!`, 'success');
            } else {
                const docRef = snapshot.docs[0].ref;
                docId = docRef.id;
                await setDoc(docRef, exerciseData, { merge: true });
                showNotification(`'${exercise.name}' updated in your database!`, 'success');
            }

            const historyRef = collection(db, 'performanceHistory');
            const timestamps = exerciseTimestamps[instanceId] || {};
            const historyData = {
                date: exerciseData.lastPerformed,
                sets: exerciseData.lastSetsData,
                volume: exerciseData.lastVolume,
                userId: userId,
                exerciseName: exercise.name,
                exerciseId: docId,
                category: workoutTemplate.category || null,
                sessionNote: exercise.sessionNote || '',
                workoutId: workoutTemplate.isAdHoc ? 'ad-hoc' : (workoutTemplate.id || 'new'),
                workoutName: workoutTemplate.name || null,
                workoutStartedAt: Timestamp.fromDate(new Date(startTime)),
                workoutFinishedAt: null,
                exerciseStartedAt: timestamps.startedAt ? Timestamp.fromDate(new Date(timestamps.startedAt)) : null,
                exerciseFinishedAt: timestamps.finishedAt ? Timestamp.fromDate(new Date(timestamps.finishedAt)) : null,
                exerciseDurationSeconds: (timestamps.startedAt && timestamps.finishedAt) ? 
                    Math.max(0, Math.floor((timestamps.finishedAt - timestamps.startedAt) / 1000)) : null,
                targetSessionSeconds: Number(workoutTemplate.targetSessionSeconds || 0) || 0,
                targetRestSeconds: Number(workoutTemplate.targetRestSeconds || workoutTemplate.defaultRestSeconds || 0) || 0,
                actualRestSeconds: (Array.isArray(log[instanceId]) ? log[instanceId] : []).reduce((acc, s) => acc + (Number(s.restDuration) || 0), 0),
                plannedSets: Array.isArray(log[instanceId]) ? log[instanceId].length : 0,
                completedSets: Array.isArray(log[instanceId]) ? log[instanceId].filter(s => s.status === 'completed').length : 0,
                setStatuses: Array.isArray(log[instanceId]) ? log[instanceId].map(s => s.status || 'pending') : [],
                plan: {
                    loadType: exercise.loadType || 'weighted',
                    selectedVariant: exercise.selectedVariant || '',
                    baseName: exercise.baseName || '',
                    variantKey: buildVariantKey(exercise.baseName || exercise.name, exerciseData.variantMeta),
                    variantMeta: exerciseData.variantMeta,
                    targetSets: Number(exercise.targetSets || 0) || 0,
                    targetReps: Number(exercise.targetReps || 0) || 0,
                    targetRepRange: exercise.targetRepRange || [0, 0],
                    targetRPE: typeof exercise.targetRPE === 'number' ? exercise.targetRPE : 8,
                    targetWeight: Number(exercise.targetWeight || 0) || 0
                }
            };

            const existingHistoryDocId = workoutTemplate.exercises.find(e => e.instanceId === instanceId)?.historyDocId;

            if (existingHistoryDocId) {
                await setDoc(doc(historyRef, existingHistoryDocId), historyData);
            } else {
                const newHistoryDocRef = await addDoc(historyRef, historyData);
                setWorkoutTemplate(currentTemplate => {
                    const newExercises = [...currentTemplate.exercises];
                    const exToUpdate = newExercises.find(e => e.instanceId === instanceId);
                    if (exToUpdate) {
                        exToUpdate.historyDocId = newHistoryDocRef.id;
                    }
                    return { ...currentTemplate, exercises: newExercises };
                });
            }
        } catch (error) {
            console.error("Error exporting exercise:", error);
            showNotification("Failed to export exercise.", "error");
        }
    };

    useEffect(() => {
        const loadWorkoutData = async () => {
            if (exercisesLoading) return;

            // Prevent re-loading if we've already loaded this identifier
            if (loadedIdentifierRef.current === workoutIdentifier) return;

            if (!hasHydratedFromActiveRef.current && activeWorkout && activeWorkout.identifier === workoutIdentifier) {
                setWorkoutTemplate(activeWorkout.workoutTemplate);
                setOriginalTemplate(activeWorkout.originalTemplate);
                dispatchLog({ type: 'reset', value: activeWorkout.log });
                setStartTime(activeWorkout.startTime);
                setLastSetCompletedTime(activeWorkout.lastSetCompletedTime);
                setMetronomeOn(activeWorkout.metronomeOn);
                setExerciseTimestamps(activeWorkout.exerciseTimestamps || {});
                hasHydratedFromActiveRef.current = true;
                loadedIdentifierRef.current = workoutIdentifier;
                return;
            }

            if (adHocWorkout) {
                const initialLog = {};
                adHocWorkout.exercises.forEach(ex => {
                    if (!ex.instanceId) {
                        ex.instanceId = `${ex.id || ex.name}-${Date.now()}-${Math.random()}`;
                    }
                    ex.reps = Number(ex.reps) || 10;
                    ex.weight = Number(ex.weight) || 0;
                    ex.sessionNote = '';
                    ex.targetSets = Number(ex.targetSets || 3);
                    ex.targetReps = Number(ex.targetReps || 10);
                    ex.targetRepRange = ex.targetRepRange || [8, 12];
                    ex.targetWeight = Number(ex.targetWeight || 0);
                    ex.targetRPE = typeof ex.targetRPE === 'number' ? ex.targetRPE : 8;
                    const { baseName, options } = getVariantsForName(ex.name);
                    if (baseName) ex.baseName = baseName;
                    if (options && options.length > 0) ex.variantOptions = options;
                    initialLog[ex.instanceId] = ex.sets.map(s => ({
                        weight: Number(s?.weight) || 0,
                        reps: Number(s?.reps) || 10,
                        failed: false, // Reset failed status for new sessions
                        setDuration: 0,
                        restDuration: 0,
                        status: 'pending'
                    }));
                });
                setWorkoutTemplate(adHocWorkout);
                setOriginalTemplate(JSON.parse(JSON.stringify(adHocWorkout)));
                dispatchLog({ type: 'reset', value: initialLog });
                setStartTime(Date.now());
                loadedIdentifierRef.current = workoutIdentifier;
                return;
            }
            
            if (!userId) return;

            if (!workoutId) {
                const newWorkout = { name: 'New Workout', description: '', exercises: [], createdAt: new Date() };
                setWorkoutTemplate(newWorkout);
                setOriginalTemplate(JSON.parse(JSON.stringify(newWorkout)));
                dispatchLog({ type: 'reset', value: {} });
                setStartTime(Date.now());
                return;
            }

            const workoutDoc = await getDoc(doc(db, `artifacts/${appId}/users/${userId}/workouts`, workoutId));
            if (!workoutDoc.exists()) {
                showNotification('Workout not found.', 'error');
                navigate('workouts');
                return;
            }
            const template = { id: workoutDoc.id, ...workoutDoc.data() };
            
            template.exercises.forEach(ex => {
                if (!ex.instanceId) {
                    ex.instanceId = `${ex.id || ex.name}-${Date.now()}-${Math.random()}`;
                }
                // variant options disabled in session
            });
            
            const userExercisesQuery = query(collection(db, `artifacts/${appId}/users/${userId}/exercises`));
            const userExercisesSnapshot = await getDocs(userExercisesQuery);
            const userExercisesData = userExercisesSnapshot.docs.map(d => ({...d.data(), id: d.id}));

            const initialLog = {};
            template.exercises.forEach(ex => {
                const userExercise = userExercisesData.find(dbEx => dbEx.name === ex.name);

                // Prefill logic: if no history for this exact variant, prefill using nearest variant in same base group
                let sets;
                if (userExercise && userExercise.lastSetsData && userExercise.lastSetsData.length > 0) {
                    sets = userExercise.lastSetsData;
                } else {
                    const selectedMeta = ex.variantMeta || deriveVariantMeta(ex.name, ex.masterData || {});
                    const sameBase = userExercisesData.filter(dbEx => {
                        if (ex.baseName && dbEx.baseName) return dbEx.baseName === ex.baseName;
                        if (ex.groupKey && dbEx.groupKey) return dbEx.groupKey === ex.groupKey;
                        return (dbEx.baseName || dbEx.name) === (ex.baseName || ex.name);
                    }).filter(dbEx => Array.isArray(dbEx.lastSetsData) && dbEx.lastSetsData.length > 0);

                    // simple nearest heuristic: prefer same equipment, then unilateral match, then any
                    const ranked = sameBase.sort((a, b) => {
                        const ma = a.variantMeta || deriveVariantMeta(a.name, a.masterData || {});
                        const mb = b.variantMeta || deriveVariantMeta(b.name, b.masterData || {});
                        const score = (m) => (
                            (m.equipment === selectedMeta.equipment ? 2 : 0) +
                            (m.unilateral === selectedMeta.unilateral ? 1 : 0)
                        );
                        return score(mb) - score(ma);
                    });
                    const donor = ranked[0];
                    if (donor) {
                        sets = donor.lastSetsData.map(s => ({ reps: s.reps, weight: s.weight }));
                    } else {
                        sets = Array.from({ length: 3 }, () => ({ reps: 10, weight: 0 }));
                    }
                }

                ex.sets = sets;
                ex.weight = Number(sets[0]?.weight) || 0;
                ex.reps = Number(sets[0]?.reps) || 10;
                ex.sessionNote = '';
                ex.targetSets = Number(ex.targetSets || userExercise?.targetSets || 3);
                ex.targetReps = Number(ex.targetReps || userExercise?.targetReps || 10);
                ex.targetRepRange = ex.targetRepRange || userExercise?.targetRepRange || [8, 12];
                ex.targetWeight = Number(ex.targetWeight || userExercise?.targetWeight || sets[0]?.weight || 0);
                ex.targetRPE = typeof ex.targetRPE === 'number' ? ex.targetRPE : (typeof userExercise?.targetRPE === 'number' ? userExercise.targetRPE : 8);
                if (userExercise && userExercise.lastSessionNote) {
                    ex.lastSessionNote = userExercise.lastSessionNote;
                }
                if (!ex.baseName || !ex.variantOptions) {
                    // variant options disabled in session
                }
                initialLog[ex.instanceId] = sets.map(s => ({
                    weight: Number(s?.weight) || 0,
                    reps: Number(s?.reps) || 10,
                    failed: false, // Reset failed status for new sessions
                    setDuration: 0,
                    restDuration: 0,
                    status: 'pending'
                }));
            });

            setWorkoutTemplate(template);
            setOriginalTemplate(JSON.parse(JSON.stringify(template)));
            dispatchLog({ type: 'reset', value: initialLog });
            setStartTime(Date.now());
            loadedIdentifierRef.current = workoutIdentifier;
        };

        loadWorkoutData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, workoutId, workoutIdentifier, exercisesLoading, adHocId, getVariantsForName]);

    useEffect(() => {
        if (workoutTemplate && log) {
            setActiveWorkout({ identifier: workoutIdentifier, workoutTemplate, originalTemplate, log, startTime, lastSetCompletedTime, metronomeOn, exerciseTimestamps });
        }
    }, [log, workoutTemplate, originalTemplate, startTime, lastSetCompletedTime, metronomeOn, exerciseTimestamps, setActiveWorkout, workoutIdentifier]);

    useEffect(() => {
        if (shouldNavigate) {
            navigate('workouts');
        }
    }, [shouldNavigate, navigate]);

    useEffect(() => {
        const timer = setInterval(() => setElapsedTime(Math.floor((Date.now() - startTime) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    // Track exercise completion for timestamps
    useEffect(() => {
        if (!log || !workoutTemplate) return;
        
        workoutTemplate.exercises.forEach(ex => {
            const exerciseSets = log[ex.instanceId] || [];
            const allTerminal = exerciseSets.length > 0 && exerciseSets.every(set => set.status === 'completed');
            
            if (allTerminal) {
                setExerciseTimestamps(prev => {
                    const current = prev[ex.instanceId] || {};
                    if (!current.finishedAt) {
                        return { ...prev, [ex.instanceId]: { ...current, finishedAt: Date.now() } };
                    }
                    return prev;
                });
            }
        });
    }, [log, workoutTemplate]);

    const handleWorkoutChange = (field, value) => setWorkoutTemplate(w => ({ ...w, [field]: value }));

    const handleExerciseChange = (instanceId, field, value) => {
        setWorkoutTemplate(prev => {
            const newExercises = prev.exercises.map(ex => ex.instanceId === instanceId ? { ...ex } : ex);
            const currentExercise = newExercises.find(e => e.instanceId === instanceId);
            if (!currentExercise) return prev;

            if (field === 'sets') {
                const newNumberOfSets = parseInt(value, 10) || 0;
                const oldNumberOfSets = currentExercise.sets.length;

                if (newNumberOfSets > oldNumberOfSets) {
                    const toAdd = Array.from({ length: newNumberOfSets - oldNumberOfSets }, (_, i) => ({ id: `s${oldNumberOfSets + i + 1}`, reps: currentExercise.reps, weight: currentExercise.weight || '' }));
                    currentExercise.sets = [...currentExercise.sets, ...toAdd];
                } else if (newNumberOfSets < oldNumberOfSets) {
                    currentExercise.sets = currentExercise.sets.slice(0, newNumberOfSets);
                }

                dispatchLog({ type: 'ensure', instanceId, length: newNumberOfSets });
            } else if (field === 'reps') {
                currentExercise[field] = value;
                dispatchLog({ type: 'bulkApply', instanceId, mapper: (s) => ({ ...s, reps: value }) });
            } else if (field === 'weight') {
                currentExercise[field] = value;
                dispatchLog({ type: 'bulkApply', instanceId, mapper: (s) => ({ ...s, weight: value }) });
            } else {
                currentExercise[field] = value;
            }

            return { ...prev, exercises: newExercises };
        });
    };

    const quickChangeVariant = () => {};

    const handleAddExercises = (selectedExercises) => {
        const newExercises = selectedExercises.map(dbExercise => {
            const instanceId = `${dbExercise.id || dbExercise.name}-${Date.now()}-${Math.random()}`;
            const sets = (dbExercise.lastSetsData && dbExercise.lastSetsData.length > 0)
                ? dbExercise.lastSetsData.map((s, i) => ({ id: `s${i+1}`, reps: s.reps, weight: s.weight }))
                : [{id:'s1', reps:10, weight:0}, {id:'s2', reps:10, weight:0}, {id:'s3', reps:10, weight:0}];

            return {
                ...dbExercise, // carry over name, machine, notes etc
                instanceId,
                sets: sets,
                reps: Number(sets[0]?.reps) || 10,
                weight: Number(sets[0]?.weight) || 0,
                baseName: dbExercise.baseName,
                variantOptions: getVariantsForName(dbExercise.name).options,
                targetSets: Number(dbExercise.targetSets || 3),
                targetReps: Number(dbExercise.targetReps || 10),
                targetRepRange: dbExercise.targetRepRange || [8, 12],
                targetWeight: Number(dbExercise.targetWeight || sets[0]?.weight || 0)
            };
        });

        const newLogEntries = {};
        newExercises.forEach((ex) => {
            newLogEntries[ex.instanceId] = ex.sets.map(s => ({
                weight: Number(s?.weight) || 0,
                reps: Number(s?.reps) || 10,
                failed: false,
                setDuration: 0,
                restDuration: 0,
                status: 'pending'
            }));
        });
        
        setWorkoutTemplate(w => ({ ...w, exercises: [...w.exercises, ...newExercises] }));
        dispatchLog({ type: 'reset', value: { ...(log || {}), ...newLogEntries } });
    };

    const removeExercise = (instanceId) => {
        const newExercises = workoutTemplate.exercises.filter(ex => ex.instanceId !== instanceId);
        setWorkoutTemplate(w => ({ ...w, exercises: newExercises }));
        // Also remove from log, collapsed, and locked states
        dispatchLog({ type: 'reset', value: Object.fromEntries(Object.entries(log || {}).filter(([k]) => k !== instanceId)) });
        setCollapsedExercises(c => {
            const newC = {...c};
            delete newC[instanceId];
            return newC;
        });
        setLockedExercises(k => {
            const newK = {...k};
            delete newK[instanceId];
            return newK;
        });
    };

    const handleSetChange = (instanceId, setIndex, updates) => {
        dispatchLog({ type: 'updateSet', instanceId, index: setIndex, updates });
    };

    const markSetAsDone = (instanceId, setIndex) => {
        const currentSet = log[instanceId]?.[setIndex];
        if (currentSet && currentSet.status === 'completed') return; // Already completed, avoid redundant updates
        
        // Track exercise start time when first set is completed
        setExerciseTimestamps(prev => {
            const current = prev[instanceId] || {};
            if (!current.startedAt) {
                current.startedAt = Date.now();
            }
            return { ...prev, [instanceId]: current };
        });
        
        const updates = { status: 'completed', setFinishedAt: Date.now() };
        if (lastSetCompletedTime) {
            updates.restDuration = Math.floor((Date.now() - lastSetCompletedTime) / 1000);
        }
        
        handleSetChange(instanceId, setIndex, updates);
        setLastSetCompletedTime(Date.now());
        setShowRestTimer(true);
    };

    const markAllSetsAsDone = (instanceId) => {
        // Track exercise start and finish times
        setExerciseTimestamps(prev => {
            const current = prev[instanceId] || {};
            const now = Date.now();
            if (!current.startedAt) {
                current.startedAt = now;
            }
            current.finishedAt = now;
            return { ...prev, [instanceId]: current };
        });
        
        const current = (log && log[instanceId]) || [];
        if (current.length) {
            let firstApplied = false;
            current.forEach((_, idx) => {
                const updates = { status: 'completed' };
                if (!firstApplied && lastSetCompletedTime) {
                    updates.restDuration = Math.floor((Date.now() - lastSetCompletedTime) / 1000);
                    firstApplied = true;
                }
                dispatchLog({ type: 'updateSet', instanceId, index: idx, updates });
            });
        }
        setLastSetCompletedTime(Date.now());
        setShowRestTimer(true);
    };

    const startSet = (instanceId, setIndex) => {
        const currentSet = log[instanceId]?.[setIndex];
        if (currentSet && (currentSet.status === 'completed' || currentSet.status === 'active')) return; // Don't re-start already active/completed sets
        
        // Track exercise start time when first set is started
        setExerciseTimestamps(prev => {
            const current = prev[instanceId] || {};
            if (!current.startedAt) {
                current.startedAt = Date.now();
            }
            return { ...prev, [instanceId]: current };
        });
        
        const updates = { status: 'active', setStartedAt: Date.now() };
        if (lastSetCompletedTime) {
            updates.restDuration = Math.floor((Date.now() - lastSetCompletedTime) / 1000);
        }
        handleSetChange(instanceId, setIndex, updates);

        const exerciseName = workoutTemplate.exercises.find(e => e.instanceId === instanceId)?.name || 'Set';
        setTimerModal({
            show: true,
            title: `${exerciseName} - Set ${setIndex + 1}`,
            onStop: (time) => {
                handleSetChange(instanceId, setIndex, {
                    setDuration: time > 0 ? time : 0,
                    status: 'completed',
                    setFinishedAt: Date.now()
                });
                
                setLastSetCompletedTime(Date.now());
                setShowRestTimer(true);
                setTimerModal({ show: false, title: '', onStop: null });
            },
        });
        setShowRestTimer(false);
    };

    const handleFinish = () => {
        const hasChanges = detectStructuralChanges();
        
        if (workoutTemplate.isAdHoc) {
            saveWorkoutAndExit();
            return;
        }

        if (hasChanges) {
            setFinishModalOpen(true);
        } else {
            saveWorkoutAndExit(); 
        }
    };
    
    const saveWorkoutAndExit = async (templateSaveOption = 'discard') => {
        if (!workoutTemplate.name) {
            showNotification('Workout name cannot be empty.', 'error');
            return;
        }

        const nowDate = new Date();
        const workoutLog = {
            workoutId: workoutTemplate.isAdHoc ? 'ad-hoc' : (workoutTemplate.id || 'new'),
            workoutName: workoutTemplate.name,
            category: workoutTemplate.category || null,
            date: Timestamp.fromDate(nowDate),
            durationSeconds: elapsedTime,
            workoutStartedAt: Timestamp.fromDate(new Date(startTime)),
            workoutFinishedAt: Timestamp.fromDate(nowDate),
            targetSessionSeconds: Number(workoutTemplate.targetSessionSeconds || 0) || 0,
            targetRestSeconds: Number(workoutTemplate.targetRestSeconds || workoutTemplate.defaultRestSeconds || 0) || 0,
            actualRestSeconds: Object.values(log).reduce((acc, sets) => acc + sets.reduce((sacc, s) => sacc + (Number(s.restDuration) || 0), 0), 0),
            exercises: workoutTemplate.exercises.map((ex, exIndex) => ({
                name: ex.name,
                notes: ex.notes || '',
                sessionNote: ex.sessionNote || '',
                sets: log[ex.instanceId]?.filter(s => s.status === 'completed').map(s => ({
                    weight: Number(s.weight) || 0,
                    reps: Number(s.reps) || 0,
                    failed: s.failed || false,
                    setDuration: s.setDuration || 0,
                    restDuration: s.restDuration || 0,
                })) || [],
                targetSets: Number(ex.targetSets || 3),
                targetReps: Number(ex.targetReps || 10),
                targetRepRange: ex.targetRepRange || [8, 12],
                targetWeight: Number(ex.targetWeight || 0),
                targetRPE: typeof ex.targetRPE === 'number' ? ex.targetRPE : 8,
                plannedSets: Array.isArray(log[ex.instanceId]) ? log[ex.instanceId].length : 0,
                completedSets: Array.isArray(log[ex.instanceId]) ? log[ex.instanceId].filter(s => s.status === 'completed').length : 0,
                setStatuses: Array.isArray(log[ex.instanceId]) ? log[ex.instanceId].map(s => s.status || 'pending') : [],
                plan: {
                    loadType: ex.loadType || 'weighted',
                    selectedVariant: ex.selectedVariant || '',
                    baseName: ex.baseName || ''
                }
            }))
        };
        
        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/workoutLogs`), workoutLog);
            showNotification('Workout saved to history!', 'success');

            const exercisesRef = collection(db, `artifacts/${appId}/users/${userId}/exercises`);
            const historyUpdatePromises = workoutLog.exercises.map(async (loggedExercise, exIndex) => {
                if (!loggedExercise.sets || loggedExercise.sets.length === 0) return;

                const totalVolume = loggedExercise.sets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
                const totalSets = loggedExercise.sets.length;
                const repsPerSet = loggedExercise.sets.map(s => Number(s.reps) || 0);

                const exerciseData = {
                    name: loggedExercise.name,
                    lastPerformed: workoutLog.date,
                    lastVolume: totalVolume,
                    lastSets: totalSets,
                    lastReps: repsPerSet,
                    notes: loggedExercise.notes || '',
                    lastSessionNote: loggedExercise.sessionNote || '',
                    lastSetsData: loggedExercise.sets.map(s => ({
                        weight: Number(s.weight) || 0,
                        reps: Number(s.reps) || 0,
                        failed: s.failed || false,
                        volume: (Number(s.weight) || 0) * (Number(s.reps) || 0),
                        setDuration: s.setDuration || 0,
                        restDuration: s.restDuration || 0,
                        setStartedAt: s.setStartedAt ? Timestamp.fromDate(new Date(s.setStartedAt)) : null,
                        setFinishedAt: s.setFinishedAt ? Timestamp.fromDate(new Date(s.setFinishedAt)) : null
                    })),
                    targetSets: Number(loggedExercise.targetSets || 3),
                    targetReps: Number(loggedExercise.targetReps || 10),
                    targetRepRange: loggedExercise.targetRepRange || [8, 12],
                    targetWeight: Number(loggedExercise.targetWeight || loggedExercise.sets?.[0]?.weight || 0),
                    targetRPE: typeof loggedExercise.targetRPE === 'number' ? loggedExercise.targetRPE : 8,
                    variantMeta: {
                        ...(workoutTemplate.exercises[exIndex]?.variantMeta || deriveVariantMeta(loggedExercise.name, (workoutTemplate.exercises[exIndex]?.masterData || {}))),
                        isometric: (workoutTemplate.exercises[exIndex]?.loadType === 'isometric') || (workoutTemplate.exercises[exIndex]?.variantMeta?.isometric || false),
                        unilateral: typeof workoutTemplate.exercises[exIndex]?.unilateral === 'boolean' ? workoutTemplate.exercises[exIndex]?.unilateral : (workoutTemplate.exercises[exIndex]?.variantMeta?.unilateral || false),
                        angleDeg: typeof workoutTemplate.exercises[exIndex]?.angleDeg === 'number' ? workoutTemplate.exercises[exIndex]?.angleDeg : (workoutTemplate.exercises[exIndex]?.variantMeta?.angleDeg ?? null),
                        angleRange: Array.isArray(workoutTemplate.exercises[exIndex]?.angleRange) ? workoutTemplate.exercises[exIndex]?.angleRange : (workoutTemplate.exercises[exIndex]?.variantMeta?.angleRange || null),
                        equipment: workoutTemplate.exercises[exIndex]?.equipmentPrimary || workoutTemplate.exercises[exIndex]?.variantMeta?.equipment || null
                    }
                };

                const q = query(exercisesRef, where("name", "==", loggedExercise.name), limit(1));
                const snapshot = await getDocs(q);

                let docId;
                if (snapshot.empty) {
                    const newDocRef = await addDoc(exercisesRef, exerciseData);
                    docId = newDocRef.id;
                } else {
                    const docRef = snapshot.docs[0].ref;
                    docId = docRef.id;
                    await setDoc(docRef, exerciseData, { merge: true });
                }

                const historyRef = collection(db, 'performanceHistory');
                const exerciseInstanceId = workoutTemplate.exercises[exIndex]?.instanceId;
                const timestamps = exerciseTimestamps[exerciseInstanceId] || {};
                const historyData = {
                    date: exerciseData.lastPerformed,
                    sets: exerciseData.lastSetsData,
                    volume: exerciseData.lastVolume,
                    userId: userId,
                    exerciseName: loggedExercise.name,
                    exerciseId: docId,
                    category: workoutTemplate.category || null,
                    sessionNote: loggedExercise.sessionNote || '',
                    workoutId: workoutLog.workoutId,
                    workoutName: workoutLog.workoutName,
                    targetSessionSeconds: workoutLog.targetSessionSeconds,
                    targetRestSeconds: workoutLog.targetRestSeconds,
                    actualRestSeconds: workoutLog.actualRestSeconds,
                    exerciseStartedAt: timestamps.startedAt ? Timestamp.fromDate(new Date(timestamps.startedAt)) : null,
                    exerciseFinishedAt: timestamps.finishedAt ? Timestamp.fromDate(new Date(timestamps.finishedAt)) : null,
                    exerciseDurationSeconds: (timestamps.startedAt && timestamps.finishedAt) ? 
                        Math.max(0, Math.floor((timestamps.finishedAt - timestamps.startedAt) / 1000)) : null,
                    didNotComplete: !!workoutTemplate.exercises[exIndex]?.didNotComplete,
                    plannedSets: Array.isArray(log[exerciseInstanceId]) ? log[exerciseInstanceId].length : 0,
                    completedSets: Array.isArray(log[exerciseInstanceId]) ? log[exerciseInstanceId].filter(s => s.status === 'completed').length : 0,
                    skippedSets: Array.isArray(log[exerciseInstanceId]) ? log[exerciseInstanceId].filter(s => s.status === 'skipped').length : 0,
                    setStatuses: Array.isArray(log[exerciseInstanceId]) ? log[exerciseInstanceId].map(s => s.status || 'pending') : [],
                    plan: {
                        loadType: workoutTemplate.exercises[exIndex]?.loadType || 'weighted',
                        selectedVariant: workoutTemplate.exercises[exIndex]?.selectedVariant || '',
                        baseName: workoutTemplate.exercises[exIndex]?.baseName || '',
                        variantKey: buildVariantKey(workoutTemplate.exercises[exIndex]?.baseName || loggedExercise.name, exerciseData.variantMeta),
                        variantMeta: exerciseData.variantMeta,
                        targetSets: Number(workoutTemplate.exercises[exIndex]?.targetSets || 0) || 0,
                        targetReps: Number(workoutTemplate.exercises[exIndex]?.targetReps || 0) || 0,
                        targetRepRange: workoutTemplate.exercises[exIndex]?.targetRepRange || [0, 0],
                        targetRPE: typeof workoutTemplate.exercises[exIndex]?.targetRPE === 'number' ? workoutTemplate.exercises[exIndex].targetRPE : 8,
                        targetWeight: Number(workoutTemplate.exercises[exIndex]?.targetWeight || 0) || 0
                    }
                };

                const existingHistoryDocId = workoutTemplate.exercises[exIndex].historyDocId;

                if (existingHistoryDocId) {
                    await setDoc(doc(historyRef, existingHistoryDocId), historyData);
                } else {
                    await addDoc(historyRef, historyData);
                }
            });
            
            await Promise.all(historyUpdatePromises);
            
            if (!workoutTemplate.isAdHoc) {
                if (templateSaveOption === 'update') {
                    await setDoc(doc(db, `artifacts/${appId}/users/${userId}/workouts`, workoutTemplate.id), workoutTemplate);
                    showNotification('Workout template updated!', 'success');
                } else if (templateSaveOption === 'saveAsNew') {
                    const newTemplate = { ...workoutTemplate, name: `${workoutTemplate.name} (Modified)` };
                    delete newTemplate.id;
                    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/workouts`), newTemplate);
                    showNotification('New template saved!', 'success');
                }
            }
            // 'discard' option does nothing to the template

            setActiveWorkout(null);
            setShouldNavigate(true);
        } catch (error) {
            console.error("Error saving workout: ", error);
            showNotification('Failed to save workout.', 'error');
        } finally {
            setFinishModalOpen(false);
        }
    };

    if (!workoutTemplate || !log || exercisesLoading) return <div>Loading workout...</div>;
    
    const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

    return (
        <div>
            {timerModal.show && <TimerModal {...timerModal} />}
            
            <FinishFlowDialog
                open={finishModalOpen}
                onClose={() => setFinishModalOpen(false)}
                onUpdate={() => saveWorkoutAndExit('update')}
                onSaveAsNew={() => saveWorkoutAndExit('saveAsNew')}
                onDiscard={() => saveWorkoutAndExit('discard')}
            />

            <div className="flex justify-between items-center mb-4">
                 <input type="text" value={workoutTemplate.name} onChange={e => handleWorkoutChange('name', e.target.value)} className="text-3xl font-bold bg-transparent border-b-2 border-gray-700 focus:border-indigo-500 outline-none w-2/3" disabled={workoutTemplate.isAdHoc} />
                <div className="text-right">
                    <p className="font-mono text-xl">Elapsed: {formatTime(elapsedTime)}</p>
                    <div className="mt-2 flex items-center justify-end space-x-2 text-sm">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={metronomeOn} onChange={(e)=>setMetronomeOn(e.target.checked)} />
                            <span className="text-gray-300">Metronome 60 BPM</span>
                        </label>
                    </div>
                    {/* Target Session/Rest hidden in workout session per requirements */}
                </div>
            </div>
 
            {!workoutTemplate.isAdHoc &&
                <textarea value={workoutTemplate.description} onChange={e => handleWorkoutChange('description', e.target.value)} className="w-full bg-gray-700 p-2 rounded mt-1 mb-4 h-24" placeholder="Workout Notes..."></textarea>
            }
            {workoutTemplate.exercises.map((ex) => {
                const dbExercise = ex.name ? exerciseDatabase.find(dbEx => dbEx.name === ex.name) : null;
                const isCompleted = log[ex.instanceId]?.every(s => s.status === 'completed');
                const isLocked = lockedExercises[ex.instanceId] ?? isCompleted;
                const isCollapsed = collapsedExercises[ex.instanceId] ?? isCompleted;

                const exLog = log[ex.instanceId] || [];
                const completedVolume = exLog
                    .filter(s => s.status === 'completed')
                    .reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
                const expectedVolume = exLog
                    .reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
                
                const volumeCompletionPercentage = expectedVolume > 0 ? Math.round((completedVolume / expectedVolume) * 100) : 0;

                const getVolumePercentageChange = (current, last) => {
                    if (!last || last === 0) return null;
                    const change = ((current - last) / last) * 100;
                    const color = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-yellow-400';
                    const sign = change > 0 ? '+' : '';
                    return <span className={color}>({sign}{change.toFixed(1)}%)</span>;
                };

                const makeVariantQuickRefs = () => {
                    const selectedMeta = ex.variantMeta || deriveVariantMeta(ex.name, ex.masterData || {});
                    const selectedKey = buildVariantKey(ex.baseName || ex.name, selectedMeta);
                    // Find last records in DB per same baseName/groupKey
                    const sameBase = exerciseDatabase.filter(dbEx => {
                        if (ex.baseName && dbEx.baseName) return dbEx.baseName === ex.baseName;
                        if (ex.groupKey && dbEx.groupKey) return dbEx.groupKey === ex.groupKey;
                        return (dbEx.baseName || dbEx.name) === (ex.baseName || ex.name);
                    });
                    const items = sameBase
                        .map(dbEx => {
                            const last = dbEx.lastSetsData && dbEx.lastSetsData.length > 0 ? dbEx.lastSetsData : null;
                            const date = dbEx.lastPerformed?.toDate?.()?.toLocaleDateString?.() || '';
                            const summary = last ? `${last.map(s => `${s.weight}x${s.reps}`).join(' | ')}` : 'no sets';
                            const meta = dbEx.variantMeta || deriveVariantMeta(dbEx.name, dbEx.masterData || {});
                            const key = buildVariantKey(ex.baseName || ex.name, meta);
                            return { name: dbEx.name, date, summary, isSelected: key === selectedKey };
                        })
                        .filter(i => i.summary !== 'no sets')
                        .slice(0, 5);
                    return items;
                };

                const variantQuickRefs = makeVariantQuickRefs();

                return (
                    <ExerciseCard
                        key={ex.instanceId}
                        exercise={{ ...ex, displayName: ex.displayName || ex.baseName || ex.name }}
                        dbExercise={dbExercise ? { ...dbExercise, displayName: dbExercise.displayName || dbExercise.baseName || dbExercise.name } : null}
                        isCompleted={isCompleted}
                        isLocked={isLocked}
                        isCollapsed={isCollapsed}
                        onToggleCollapse={() => setCollapsedExercises(prev => ({...prev, [ex.instanceId]: !isCollapsed}))}
                        onToggleLock={() => setLockedExercises(prev => ({...prev, [ex.instanceId]: !isLocked}))}
                        onOpenTargets={null}
                        onRemove={() => removeExercise(ex.instanceId)}
                        exLog={log[ex.instanceId] || []}
                        completedVolume={completedVolume}
                        expectedVolume={expectedVolume}
                        volumeCompletionPercentage={volumeCompletionPercentage}
                        getVolumePercentageChange={getVolumePercentageChange}
                        unlockedNotes={false}
                        onToggleNotesLock={null}
                        onExerciseChange={(field, value) => handleExerciseChange(ex.instanceId, field, value)}
                        formatTime={formatTime}
                        onStartSet={(setIndex) => startSet(ex.instanceId, setIndex)}
                        onMarkSetDone={(setIndex) => markSetAsDone(ex.instanceId, setIndex)}
                        onChangeSet={(setIndex, updates) => handleSetChange(ex.instanceId, setIndex, updates)}
                        onMarkAllDone={() => markAllSetsAsDone(ex.instanceId)}
                        onUpdateExercise={() => handleExportExerciseToDB(ex.instanceId)}
                        
                    />
                );
            })}
            <div className="flex space-x-4 mt-4">
                 <button onClick={() => setAddExerciseModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg w-full" disabled={workoutTemplate.isAdHoc}>+ Add From Database</button>
            </div>
            
            <div className="mt-6 flex justify-end">
                <button onClick={handleFinish} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">
                    Finish Workout
                </button>
            </div>

            {showRestTimer && (
                <RestTimer 
                    startTime={lastSetCompletedTime} 
                    onClose={() => setShowRestTimer(false)} 
                    targetSeconds={workoutTemplate?.targetRestSeconds || workoutTemplate?.defaultRestSeconds}
                />
            )}

            {!showRestTimer && lastSetCompletedTime && (
                <button 
                    onClick={() => setShowRestTimer(true)}
                    className="fixed bottom-4 left-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full shadow-lg"
                >
                    Show Rest Timer
                </button>
            )}

            <AddExerciseFromDBModal
                isOpen={addExerciseModalOpen}
                onClose={() => setAddExerciseModalOpen(false)}
                exerciseDatabase={exerciseDatabase}
                onAddExercises={handleAddExercises}
                onGenerateExercise={() => {
                    setAddExerciseModalOpen(false);
                    setIsGenerating(true);
                }}
            />

            {isGenerating && (
                <GeminiExerciseGeneratorModal
                    onSave={handleSaveExercise}
                    onCancel={() => setIsGenerating(false)}
                />
            )}

            <Metronome enabled={metronomeOn} bpm={60} />

            {/* Toggleable workout vitals */}
            <div className="fixed bottom-4 right-4 flex flex-col items-end space-y-2">
                <WorkoutStatsHud totalRestTime={Object.values(log).reduce((acc, sets) => acc + sets.reduce((sacc, s) => sacc + (Number(s.restDuration) || 0), 0), 0)} elapsedTime={elapsedTime} />
                <button onClick={()=>{ const el = document.querySelector('[data-hud]'); if (el) el.classList.toggle('hidden'); }} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded">Show/Hide Vitals</button>
            </div>

            {targetSettingsFor && (() => {
                const exercise = workoutTemplate.exercises.find(e => e.instanceId === targetSettingsFor);
                if (!exercise) return null;
                const onChange = (field, value) => handleExerciseChange(exercise.instanceId, field, value);
                return (
                    <TargetsModal
                        exercise={exercise}
                        onClose={() => setTargetSettingsFor(null)}
                        onChange={onChange}
                        getVariantsForName={getVariantsForName}
                        exerciseDatabase={exerciseDatabase}
                        handleSaveExercise={handleSaveExercise}
                    />
                );
            })()}
        </div>
    );
}