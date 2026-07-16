import React, { useState, useEffect } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { SparklesIcon, PlayIcon } from '../components/Icons';
import { ConfirmationDialog } from '../components/UI';
import { ExerciseEditModal } from '../components/ExerciseEditModal';
import { ExerciseHomeModal } from '../components/ExerciseHomeModal';
import { GeminiExerciseGeneratorModal } from '../components/GeminiExerciseGeneratorModal';
import { ImportExportModal } from '../components/ImportExportModal';
import { appId } from '../constants';
import { useExercises } from '../context/ExerciseContext';
import { useNotification } from '../context/NotificationContext';

const tagColors = {
    // Muscle Groups
    'Back': 'bg-red-600',
    'Chest': 'bg-blue-600',
    'Shoulders': 'bg-green-600',
    'Arms': 'bg-purple-600',
    'Legs': 'bg-orange-600',
    'Core': 'bg-yellow-600',

    // Mechanics
    'Compound': 'bg-teal-500',
    'Isolation': 'bg-pink-500',

    // Force Types
    'Push': 'bg-cyan-500',
    'Pull': 'bg-lime-500',
    'Hinge': 'bg-indigo-500',
};
const defaultTagColor = 'bg-gray-500';

// (removed unused ExerciseCard component)

export function ExerciseDatabaseView({ userId, navigate }) {
    const { masterList: exercises, loading, handleSaveExercise, updateExerciseSummaryFromHistory, generateExerciseDetails, migrateAndSyncExercises, deriveVariantMeta } = useExercises();
    const [filteredExercises, setFilteredExercises] = useState([]);
    const [editingExercise, setEditingExercise] = useState(null);
    const [deletingExerciseId, setDeletingExerciseId] = useState(null);
    const [viewingHistoryFor, setViewingHistoryFor] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedForBatch, setSelectedForBatch] = useState(new Set());
    const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);
    const [isImportExportOpen, setIsImportExportOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const { showNotification } = useNotification();
    const didPostLoadSync = React.useRef(false);

    const [filters, setFilters] = useState({ searchTerm: '' });
    const [viewModeGrouped, setViewModeGrouped] = useState(true);
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState(new Set());
    const [selectedMechanics, setSelectedMechanics] = useState(new Set());
    const [selectedForceTypes, setSelectedForceTypes] = useState(new Set());
    const [selectedTags, setSelectedTags] = useState(new Set());
    // New variation/equipment filters
    const [onlyIsometric, setOnlyIsometric] = useState(false);
    const [onlyUnilateral, setOnlyUnilateral] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(new Set());
    const toggleInSet = (setter) => (value) => {
        setter(prev => {
            const next = new Set(prev);
            if (next.has(value)) next.delete(value); else next.add(value);
            return next;
        });
    };
    const clearAllChipFilters = () => {
        setSelectedMuscleGroups(new Set());
        setSelectedMechanics(new Set());
        setSelectedForceTypes(new Set());
        setSelectedTags(new Set());
        setOnlyIsometric(false);
        setOnlyUnilateral(false);
        setSelectedEquipment(new Set());
    };
    const availableTags = React.useMemo(() => {
        const s = new Set();
        exercises.forEach(ex => (ex.masterData?.tags || []).forEach(t => s.add(String(t))));
        return Array.from(s).sort((a,b)=>a.localeCompare(b));
    }, [exercises]);

    const availableMuscleGroups = React.useMemo(() => {
        const s = new Set();
        exercises.forEach(ex => { const v = ex.masterData?.muscleGroup; if (v) s.add(String(v)); });
        return Array.from(s).sort((a,b)=>a.localeCompare(b));
    }, [exercises]);

    const availableMechanics = React.useMemo(() => {
        const s = new Set();
        exercises.forEach(ex => { const v = ex.masterData?.mechanics; if (v) s.add(String(v)); });
        return Array.from(s).sort((a,b)=>a.localeCompare(b));
    }, [exercises]);

    const availableForceTypes = React.useMemo(() => {
        const s = new Set();
        exercises.forEach(ex => { const v = ex.masterData?.forceType; if (v) s.add(String(v)); });
        return Array.from(s).sort((a,b)=>a.localeCompare(b));
    }, [exercises]);

    const slugify = (str) => {
        return (str || '')
            .toString()
            .toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    };

    const VariantBadges = ({ meta }) => {
        if (!meta) return null;
        const items = [];
        if (meta.equipment) items.push(<span key="eq" className={`bg-gray-700 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{meta.equipment}</span>);
        if (meta.unilateral) items.push(<span key="uni" className={`bg-indigo-700 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold`}>Unilateral</span>);
        if (meta.isometric) items.push(<span key="iso" className={`bg-purple-700 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold`}>Isometric</span>);
        if (typeof meta.angleDeg === 'number') items.push(<span key="ang" className={`bg-gray-700 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{meta.angleDeg}°</span>);
        if (Array.isArray(meta.angleRange)) items.push(<span key="rng" className={`bg-gray-700 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{meta.angleRange[0]}–{meta.angleRange[1]}°</span>);
        return <>{items}</>;
    };

    const abbrEquipment = (eq = '') => {
        const e = String(eq).toLowerCase();
        if (!e) return '';
        if (e.includes('dumbbell')) return 'DB';
        if (e.includes('barbell')) return 'BB';
        if (e.includes('ez')) return 'EZ';
        if (e.includes('cable')) return 'Cable';
        if (e.includes('machine')) return 'Machine';
        if (e.includes('bodyweight')) return 'Bodyweight';
        return e.replace(/\b\w/g, c => c.toUpperCase());
    };

    const formatVariantTitle = (baseName, ex) => {
        const meta = ex?.variantMeta || {};
        const parts = [];
        if (meta.isometric) parts.push('ISO');
        if (meta.isAngled && typeof meta.angleDeg === 'number') parts.push(`${meta.angleDeg}°`);
        if (meta.legMode === 'single') parts.push('Single-leg');
        if (meta.armMode === 'single') parts.push('Single-arm');
        if (meta.equipment) parts.push(abbrEquipment(meta.equipment));
        if (meta.equipmentSubType && !String(meta.equipmentSubType).toLowerCase().includes(meta.equipment)) parts.push(String(meta.equipmentSubType).replace(/\b\w/g, c => c.toUpperCase()));
        const left = parts.join(' ');
        return left ? `${left} ${baseName || ex?.displayName || ex?.name || ''}` : (ex?.displayName || ex?.name || baseName || '');
    };

    const formatVariantMetaInline = (meta = {}) => {
        const bits = [];
        if (meta.equipmentSubType) bits.push(String(meta.equipmentSubType).replace(/\b\w/g, c => c.toUpperCase()));
        else if (meta.equipment) bits.push(abbrEquipment(meta.equipment));
        if (meta.isAngled && typeof meta.angleDeg === 'number') bits.push(`${meta.angleDeg}°`);
        if (meta.legMode === 'single') bits.push('Single-leg');
        if (meta.legMode === 'double') bits.push('Double-leg');
        if (meta.legMode === 'alternating') bits.push('Alternating');
        if (!meta.legMode && meta.armMode === 'single') bits.push('Single-arm');
        if (!meta.legMode && meta.armMode === 'alternating') bits.push('Alternating');
        if (meta.isometric) bits.push('Isometric');
        return bits.join(' • ');
    };

    const deriveBaseName = (name, masterData = {}) => {
        if (!name) return null;
        let n = String(name).trim();
        // remove parenthetical qualifiers (angles, protocols)
        n = n.replace(/\([^)]*\)/g, '').trim();
        // tokens to strip
        const removeTokens = [
            // equipment / implements
            'smith machine', 'machine', 'db', 'dumbbell', 'dumbbells', 'bb', 'barbell', 'ez bar', 'ez-bar', 'cable', 'band',
            // positions / grips / qualifiers
            'seated', 'standing', 'lying', 'neutral-grip', 'close-grip', 'wide-grip', 'incline', 'decline',
            // protocols / modifiers
            'hsr', 'protocol', 'tempo', 'paused',
            // leg variations & iso
            'single-leg', 'single leg', 'double-leg', 'double leg', 'alternate-leg', 'alternate leg', 'alternating', 'iso', 'isometric',
            // common qualifiers
            'rear foot elevated', 'rear-foot-elevated', 'rfe'
        ];
        let lowered = n.toLowerCase();
        removeTokens.forEach(tok => {
            lowered = lowered.replace(new RegExp(`(^|\\s)${tok}(\\s|$)`, 'g'), ' ');
        });
        lowered = lowered.replace(/\s+/g, ' ').trim();
        // simple normalizations
        lowered = lowered.replace(/lat-?pulldown/g, 'lat pulldown');
        lowered = lowered.replace(/t-?bar row/g, 't-bar row');
        lowered = lowered.replace(/pull-?up(s)?/g, 'pull-ups');
        lowered = lowered.replace(/pogos?/g, 'pogos');
        lowered = lowered.replace(/wall\s*sit(s)?/g, 'wall sit');
        // heuristic by pattern
        const patterns = (masterData.movementPattern || []).map(s => String(s).toLowerCase());
        const mg = String(masterData.muscleGroup || '').toLowerCase();
        const has = (s) => lowered.includes(s);
        if (patterns.includes('horizontal press') || (mg === 'chest' && has('press'))) {
            return 'Bench Press';
        }
        if (patterns.includes('vertical press') && has('press')) {
            return 'Overhead Press';
        }
        if (has('curl') && mg === 'arms') {
            return 'Biceps Curl';
        }
        if (has('triceps') && has('extension')) {
            return 'Triceps Extension';
        }
        // Specific variants before generic keywords to avoid over-grouping
        if (has('split squat') || has('rear foot elevated') || has('bulgarian')) {
            return 'Split Squat';
        }
        if (has('squat')) {
            return 'Squat';
        }
        if (has('lunge')) {
            return 'Lunge';
        }
        if (has('leg press')) {
            return 'Leg Press';
        }
        if (has('pulldown')) {
            return 'Lat Pulldown';
        }
        if (has('row')) {
            return 'Row';
        }
        if (has('raise') && mg === 'shoulders') {
            return 'Lateral Raise';
        }
        if (has('calf') && (has('raise') || has('extension'))) {
            return 'Calf Raise';
        }
        if (has('pogos') || has('pogo')) {
            return 'Pogos';
        }
        if (has('bridge')) {
            return 'Bridge';
        }
        if (has('wall sit')) {
            return 'Wall Sit';
        }
        if (has('pull-ups') || has('pull up') || has('pull-up')) {
            return 'Pull-Ups';
        }
        // fallback to cleaned name with title case
        const title = lowered.replace(/\b\w/g, c => c.toUpperCase());
        return title;
    };

    const autoAssignGroups = async (onlySelected = false, silent = false) => {
        const target = onlySelected ? exercises.filter(ex => selectedForBatch.has(ex.id)) : exercises;
        if (target.length === 0) {
            if (!silent) showNotification(onlySelected ? 'No exercises selected.' : 'No exercises to process.', 'info');
            return;
        }
        try {
            const updates = target.map(async (ex) => {
                const base = deriveBaseName(ex.name, ex.masterData || {});
                if (!base) return null;
                const groupKey = slugify(base);
                if (ex.baseName === base && ex.groupKey === groupKey) return null;
                await handleSaveExercise({ id: ex.id, name: ex.name, masterData: ex.masterData || {}, baseName: base, groupKey });
                return ex.id;
            });
            await Promise.all(updates);
            if (!silent) showNotification('Grouping assigned. You may need to refresh to see consolidated groups.', 'success');
        } catch (e) {
            console.error('Auto-group failed', e);
            if (!silent) showNotification('Auto-group failed.', 'error');
        }
    };

    // Automatically sync grouping on first load
    useEffect(() => {
        // Run silently to avoid spamming notifications on entry
        autoAssignGroups(false, true);
        // Also backfill variant metadata for existing entries
        migrateAndSyncExercises?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // After exercises load, ensure sync ran against actual data
    useEffect(() => {
        if (didPostLoadSync.current) return;
        if (!Array.isArray(exercises) || exercises.length === 0) return;
        const needsVariant = exercises.some(ex => !ex.variantMeta);
        const needsGroup = exercises.some(ex => !ex.baseName || !ex.groupKey);
        if (needsGroup) autoAssignGroups(false, true);
        if (needsVariant) migrateAndSyncExercises?.();
        didPostLoadSync.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exercises]);

    useEffect(() => {
        let filtered = exercises;
        const { searchTerm } = filters;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(ex => (ex.name || '').toLowerCase().includes(q) || (ex.baseName || '').toLowerCase().includes(q));
        }
        if (selectedMuscleGroups.size > 0) {
            filtered = filtered.filter(ex => selectedMuscleGroups.has(ex.masterData?.muscleGroup));
        }
        if (selectedMechanics.size > 0) {
            filtered = filtered.filter(ex => selectedMechanics.has(ex.masterData?.mechanics));
        }
        if (selectedForceTypes.size > 0) {
            filtered = filtered.filter(ex => selectedForceTypes.has(ex.masterData?.forceType));
        }
        if (selectedTags.size > 0) {
            filtered = filtered.filter(ex => (ex.masterData?.tags || []).some(t => selectedTags.has(String(t))));
        }
        // New: isometric filter
        if (onlyIsometric) {
            filtered = filtered.filter(ex => {
                const tags = (ex.masterData?.tags || []).map(t => String(t).toLowerCase());
                const forceType = String(ex.masterData?.forceType || '').toLowerCase();
                const name = String(ex.name || '').toLowerCase();
                const meta = ex.variantMeta || deriveVariantMeta(ex.name, ex.masterData || {});
                return meta.isometric || tags.includes('isometric') || forceType === 'static' || name.startsWith('iso ') || name.includes(' isometric');
            });
        }
        // New: unilateral (single-leg) filter
        if (onlyUnilateral) {
            filtered = filtered.filter(ex => {
                const unilateral = Boolean(ex.masterData?.unilateral);
                const name = String(ex.name || '').toLowerCase();
                const meta = ex.variantMeta || deriveVariantMeta(ex.name, ex.masterData || {});
                return meta.unilateral || unilateral || name.includes('single-leg') || name.includes('single leg');
            });
        }
        // New: equipment filters
        if (selectedEquipment.size > 0) {
            filtered = filtered.filter(ex => {
                const eq = (ex.masterData?.equipment || []).map(e => String(e).toLowerCase());
                // map common synonyms to canonical tokens
                const canon = new Set(eq.flatMap(e => {
                    if (e.includes('dumbbell')) return ['dumbbell'];
                    if (e.includes('barbell')) return ['barbell'];
                    if (e.includes('machine')) return ['machine'];
                    if (e.includes('cable')) return ['cable'];
                    if (['none', 'bodyweight'].includes(e)) return ['bodyweight'];
                    return [e];
                }));
                for (const want of selectedEquipment) {
                    if (canon.has(String(want))) return true;
                }
                return false;
            });
        }
        filtered.sort((a, b) => (a.baseName || a.name).localeCompare(b.baseName || b.name));
        setFilteredExercises(filtered);
    }, [filters, exercises, selectedMuscleGroups, selectedMechanics, selectedForceTypes, selectedTags, onlyIsometric, onlyUnilateral, selectedEquipment, deriveVariantMeta]);

    // removed unused handleSelectionChange
    
    const handleSelectAll = () => {
        const allFilteredIds = new Set(filteredExercises.map(ex => ex.id));
        setSelectedForBatch(allFilteredIds);
    };

    const handleDeselectAll = () => {
        setSelectedForBatch(new Set());
    };

    const handleBatchRegenerate = async () => {
        const exercisesToRegen = exercises.filter(ex => selectedForBatch.has(ex.id));
        if (exercisesToRegen.length === 0) {
            showNotification('No exercises selected.', 'info');
            return;
        }

        showNotification(`Regenerating ${exercisesToRegen.length} exercises... This may take a moment.`, 'info');

        try {
            const regenerationPromises = exercisesToRegen.map(async (ex) => {
                const updatedData = await generateExerciseDetails(ex.name);
                await handleSaveExercise({ ...updatedData, id: ex.id }); // Ensure ID is preserved
            });
            await Promise.all(regenerationPromises);
            showNotification(`${exercisesToRegen.length} exercises regenerated successfully!`, 'success');
        } catch(error) {
            console.error("Batch regeneration failed:", error);
            showNotification('An error occurred during regeneration.', 'error');
        } finally {
            setSelectedForBatch(new Set());
            setIsSelectionModeActive(false);
        }
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleStartSingleExercise = (exercise) => {
        const tags = (exercise.masterData?.tags || []).map(t => String(t).toLowerCase());
        const equipment = (exercise.masterData?.equipment || []).map(e => String(e).toLowerCase());
        const forceType = (exercise.masterData?.forceType || '').toLowerCase();

        let loadType = 'weighted';
        if (tags.includes('plyometric')) {
            loadType = 'plyometric';
        } else if (tags.includes('isometric') || forceType === 'isometric' || forceType === 'static') {
            loadType = 'isometric';
        } else if (tags.includes('bodyweight') || equipment.includes('bodyweight') || equipment.includes('none') || equipment.length === 0) {
            loadType = 'bodyweight';
        }

        const adHocWorkout = {
            id: `ad-hoc_${exercise.id}_${Date.now()}`,
            name: `${exercise.name}`,
            isAdHoc: true,
            exercises: [{ 
                ...exercise, 
                sets: [{}], 
                exerciseId: exercise.id,
                loadType,
                holdSeconds: loadType === 'isometric' ? 30 : undefined
            }]
        };
        navigate('log', { workout: adHocWorkout, workoutId: adHocWorkout.id });
    };

    const handleSaveAndCloseModals = async (exerciseData) => {
        await handleSaveExercise(exerciseData);
        setEditingExercise(null);
        setIsGenerating(false);
    };

    const handleConfirmDelete = async () => {
        if (!deletingExerciseId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/exercises`, deletingExerciseId));
            showNotification("Tracked exercise data deleted.", "success");
        } catch (error) {
            showNotification("Failed to delete exercise data.", "error");
            console.error("Error deleting exercise:", error);
        } finally {
            setDeletingExerciseId(null);
        }
    };

    const handleRefreshAll = async () => {
        setIsRefreshing(true);
        try {
            const refreshPromises = exercises.map(exercise => updateExerciseSummaryFromHistory(exercise.id));
            await Promise.all(refreshPromises);
            showNotification('All exercises have been refreshed.', 'success');
        } catch (error) {
            console.error("Error refreshing all exercises:", error);
            showNotification('An error occurred while refreshing.', 'error');
        }
        setIsRefreshing(false);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            {viewingHistoryFor && (
                <ExerciseHomeModal 
                    userId={userId} 
                    exercise={viewingHistoryFor} 
                    onClose={() => setViewingHistoryFor(null)} 
                    onStart={handleStartSingleExercise}
                    onEdit={setEditingExercise}
                    onDelete={setDeletingExerciseId}
                />
            )}
             {editingExercise && (
                <ExerciseEditModal
                    exercise={editingExercise}
                    onSave={handleSaveAndCloseModals}
                    onCancel={() => setEditingExercise(null)}
                    onRegenerate={(exerciseToRegen) => {
                        setEditingExercise(null);
                        // Pass the whole exercise object to the generator
                        setIsGenerating(exerciseToRegen);
                    }}
                />
            )}
             {isGenerating && (
                <GeminiExerciseGeneratorModal
                    onSave={handleSaveAndCloseModals}
                    onCancel={() => setIsGenerating(false)}
                    existingExercise={typeof isGenerating === 'object' ? isGenerating : null}
                />
            )}
            {isImportExportOpen && <ImportExportModal onClose={() => setIsImportExportOpen(false)} />}
             {deletingExerciseId && (
                <ConfirmationDialog
                    message="This will delete the tracked performance history for this exercise. Are you sure?"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeletingExerciseId(null)}
                />
            )}

            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Exercise Database</h1>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleRefreshAll}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
                        disabled={isRefreshing}
                        title="Refresh All Exercises"
                    >
                        {isRefreshing ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 9.5M20 20l-1.5-1.5A9 9 0 013.5 14.5" /></svg>}
                    </button>
                    {/* Group All button hidden; grouping runs automatically on load */}
                    {isSelectionModeActive ? (
                        <>
                            <button onClick={handleSelectAll} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Select All</button>
                            <button onClick={handleDeselectAll} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Deselect All</button>
                            {/* Group Selected hidden; auto grouping handles this on load */}
                            <button onClick={handleBatchRegenerate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors" disabled={selectedForBatch.size === 0}>
                                <SparklesIcon className="h-5 w-5 mr-2" />
                                Regenerate ({selectedForBatch.size})
                            </button>
                             <button onClick={() => { setIsSelectionModeActive(false); setSelectedForBatch(new Set()); }} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsSelectionModeActive(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Select</button>
                             <button onClick={() => setIsImportExportOpen(true)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Import/Export</button>
                            <button onClick={() => setIsGenerating(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors">
                                <SparklesIcon className="h-5 w-5 mr-2" />
                                Generate with AI
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label htmlFor="searchFilter" className="block text-sm font-medium text-gray-400 mb-1">Search</label>
                        <input
                            type="text"
                            id="searchFilter"
                            placeholder="e.g., Barbell Bench Press..."
                            className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                            value={filters.searchTerm}
                            onChange={e => handleFilterChange('searchTerm', e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400 mr-1">Muscles:</span>
                        {availableMuscleGroups.map(mg => (
                            <button key={mg} onClick={()=>toggleInSet(setSelectedMuscleGroups)(mg)} className={`px-2 py-1 rounded-full text-xs ${selectedMuscleGroups.has(mg) ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{mg}</button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400 mr-1">Mechanics:</span>
                        {availableMechanics.map(m => (
                            <button key={m} onClick={()=>toggleInSet(setSelectedMechanics)(m)} className={`px-2 py-1 rounded-full text-xs ${selectedMechanics.has(m) ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{m}</button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400 mr-1">Force:</span>
                        {availableForceTypes.map(f => (
                            <button key={f} onClick={()=>toggleInSet(setSelectedForceTypes)(f)} className={`px-2 py-1 rounded-full text-xs ${selectedForceTypes.has(f) ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{f}</button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400 mr-1">Tags:</span>
                        {availableTags.map(t => (
                            <button key={t} onClick={()=>toggleInSet(setSelectedTags)(t)} className={`px-2 py-1 rounded-full text-xs ${selectedTags.has(t) ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t}</button>
                        ))}
                        <button onClick={clearAllChipFilters} className="ml-auto text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded">Clear</button>
                    </div>
                    {/* New variation/equipment filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400 mr-1">Variations:</span>
                        <label className="text-xs text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">
                            <input type="checkbox" className="mr-1 align-middle" checked={onlyIsometric} onChange={e=>setOnlyIsometric(e.target.checked)} /> Isometric
                        </label>
                        <label className="text-xs text-gray-300 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">
                            <input type="checkbox" className="mr-1 align-middle" checked={onlyUnilateral} onChange={e=>setOnlyUnilateral(e.target.checked)} /> Unilateral
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-400 mr-1">Equipment:</span>
                        {['dumbbell','barbell','machine','cable','bodyweight'].map(eq => (
                            <button key={eq} onClick={()=>toggleInSet(setSelectedEquipment)(eq)} className={`px-2 py-1 rounded-full text-xs ${selectedEquipment.has(eq) ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{eq.charAt(0).toUpperCase()+eq.slice(1)}</button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <p>Loading exercises...</p>
            ) : filteredExercises.length === 0 ? (
                <p className="text-gray-500">No exercises match the current filters.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {viewModeGrouped ? (
                        Object.entries(
                            filteredExercises.reduce((acc, ex) => {
                                const key = ex.groupKey || (ex.baseName ? ex.baseName.toLowerCase().replace(/\s+/g, '-') : `single:${ex.id}`);
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(ex);
                                return acc;
                            }, {})
                        ).map(([groupKey, list]) => {
                            const title = list[0].baseName || list[0].displayName || list[0].name;
                            const sorted = list.slice().sort((a, b) => a.name.localeCompare(b.name));
                            const latest = sorted.reduce((best, ex) => {
                                const ts = ex.lastPerformed?.toDate?.()?.getTime?.() || 0;
                                if (!best || ts > best.ts) return { ts, ex };
                                return best;
                            }, null);
                            const isExpanded = expandedGroups?.has?.(groupKey) || false;
                            return (
                                <div key={groupKey} className="bg-gray-900 p-4 rounded-lg">
                                    <div className="flex items-center justify-between cursor-pointer" onClick={()=>setExpandedGroups(prev=>{const n=new Set(prev||new Set()); if(n.has(groupKey)) n.delete(groupKey); else n.add(groupKey); return n;})}>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-bold text-indigo-300 break-words">{title}</h3>
                                                {[list[0].masterData?.muscleGroup, list[0].masterData?.mechanics, list[0].masterData?.forceType].map((tagValue, index) => {
                                                    if (!tagValue) return null;
                                                    const color = tagColors[tagValue] || defaultTagColor;
                                                    return <span key={index} className={`${color} text-white px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{tagValue}</span>;
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-400 whitespace-normal mt-1">
                                                {sorted.length} variant{sorted.length>1?'s':''}
                                                {latest?.ex?.name ? ` • Latest: ${latest.ex.name}${latest.ex.lastPerformed?.toDate?` (${latest.ex.lastPerformed.toDate().toLocaleDateString()})`:''}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e)=>e.stopPropagation()}></div>
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-3 space-y-2">
                                            {sorted.map(ex => {
                                                const variantTitle = ex.name || formatVariantTitle(title, ex);
                                                return (
                                                    <div key={ex.id || ex.name} className="bg-gray-800 p-3 rounded-md flex items-center justify-between cursor-pointer hover:bg-gray-700" onClick={() => setViewingHistoryFor(ex)}>
                                                        <div className="min-w-0 mr-3">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-indigo-200 truncate">{variantTitle}</p>
                                                                {formatVariantMetaInline(ex.variantMeta) && (
                                                                    <span className="text-[11px] text-gray-300">{formatVariantMetaInline(ex.variantMeta)}</span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1">Last: {ex.lastPerformed?.toDate?.().toLocaleDateString?.() || 'N/A'}{typeof ex.lastVolume === 'number' ? ` • Vol: ${ex.lastVolume} lbs` : ''}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <button onClick={(e) => { e.stopPropagation(); handleStartSingleExercise(ex); }} className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded" title="Start Now"><span className="inline-flex items-center"><PlayIcon className="h-4 w-4 mr-1"/>Start</span></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        filteredExercises.map(ex => (
                            <div key={ex.id || ex.name} className="bg-gray-900 p-4 rounded-lg cursor-pointer hover:bg-gray-800" onClick={() => setViewingHistoryFor(ex)}>
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 mr-3">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xl font-bold text-indigo-300 break-words">{ex.name || formatVariantTitle(ex.baseName || ex.displayName || ex.name, ex)}</p>
                                            {formatVariantMetaInline(ex.variantMeta) && (
                                                <span className="text-[11px] text-gray-300">{formatVariantMetaInline(ex.variantMeta)}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">Last: {ex.lastPerformed?.toDate?.().toLocaleDateString?.() || 'N/A'}{typeof ex.lastVolume === 'number' ? ` • Vol: ${ex.lastVolume} lbs` : ''}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleStartSingleExercise(ex); }} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center" title="Start Now"><PlayIcon className="h-5 w-5 mr-1"/>Start</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
} 

const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
); 