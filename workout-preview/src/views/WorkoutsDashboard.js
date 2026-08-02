import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, writeBatch, updateDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { PlusIcon } from '../components/Icons';
import { ConfirmationDialog, Modal, TextArea } from '../components/UI';
import { WorkoutTile } from '../components/dashboard/WorkoutTile';
import { GroupCard } from '../components/dashboard/GroupCard';
import { GroupModal } from '../components/dashboard/GroupModal';
import { appId } from '../constants';
import { useNotification } from '../context/NotificationContext';
import { GoogleGenerativeAI } from '@google/generative-ai';
import GEMINI_API_KEY from '../firebase/gemini-api';
import { useExercises } from '../context/ExerciseContext';

export function WorkoutsDashboard({ userId, navigate, activeWorkoutId }) {
    const [workouts, setWorkouts] = useState([]);
    const [groups, setGroups] = useState([]);
    // legacy menu state removed in favor of modals
    const [deletingWorkoutId, setDeletingWorkoutId] = useState(null);
    const [isGroupingMode, setIsGroupingMode] = useState(false);
    const [selectedWorkoutIds, setSelectedWorkoutIds] = useState(() => new Set());
    const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
    const [editingGroup, setEditingGroup] = useState(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupDescription, setEditGroupDescription] = useState('');
    const { showNotification } = useNotification();
    const [editAiText, setEditAiText] = useState('');
    const [generatingGroupIds, setGeneratingGroupIds] = useState(() => new Set());
    const [exportText, setExportText] = useState('');
    const genAI = useMemo(() => new GoogleGenerativeAI(GEMINI_API_KEY), []);
    const { masterList: exerciseDatabase } = useExercises();
    const [editAiSummaryText, setEditAiSummaryText] = useState('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [groupOptionsTab, setGroupOptionsTab] = useState('overview'); // 'overview' | 'options'
    const [editingWorkout, setEditingWorkout] = useState(null);
    const [workoutOptionsTab, setWorkoutOptionsTab] = useState('overview'); // 'overview' | 'edit' | 'options'
    const [workoutExportText, setWorkoutExportText] = useState('');
    // export helpers are defined after normalizeKey and exerciseByName
    const [lastWorkoutMeta, setLastWorkoutMeta] = useState(null);

    useEffect(() => {
        if (!userId) return;

        const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/workouts`), (snapshot) => {
            const workoutData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            workoutData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setWorkouts(workoutData);
        });
        return () => unsubscribe();
    }, [userId]);

    // Subscribe to workout groups
    useEffect(() => {
        if (!userId) return;
        const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/workoutGroups`), (snapshot) => {
            const groupData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Optional: sort by createdAt desc
            groupData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setGroups(groupData);
        });
        return () => unsubscribe();
    }, [userId]);

    const handleDeleteWorkout = async () => {
        if (!deletingWorkoutId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/workouts`, deletingWorkoutId));
            showNotification("Workout deleted.", "success");
        } catch (error) {
            showNotification("Failed to delete workout.", "error");
            console.error("Error deleting workout:", error);
        } finally {
            setDeletingWorkoutId(null);
            // setMenuOpenFor(null); // legacy menu state removed
        }
    };
    
    const handleDuplicateWorkout = async (workoutToDuplicate) => {
        const newWorkout = {
            ...workoutToDuplicate,
            name: `${workoutToDuplicate.name} (Copy)`,
            createdAt: new Date(),
        };
        delete newWorkout.id; // Remove id to let Firestore generate a new one

        try {
            const workoutsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/workouts`);
            await addDoc(workoutsCollectionRef, newWorkout);
            showNotification('Workout duplicated!', 'success');
        } catch (error) {
            console.error("Error duplicating workout:", error);
            showNotification('Failed to duplicate workout.', 'error');
        } finally {
            // setMenuOpenFor(null); // legacy menu state removed
        }
    };

    // Grouping helpers
    const toggleGroupingMode = () => {
        setIsGroupingMode((prev) => !prev);
        setSelectedWorkoutIds(new Set());
        // setMenuOpenFor(null); // legacy menu state removed
    };

    const toggleSelectWorkout = useCallback((workoutId) => {
        setSelectedWorkoutIds(prev => {
            const next = new Set(prev);
            if (next.has(workoutId)) next.delete(workoutId); else next.add(workoutId);
            return next;
        });
    }, []);

    const isWorkoutSelected = useCallback((workoutId) => selectedWorkoutIds.has(workoutId), [selectedWorkoutIds]);

    const handleCreateGroupFromSelection = async () => {
        if (selectedWorkoutIds.size < 1) {
            showNotification('Select at least one workout to group.', 'error');
            return;
        }
        const name = window.prompt('Name this group');
        if (!name) return;
        try {
            // 1) Create group document
            const groupsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/workoutGroups`);
            const groupDocRef = await addDoc(groupsCollectionRef, {
                name,
                createdAt: new Date(),
            });

            // 2) Assign selected workouts to this group
            const batch = writeBatch(db);
            selectedWorkoutIds.forEach((wid) => {
                const wRef = doc(db, `artifacts/${appId}/users/${userId}/workouts`, wid);
                batch.update(wRef, { groupId: groupDocRef.id });
            });
            await batch.commit();

            showNotification('Group created and workouts assigned!', 'success');
            setIsGroupingMode(false);
            setSelectedWorkoutIds(new Set());
        } catch (error) {
            console.error('Failed to create group or assign workouts', error);
            showNotification('Failed to create group.', 'error');
        }
    };

    const handleUngroupSelected = async () => {
        if (selectedWorkoutIds.size === 0) {
            showNotification('Select workouts to ungroup.', 'error');
            return;
        }
        try {
            const batch = writeBatch(db);
            selectedWorkoutIds.forEach((wid) => {
                const wRef = doc(db, `artifacts/${appId}/users/${userId}/workouts`, wid);
                batch.update(wRef, { groupId: null });
            });
            await batch.commit();
            showNotification('Workouts ungrouped.', 'success');
            setSelectedWorkoutIds(new Set());
        } catch (e) {
            console.error('Failed to ungroup workouts', e);
            showNotification('Failed to ungroup workouts.', 'error');
        }
    };

    const toggleGroupCollapse = useCallback((groupId) => {
        setCollapsedGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
            return next;
        });
    }, []);

    // removed legacy handler

    const openEditGroupModal = (group) => {
        setEditingGroup(group);
        setEditGroupName(group?.name || '');
        setEditGroupDescription(group?.description || '');
        setEditAiText(group?.aiDescription || '');
        setEditAiSummaryText(group?.aiSummary || '');
        const gw = workoutsByGroupId[group.id] || [];
        setExportText(buildExportText(group, gw));
        setGroupOptionsTab('overview');
    };

    const handleSaveEditedGroup = async () => {
        if (!editingGroup) return;
        try {
            await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/workoutGroups`, editingGroup.id), {
                name: (editGroupName || 'Untitled Group').trim(),
                description: (editGroupDescription || '').trim(),
                aiDescription: (editAiText || '').trim(),
                aiSummary: (editAiSummaryText || '').trim()
            });
            showNotification('Group updated.', 'success');
            setEditingGroup(null);
        } catch (e) {
            console.error('Failed to update group', e);
            showNotification('Failed to update group.', 'error');
        }
    };


    // removed unused group description helpers

    const handleAddSelectedToGroup = async (groupId) => {
        if (selectedWorkoutIds.size === 0) {
            showNotification('Select workouts to add.', 'error');
            return;
        }
        try {
            const batch = writeBatch(db);
            selectedWorkoutIds.forEach(wid => {
                const wRef = doc(db, `artifacts/${appId}/users/${userId}/workouts`, wid);
                batch.update(wRef, { groupId });
            });
            await batch.commit();
            showNotification('Selected workouts added to group.', 'success');
        } catch (e) {
            console.error('Failed to add to group', e);
            showNotification('Failed to add to group.', 'error');
        }
    };

    const handleAddSelectedToChosenGroup = async () => {
        if (selectedWorkoutIds.size === 0) {
            showNotification('Select workouts to add.', 'error');
            return;
        }
        const options = groups.map(g => g.name).filter(Boolean);
        const chosen = window.prompt(`Add to which group?\nAvailable: ${options.join(', ')}`);
        if (!chosen) return;
        const target = groups.find(g => (g.name || '').toLowerCase().trim() === chosen.toLowerCase().trim());
        if (!target) {
            showNotification('Group not found. Check the name and try again.', 'error');
            return;
        }
        await handleAddSelectedToGroup(target.id);
    };

    // removed unused remove-selected-from-group helper

    const workoutsByGroupId = useMemo(() => {
        const map = {};
        workouts.forEach(w => {
            const gid = w.groupId || null;
            if (!gid) return;
            if (!map[gid]) map[gid] = [];
            map[gid].push(w);
        });
        return map;
    }, [workouts]);

    const ungroupedWorkouts = useMemo(() => workouts.filter(w => !w.groupId), [workouts]);

    const normalizeKey = useCallback((str) => {
        return String(str || '')
            .toLowerCase()
            .replace(/\([^)]*\)/g, '') // remove parenthetical
            .replace(/[^a-z0-9]+/g, ' ') // non-alnum to space
            .replace(/\s+/g, ' ') // collapse spaces
            .trim();
    }, []);

    const exerciseByName = useMemo(() => {
        const map = {};
        (exerciseDatabase || []).forEach(ex => {
            if (!ex) return;
            const name = ex.name || '';
            const baseName = ex.baseName || '';
            const keys = new Set([
                name.toLowerCase(),
                normalizeKey(name),
                baseName ? baseName.toLowerCase() : '',
                baseName ? normalizeKey(baseName) : ''
            ].filter(Boolean));
            keys.forEach(k => { if (!map[k]) map[k] = ex; });
        });
        return map;
    }, [exerciseDatabase, normalizeKey]);

    const buildExportText = useCallback((group, groupWorkouts) => {
        const lines = [];
        lines.push(`Group: ${group?.name || ''}`.trim());
        if (group?.description) lines.push(`Notes: ${group.description}`);
        lines.push('');
        const formatExercise = (exercise, index) => {
            const name = exercise?.name || `Exercise ${index + 1}`;
            const setsField = exercise?.sets;
            const fallbackSets = Number(exercise?.targetSets || exercise?.setsCount || 0) || null;
            const fallbackReps = Number(exercise?.reps || exercise?.targetReps || 0) || null;
            const key = normalizeKey(name);
            const dbMatch = exerciseByName[(name || '').toLowerCase()] || exerciseByName[key] || null;
            const dbSets = Array.isArray(dbMatch?.lastSetsData) && dbMatch.lastSetsData.length > 0 ? dbMatch.lastSetsData : null;

            const chosenSets = Array.isArray(setsField) && setsField.length > 0 ? setsField : (dbSets || null);

            if (Array.isArray(chosenSets) && chosenSets.length > 0) {
                const repsValues = chosenSets.map(s => (s && s.reps !== undefined && s.reps !== null && s.reps !== '') ? Number(s.reps) : null);
                const haveAllReps = repsValues.every(r => r !== null);
                if (haveAllReps) {
                    const first = repsValues[0];
                    const uniform = repsValues.every(r => r === first);
                    if (uniform) return `${name} — ${chosenSets.length}x${first}`;
                    return `${name} — ${chosenSets.length} sets: ${repsValues.map(r => r === null ? '?' : r).join(', ')}`;
                }
                return `${name} — ${chosenSets.length} sets`;
            }
            // Fallback numeric summary
            if (fallbackSets && fallbackReps) return `${name} — ${fallbackSets}x${fallbackReps}`;
            if (fallbackSets) return `${name} — ${fallbackSets} sets`;
            return `${name}`;
        };

        (groupWorkouts || []).forEach((w, wi) => {
            lines.push(`${wi + 1}. Workout: ${w.name || 'Untitled'}`);
            if (w.description) lines.push(`   Description: ${w.description}`);
            const exercises = Array.isArray(w.exercises) ? w.exercises : [];
            if (exercises.length) {
                lines.push('   Exercises:');
                exercises.forEach((e, ei) => {
                    lines.push(`     - ${formatExercise(e, ei)}`);
                });
            }
            lines.push('');
        });
        return lines.join('\n').trim();
    }, [exerciseByName, normalizeKey]);

    // const buildWorkoutExportJson = useCallback((workout) => {
    //   // removed for now
    // }, [exerciseByName, normalizeKey]);

    const buildWorkoutExportText = useCallback((workout) => {
        if (!workout) return '';
        const lines = [];
        lines.push(`Workout: ${workout.name || 'Untitled'}`);
        if (workout.description) lines.push(`Description: ${workout.description}`);
        const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
        if (exercises.length) {
            lines.push('Exercises:');
            exercises.forEach((e, idx) => {
                const name = e?.name || `Exercise ${idx + 1}`;
                const setsArray = Array.isArray(e?.sets) ? e.sets : null;
                const key = normalizeKey(name);
                const dbMatch = exerciseByName[(name || '').toLowerCase()] || exerciseByName[key] || null;
                const dbSets = Array.isArray(dbMatch?.lastSetsData) && dbMatch.lastSetsData.length > 0 ? dbMatch.lastSetsData : null;
                const chosenSets = Array.isArray(setsArray) && setsArray.length > 0 ? setsArray : (dbSets || []);
                if (chosenSets.length > 0) {
                    const repsValues = chosenSets.map(s => (s && s.reps != null && s.reps !== '') ? Number(s.reps) : null);
                    const haveAllReps = repsValues.every(r => r !== null);
                    if (haveAllReps) {
                        const first = repsValues[0];
                        const uniform = repsValues.every(r => r === first);
                        lines.push(`  - ${name} — ${uniform ? `${chosenSets.length}x${first}` : `${chosenSets.length} sets: ${repsValues.map(r => r ?? '?').join(', ')}`}`);
                    } else {
                        lines.push(`  - ${name} — ${chosenSets.length} sets`);
                    }
                } else {
                    lines.push(`  - ${name}`);
                }
            });
        }
        return lines.join('\n');
    }, [exerciseByName, normalizeKey]);

    // removed cached exports/loading; we generate directly per open workout

    const buildGroupSummaryPrompt = useCallback((group, groupWorkouts, exportText) => {
        const lines = [];
        lines.push(`You are a strength coach. Your job is to read the provided workouts and write a short program brief.`);
        lines.push('');
        lines.push(`Rules:`);
        lines.push(`- Write 1–2 short paragraphs (100–150 words total).`);
        lines.push(`- First summarize what kind of split this is (e.g. upper/lower, push–pull, mixed).`);
        lines.push(`- Then explain what the program is good for (strength, hypertrophy, rehab, athletic performance).`);
        lines.push(`- Highlight primary focuses (e.g. quads, hamstrings, delts) and secondary focuses.`);
        lines.push(`- Mention if it includes special methods (HSR, plyometrics, unilateral work).`);
        lines.push(`- Keep the tone factual, concise, and practical.`);
        lines.push(`- Do not invent exercises or details not listed.`);
        lines.push('');
        lines.push(`Source (use ONLY the text below):`);
        lines.push(exportText || '');
        return lines.join('\n');
    }, []);

    const generateAiDescriptionForGroup = useCallback(async (group, overrideExportText = null) => {
        const groupWorkouts = workoutsByGroupId[group.id] || [];
        if (!groupWorkouts.length) return null;
        try {
            setGeneratingGroupIds(prev => new Set(prev).add(group.id));
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest', generationConfig: { temperature: 0.2, maxOutputTokens: 300 } });
            const exportText = overrideExportText != null ? overrideExportText : buildExportText(group, groupWorkouts);
            const prompt = buildGroupSummaryPrompt(group, groupWorkouts, exportText);
            const result = await model.generateContent([prompt]);
            const response = await result.response;
            const text = (await response.text()).replace(/```[a-z]*|```/gi, '').trim();
            return text;
        } catch (e) {
            console.error('AI generation failed for group', group?.id, e);
            showNotification('AI failed to summarize this group.', 'error');
            return null;
        } finally {
            setGeneratingGroupIds(prev => {
                const next = new Set(prev);
                next.delete(group.id);
                return next;
            });
        }
    }, [genAI, buildGroupSummaryPrompt, workoutsByGroupId, showNotification, buildExportText]);

    
    const groupOverview = useMemo(() => {
        if (!editingGroup) return null;
        const list = workoutsByGroupId[editingGroup.id] || [];
        const muscleStats = {};
        let totalSets = 0;
        let totalReps = 0;
        let totalExercises = 0;
        const special = { HSR: 0, plyometrics: 0, unilateral: 0 };

        const normalizeName = (name) => normalizeKey(name || '');

        list.forEach(w => {
            const exercises = Array.isArray(w.exercises) ? w.exercises : [];
            exercises.forEach((ex) => {
                const name = ex?.name || '';
                const key = normalizeName(name);
                const dbMatch = exerciseByName[(name || '').toLowerCase()] || exerciseByName[key] || null;
                const mg = (dbMatch?.masterData?.muscleGroup) || 'Unknown';

                const setsArray = Array.isArray(ex?.sets) ? ex.sets : null;
                const fallbackSets = Number(ex?.targetSets || ex?.setsCount || 0) || 0;
                const fallbackReps = Number(ex?.reps || ex?.targetReps || 0) || 0;
                let setsCount = 0;
                let repsSum = 0;
                if (setsArray && setsArray.length > 0) {
                    setsCount = setsArray.length;
                    repsSum = setsArray.reduce((acc, s) => acc + (Number((s && s.reps) ?? 0) || 0), 0);
                } else if (fallbackSets) {
                    setsCount = fallbackSets;
                    repsSum = fallbackSets * fallbackReps;
                } else {
                    setsCount = 0;
                    repsSum = 0;
                }

                totalSets += setsCount;
                totalReps += repsSum;
                totalExercises += 1;

                if (!muscleStats[mg]) muscleStats[mg] = { sets: 0, reps: 0, exercises: 0 };
                muscleStats[mg].sets += setsCount;
                muscleStats[mg].reps += repsSum;
                muscleStats[mg].exercises += 1;

                const tags = Array.isArray(dbMatch?.masterData?.tags) ? dbMatch.masterData.tags.map(t => String(t).toLowerCase()) : [];
                const nameLower = name.toLowerCase();
                if (nameLower.includes('hsr') || nameLower.includes("jumper's knee") || tags.includes('rehab')) special.HSR += 1;
                if (nameLower.includes('depth jump') || tags.includes('plyometric') || tags.includes('plyometrics')) special.plyometrics += 1;
                if (dbMatch?.masterData?.unilateral || nameLower.includes('split squat') || nameLower.includes('single-leg')) special.unilateral += 1;
            });
        });

        const muscleGroupsSorted = Object.entries(muscleStats)
            .map(([k, v]) => ({ muscleGroup: k, ...v }))
            .sort((a, b) => b.sets - a.sets);

        return {
            workoutsCount: list.length,
            totalExercises,
            totalSets,
            totalReps,
            muscleGroupsSorted,
            special
        };
    }, [editingGroup, workoutsByGroupId, exerciseByName, normalizeKey]);

    // Keep workout modal data fresh as workouts change
    useEffect(() => {
        if (!editingWorkout) return;
        const latest = workouts.find(w => w.id === editingWorkout.id);
        if (latest && latest !== editingWorkout) {
            setEditingWorkout(latest);
        }
        // set editable text from generator on open/change
        try {
            const text = buildWorkoutExportText(latest || editingWorkout);
            setWorkoutExportText(text);
        } catch (_) {}
    }, [workouts, editingWorkout, buildWorkoutExportText]);

    // Fetch last done meta for the specific workout when opening the modal
    useEffect(() => {
        const fetchLastMeta = async () => {
            try {
                if (!userId || !editingWorkout?.id) { setLastWorkoutMeta(null); return; }
                const historyRef = collection(db, 'performanceHistory');
                const qObj = query(
                    historyRef,
                    where('userId', '==', userId),
                    where('workoutId', '==', editingWorkout.id),
                    orderBy('date', 'desc'),
                    limit(1)
                );
                const snap = await getDocs(qObj);
                if (snap.empty) { setLastWorkoutMeta(null); return; }
                const data = snap.docs[0].data();
                const workoutStartedAt = data.workoutStartedAt?.toDate?.() || null;
                const workoutFinishedAt = data.workoutFinishedAt?.toDate?.() || null;
                const durationSeconds = (workoutStartedAt && workoutFinishedAt)
                    ? Math.max(0, Math.floor((workoutFinishedAt - workoutStartedAt) / 1000))
                    : (data.durationSeconds || null);
                setLastWorkoutMeta({
                    date: data.date?.toDate?.() || null,
                    workoutStartedAt,
                    workoutFinishedAt,
                    durationSeconds
                });
            } catch (e) {
                console.error('Failed to load last workout meta', e);
                setLastWorkoutMeta(null);
            }
        };
        fetchLastMeta();
    }, [editingWorkout?.id, userId]);

    // Auto-refresh group export text when underlying workouts or dependencies change
    useEffect(() => {
        if (!editingGroup) return;
        const gw = workoutsByGroupId[editingGroup.id] || [];
        setExportText(buildExportText(editingGroup, gw));
    }, [editingGroup, workoutsByGroupId, buildExportText]);

    // removed global recompute; workout export text is generated on open

    const generateAiSummaryFromDescription = useCallback(async (descriptionText) => {
        if (!descriptionText) return null;
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest', generationConfig: { temperature: 0.2, maxOutputTokens: 80 } });
            const prompt = [
                'You are an editor. Summarize the following program description into 1–2 sentences (max 40 words).',
                'Plain text only. Do not add bullets or headings.',
                '',
                'Description:',
                descriptionText
            ].join('\n');
            const result = await model.generateContent([prompt]);
            const response = await result.response;
            const text = (await response.text()).replace(/```[a-z]*|```/gi, '').trim();
            return text;
        } catch (e) {
            console.error('AI summary generation failed', e);
            return null;
        }
    }, [genAI]);

    

    useEffect(() => {
        if (!userId || !groups.length) return;
        const run = async () => {
            for (const group of groups) {
                const list = workoutsByGroupId[group.id] || [];
                const needsAi = !group.aiDescription && list.length > 0 && !generatingGroupIds.has(group.id);
                if (needsAi) {
                    const aiText = await generateAiDescriptionForGroup(group);
                    if (aiText && aiText !== group.aiDescription) {
                        try {
                            await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/workoutGroups`, group.id), { aiDescription: aiText });
                            // Also generate a short summary from the description
                            const summary = await generateAiSummaryFromDescription(aiText);
                            if (summary) {
                                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/workoutGroups`, group.id), { aiSummary: summary });
                            }
                        } catch (e) {
                            console.error('Failed saving AI description', e);
                        }
                    }
                }
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, groups, workoutsByGroupId]);

    const handleCreateNewTemplate = async () => {
        const newWorkout = {
            name: "New Workout Template",
            description: "A fresh start!",
            createdAt: new Date(),
            exercises: []
        };

        try {
            const workoutsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/workouts`);
            await addDoc(workoutsCollectionRef, newWorkout);
            showNotification('New workout template created!', 'success');
        } catch (error) {
            console.error("Error creating new template:", error);
            showNotification('Failed to create new template.', 'error');
        }
    };
    
    // removed Sync/Refresh handler; recompute happens automatically
    
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-2 md:space-y-0">
                <h1 className="text-3xl font-bold text-center md:text-left">Workouts</h1>
                <div className="w-full md:w-auto">
                    <div className="flex gap-2">
                        <button onClick={handleCreateNewTemplate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors">
                            <PlusIcon className="h-5 w-5 mr-2" />
                            New Workout
                        </button>
                        <button
                            onClick={toggleGroupingMode}
                            className={`font-bold py-2 px-4 rounded-lg transition-colors ${isGroupingMode ? 'bg-yellow-600 hover:bg-yellow-700 text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                        >
                            {isGroupingMode ? 'Cancel Grouping' : 'Group Workouts'}
                        </button>
                        {isGroupingMode && (
                            <button
                                onClick={handleCreateGroupFromSelection}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
                            >
                                Create Group
                            </button>
                        )}
                        {isGroupingMode && (
                            <button
                                onClick={handleUngroupSelected}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
                            >
                                Ungroup
                            </button>
                        )}
                        {isGroupingMode && (
                            <button
                                onClick={handleAddSelectedToChosenGroup}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                            >
                                Add to Group…
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {deletingWorkoutId && (
                <ConfirmationDialog
                    message="Are you sure you want to delete this workout?"
                    onConfirm={handleDeleteWorkout}
                    onCancel={() => setDeletingWorkoutId(null)}
                />
            )}

            {/* Separate columns: left grouped, right ungrouped */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Grouped column */}
                <div className="space-y-4">
                    <div className="text-sm uppercase tracking-wide text-gray-500">Grouped</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {groups.map(group => {
                            const list = workoutsByGroupId[group.id] || [];
                            if (list.length === 0) return null;
                            const isCollapsed = collapsedGroupIds.has(group.id);
                            return (
                                <GroupCard
                                    key={group.id}
                                    group={group}
                                    workouts={list}
                                    isCollapsed={isCollapsed}
                                    onOpen={() => openEditGroupModal(group)}
                                    onToggleCollapse={() => toggleGroupCollapse(group.id)}
                                    renderWorkoutTile={(workout) => (
                                        <WorkoutTile
                                            key={workout.id}
                                            workout={workout}
                                            isActive={activeWorkoutId === workout.id}
                                            isSelected={isWorkoutSelected(workout.id)}
                                            isGroupingMode={isGroupingMode}
                                            onClick={(e) => { e.stopPropagation(); if (isGroupingMode) { toggleSelectWorkout(workout.id); } else { setEditingWorkout(workout); setWorkoutOptionsTab('overview'); } }}
                                        />
                                    )}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Ungrouped column */}
                <div className="space-y-4">
                    <div className="text-sm uppercase tracking-wide text-gray-500">Ungrouped</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {ungroupedWorkouts.map(workout => {
                            const isActive = activeWorkoutId === workout.id;
                            const isSelected = isWorkoutSelected(workout.id);
                            const ringClass = isSelected ? 'ring-2 ring-yellow-500' : (isActive ? 'ring-2 ring-green-500' : '');
                            return (
                                <div key={workout.id} className={`bg-gray-800 rounded-lg p-5 flex flex-col justify-between shadow-lg hover:shadow-indigo-500/30 transition-shadow relative ${ringClass}`} onClick={() => { if (isGroupingMode) { toggleSelectWorkout(workout.id); } else { setEditingWorkout(workout); setWorkoutOptionsTab('overview'); } }}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-grow cursor-pointer">
                                            <h2 className="text-xl font-bold mb-1 text-indigo-300">{workout.name}</h2>
                                            <p className="text-gray-400 mb-4 text-sm h-10 overflow-hidden">{workout.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-center mt-4">
                                        <p className="text-xs text-gray-500">{isGroupingMode ? 'Click to select' : 'Click for details'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            {editingWorkout && (
                <Modal title="Workout" onClose={() => setEditingWorkout(null)} maxWidthClass="max-w-2xl">
                    <div className="space-y-4">
                        <div className="flex gap-2 border-b border-gray-700 pb-2">
                            <button
                                className={`px-3 py-1 rounded ${workoutOptionsTab === 'overview' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'}`}
                                onClick={() => setWorkoutOptionsTab('overview')}
                            >
                                Overview
                            </button>
                            <button
                                className={`px-3 py-1 rounded ${workoutOptionsTab === 'edit' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'}`}
                                onClick={() => setWorkoutOptionsTab('edit')}
                            >
                                Edit Template
                            </button>
                            <button
                                className={`px-3 py-1 rounded ${workoutOptionsTab === 'options' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'}`}
                                onClick={() => setWorkoutOptionsTab('options')}
                            >
                                Options
                            </button>
                        </div>

                        {workoutOptionsTab === 'overview' && (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-sm text-gray-400">Workout</div>
                                        <div className="text-lg font-semibold text-white">{editingWorkout.name || 'Untitled'}</div>
                                        {editingWorkout.description ? (
                                            <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{editingWorkout.description}</p>
                                        ) : null}
                                        <div className="mt-3 text-sm text-gray-300">
                                            {lastWorkoutMeta ? (
                                                <div className="bg-gray-800/60 border border-gray-700 rounded p-2">
                                                    <div className="text-xs uppercase tracking-wide text-gray-500">Last done</div>
                                                    <div>
                                                        {lastWorkoutMeta.date ? lastWorkoutMeta.date.toLocaleDateString() : '—'}
                                                        {lastWorkoutMeta.workoutStartedAt && (
                                                            <>
                                                                <span className="ml-2">Start: {lastWorkoutMeta.workoutStartedAt.toLocaleTimeString()}</span>
                                                            </>
                                                        )}
                                                        {lastWorkoutMeta.workoutFinishedAt && (
                                                            <>
                                                                <span className="ml-2">End: {lastWorkoutMeta.workoutFinishedAt.toLocaleTimeString()}</span>
                                                            </>
                                                        )}
                                                        {typeof lastWorkoutMeta.durationSeconds === 'number' && (
                                                            <span className="ml-2">Duration: {Math.floor(lastWorkoutMeta.durationSeconds/60)}m {lastWorkoutMeta.durationSeconds%60}s</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-500">No history yet.</div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => { setEditingWorkout(null); navigate('log', { workoutId: editingWorkout.id }); }}
                                            className={`font-bold py-2 px-4 rounded-lg ${activeWorkoutId === editingWorkout.id ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                                        >
                                            {activeWorkoutId === editingWorkout.id ? 'Resume' : 'Start'}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-400 mb-2">Exercises</div>
                                    {/* computingWorkoutIds.has(editingWorkout.id) && (
                                        <div className="text-gray-500 text-sm">-loading-</div>
                                    ) */}
                                    <div className="space-y-2">
                                        {(Array.isArray(editingWorkout.exercises) ? editingWorkout.exercises : []).map((e, ei) => {
                                            const name = e?.name || `Exercise ${ei + 1}`;
                                            const setsArray = Array.isArray(e?.sets) ? e.sets : null;
                                            const fallbackSets = Number(e?.targetSets || e?.setsCount || 0) || 0;
                                            const fallbackReps = Number(e?.reps || e?.targetReps || 0) || 0;
                                            let label = name;
                                            if (setsArray && setsArray.length > 0) {
                                                const repsValues = setsArray.map(s => (s && s.reps != null && s.reps !== '') ? Number(s.reps) : null);
                                                const haveAll = repsValues.every(r => r !== null);
                                                if (haveAll) {
                                                    const first = repsValues[0];
                                                    const uniform = repsValues.every(r => r === first);
                                                    label = uniform ? `${name} — ${setsArray.length}x${first}` : `${name} — ${setsArray.length} sets: ${repsValues.map(r => r ?? '?').join(', ')}`;
                                                } else {
                                                    label = `${name} — ${setsArray.length} sets`;
                                                }
                                            } else if (fallbackSets) {
                                                label = fallbackReps ? `${name} — ${fallbackSets}x${fallbackReps}` : `${name} — ${fallbackSets} sets`;
                                            }
                                            return (
                                                <div key={ei} className="flex items-center justify-between bg-gray-800 rounded p-2">
                                                    <div className="text-gray-200">{label}</div>
                                                </div>
                                            );
                                        })}
                                        {(!editingWorkout.exercises || editingWorkout.exercises.length === 0) && (
                                            <div className="text-gray-500 text-sm">No exercises.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {workoutOptionsTab === 'edit' && (
                            <div className="space-y-4">
                                <div className="text-sm text-gray-400">Open the template editor for this workout.</div>
                                <button
                                    onClick={() => { setEditingWorkout(null); navigate('edit-template', { workoutId: editingWorkout.id }); }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                                >
                                    Edit Template
                                </button>
                            </div>
                        )}

                        {workoutOptionsTab === 'options' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="text-sm text-gray-300">Workout Export (copy as text)</div>
                                    <TextArea
                                        value={workoutExportText}
                                        onChange={(e) => setWorkoutExportText(e.target.value)}
                                        rows={6}
                                        placeholder="Export text will appear here..."
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={async () => { try { await navigator.clipboard.writeText(workoutExportText); showNotification('Export copied to clipboard.', 'success'); } catch { showNotification('Copy failed.', 'error'); } }}
                                            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => handleDuplicateWorkout(editingWorkout)}
                                        className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                                    >
                                        Duplicate
                                    </button>
                                    <button
                                        onClick={() => { setEditingWorkout(null); setDeletingWorkoutId(editingWorkout.id); }}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
            {editingGroup && (
                <GroupModal
                    open={!!editingGroup}
                    onClose={() => setEditingGroup(null)}
                    group={editingGroup}
                    groupOverview={groupOverview}
                    exportText={exportText}
                    editGroupName={editGroupName}
                    editGroupDescription={editGroupDescription}
                    editAiText={editAiText}
                    editAiSummaryText={editAiSummaryText}
                    groupOptionsTab={groupOptionsTab}
                    setGroupOptionsTab={setGroupOptionsTab}
                    setEditGroupName={setEditGroupName}
                    setEditGroupDescription={setEditGroupDescription}
                    setEditAiText={setEditAiText}
                    setEditAiSummaryText={setEditAiSummaryText}
                    onRegenerateAi={async () => {
                        const sourceText = (exportText || '').trim();
                        const text = await generateAiDescriptionForGroup(editingGroup, sourceText.length ? sourceText : null);
                        if (text) { setEditAiText(text); }
                    }}
                    onGenerateSummary={async () => {
                        try {
                            setIsGeneratingSummary(true);
                            const base = editAiText || editingGroup?.aiDescription || '';
                            const text = await generateAiSummaryFromDescription(base);
                            if (text) { setEditAiSummaryText(text); }
                        } finally {
                            setIsGeneratingSummary(false);
                        }
                    }}
                    generating={generatingGroupIds.has(editingGroup.id)}
                    isGeneratingSummary={isGeneratingSummary}
                    onSave={handleSaveEditedGroup}
                />
            )}
    </div>
  );
} 