import React, { createContext, useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, addDoc, where, getDocs, doc, orderBy, limit, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { appId } from '../constants';
import genAI from '../lib/gemini';
import { ExerciseAISchema, WorkoutLogParseSchema } from '../lib/schemas';
import { getSystemPrompt, VARIANT_RULES, getLogParserPrompt, BULK_PARSER_PROMPT } from '../lib/prompts';
import { normalizeAiData, deriveVariantMeta, buildVariantKey, makeDisplayNameFrom, extractBaseName } from '../lib/exerciseUtils';
import userCustomSeed from '../data/userCustomExercisesSeed.json';

export { ExerciseAISchema, WorkoutLogParseSchema };
const ExerciseContext = createContext();

export const useExercises = () => useContext(ExerciseContext);

let cachedSampleDb = null;

export const ExerciseProvider = ({ children, userId }) => {
    const [userExercises, setUserExercises] = useState([]);
    const [sampleExercises, setSampleExercises] = useState([]);
    const [isSampleDbLoading, setIsSampleDbLoading] = useState(false);
    const [isSampleDbLoaded, setIsSampleDbLoaded] = useState(false);
    const [loading, setLoading] = useState(true);

    const ensureSampleDbLoaded = async () => {
        if (cachedSampleDb) {
            if (!isSampleDbLoaded) {
                setSampleExercises(cachedSampleDb);
                setIsSampleDbLoaded(true);
            }
            return cachedSampleDb;
        }
        if (isSampleDbLoading) return;
        setIsSampleDbLoading(true);
        try {
            const module = await import('../data/sample_db_v2.9.json');
            const data = module.default || module;
            cachedSampleDb = data.map(sampleEx => {
                const baseName = extractBaseName(sampleEx.name);
                const groupKey = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return {
                    ...sampleEx,
                    baseName,
                    groupKey,
                    isCustom: false,
                    source: 'sample_db'
                };
            });
            setSampleExercises(cachedSampleDb);
            setIsSampleDbLoaded(true);
            return cachedSampleDb;
        } catch (err) {
            console.error('Failed to lazy load sample_db_v2.9.json:', err);
        } finally {
            setIsSampleDbLoading(false);
        }
    };

    useEffect(() => {
        if (!userId) {
            setUserExercises([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const exercisesRef = collection(db, `artifacts/${appId}/users/${userId}/exercises`);
        const q = query(exercisesRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userDocs = snapshot.docs.map(doc => {
                const data = doc.data();
                const baseName = extractBaseName(data.name);
                const groupKey = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const isSample = data.isCustom === false || data.source === 'sample_db' || data.source === 'system_preset' || doc.id.startsWith('sample_preset_');
                return {
                    ...data,
                    baseName,
                    groupKey,
                    id: doc.id,
                    isCustom: !isSample,
                    source: isSample ? 'sample_db' : (data.source || 'user')
                };
            });
            userDocs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setUserExercises(userDocs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching user exercises:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const [loggedExercisesFromHistory, setLoggedExercisesFromHistory] = useState([]);

    useEffect(() => {
        if (!userId) {
            setLoggedExercisesFromHistory([]);
            return;
        }
        const logsRef = collection(db, `artifacts/${appId}/users/${userId}/workoutLogs`);
        const qLogs = query(logsRef);

        const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
            const historyMap = new Map();
            snapshot.docs.forEach(doc => {
                const log = doc.data();
                const logDate = log.date;
                (log.exercises || []).forEach(ex => {
                    if (!ex.name || !ex.sets || ex.sets.length === 0) return;
                    const key = ex.name.trim().toLowerCase();
                    const existing = historyMap.get(key);
                    const totalVolume = ex.sets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
                    const totalSets = ex.sets.length;
                    const repsPerSet = ex.sets.map(s => Number(s.reps) || 0);

                    if (!existing || (logDate && logDate.seconds > (existing.lastPerformed?.seconds || 0))) {
                        const baseName = extractBaseName(ex.name);
                        historyMap.set(key, {
                            id: `history_${key.replace(/[^a-z0-9]+/g, '_')}`,
                            name: ex.name,
                            baseName,
                            groupKey: baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                            lastPerformed: logDate,
                            lastVolume: totalVolume,
                            lastSets: totalSets,
                            lastReps: repsPerSet,
                            notes: ex.notes || '',
                            lastSessionNote: ex.sessionNote || '',
                            isCustom: true,
                            source: 'user'
                        });
                    }
                });
            });
            setLoggedExercisesFromHistory(Array.from(historyMap.values()));
        }, (err) => {
            console.error("Error in real-time workout log exercise sync listener:", err);
        });

        return () => unsubscribeLogs();
    }, [userId]);

    const exercises = React.useMemo(() => {
        const combinedMap = new Map();
        // 1. Add sample DB local exercises (3,242 items)
        sampleExercises.forEach(sampleEx => {
            const key = (sampleEx.name || '').trim().toLowerCase();
            const baseName = extractBaseName(sampleEx.name);
            const groupKey = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            combinedMap.set(key, {
                ...sampleEx,
                baseName,
                groupKey,
                isCustom: false,
                source: 'sample_db'
            });
        });

        // 2. Merge real-time logged exercises derived from workout logs
        loggedExercisesFromHistory.forEach(logEx => {
            const key = (logEx.name || '').trim().toLowerCase();
            const userKey = `user:${key}`;
            const existingSample = combinedMap.get(key);
            if (existingSample) {
                combinedMap.set(key, {
                    ...existingSample,
                    ...logEx,
                    isCustom: false,
                    source: 'sample_db'
                });
            } else {
                combinedMap.set(userKey, logEx);
            }
        });

        // 3. Process user exercises from Firestore exercises collection
        userExercises.forEach(userEx => {
            const key = (userEx.name || '').trim().toLowerCase();
            const baseName = extractBaseName(userEx.name);
            const groupKey = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const isSample = userEx.isCustom === false || userEx.source === 'sample_db' || userEx.source === 'system_preset' || String(userEx.id || '').startsWith('sample_preset_');
            
            if (isSample) {
                // If it's a sample DB item in Firestore, merge with local sample DB entry (key by name)
                const existing = combinedMap.get(key) || {};
                combinedMap.set(key, {
                    ...existing,
                    ...userEx,
                    baseName,
                    groupKey,
                    isCustom: false,
                    source: 'sample_db'
                });
            } else {
                // True user-created custom exercise
                const userKey = `user:${userEx.id || key}`;
                combinedMap.set(userKey, {
                    ...userEx,
                    baseName,
                    groupKey,
                    isCustom: true,
                    source: userEx.source || 'user'
                });
            }
        });

        const all = Array.from(combinedMap.values());
        all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return all;
    }, [userExercises, sampleExercises, loggedExercisesFromHistory]);
    
    const generateExerciseDetails = async (prompt) => {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { temperature: 0.1 } });
        const systemPrompt = getSystemPrompt();
        const result = await model.generateContent([systemPrompt + VARIANT_RULES, `Now, fulfill this request for the exercise named: "${prompt}"`]);
        const response = await result.response;
        const text = await response.text();
        const cleanedJsonResponse = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanedJsonResponse);
        const safe = ExerciseAISchema.safeParse(parsedData);
        if (!safe.success) {
            console.error('AI exercise schema validation failed:', safe.error);
            throw new Error('Invalid AI exercise data');
        }
        const normalized = normalizeAiData(safe.data);
        // Attach derived variantMeta for the base and carry variantPresets through (if present)
        const baseVariant = deriveVariantMeta(normalized.name, normalized.masterData || {});
        return { ...normalized, variantMeta: baseVariant, variantPresets: Array.isArray(parsedData.variantPresets) ? parsedData.variantPresets : [] };
    };

    // Parse a bulk free-text list of exercises into [{ name, notes, isIsometric }]
    const parseBulkExercises = async (bulkText) => {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", generationConfig: { temperature: 0.0 } });
        const result = await model.generateContent([BULK_PARSER_PROMPT, `Here is the list to parse:\n\n${bulkText}`]);
        const response = await result.response;
        const text = await response.text();
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) throw new Error('Expected an array from bulk parser');
        return parsed.map(item => ({
            name: String(item.name || '').trim(),
            notes: String(item.notes || '').trim(),
            isIsometric: Boolean(item.isIsometric)
        })).filter(it => it.name);
    };

    const parseWorkoutLog = async (logText, existingExerciseNames) => {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", generationConfig: { temperature: 0.0 } });
        const systemPrompt = getLogParserPrompt(existingExerciseNames);
        const result = await model.generateContent([systemPrompt, `Here is the workout log to parse:\n\n${logText}`]);
        const response = await result.response;
        const text = response.text();

        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const jsonString = text.substring(startIndex, endIndex + 1);
            try {
                const parsed = JSON.parse(jsonString);
                const safe = WorkoutLogParseSchema.safeParse(parsed);
                if (!safe.success) {
                    console.error('Workout log schema validation failed:', safe.error);
                    throw new Error('Invalid workout log JSON');
                }
                return safe.data;
            } catch (e) {
                console.error("Failed to parse/validate extracted JSON:", e, "Raw string:", jsonString);
                throw new Error("Received malformed JSON from the AI.");
            }
        }
        
        console.error("No valid JSON object found in AI response. Raw text:", text);
        throw new Error("Could not find a valid JSON object in the AI's response.");
    };

    const handleSaveExercise = async (exerciseData) => {
        try {
            const exercisesRef = collection(db, `artifacts/${appId}/users/${userId}/exercises`);
            
            let dataToSave = exerciseData;
            let docId = exerciseData.id;
            
            // The AI returns a slightly different structure, so we standardize it here.
            if (dataToSave.masterData && !dataToSave.name) {
                dataToSave.name = exerciseData.name;
            }

            // Enforce mutual exclusivity on variantMeta before save
            if (dataToSave.variantMeta) {
                const vm = { ...dataToSave.variantMeta };
                if (vm.legMode && vm.armMode) {
                    if ((dataToSave.masterData?.muscleGroup || '').toLowerCase() === 'legs') {
                        vm.armMode = null;
                    } else {
                        vm.legMode = null;
                    }
                }
                vm.unilateral = vm.legMode === 'single' || vm.armMode === 'single' || Boolean(dataToSave.masterData?.unilateral && (dataToSave.masterData?.muscleGroup || '').toLowerCase() === 'legs');
                if (!vm.isAngled) vm.angleDeg = null;
                dataToSave.variantMeta = vm;
            }

            if (docId) { // It's an update or save (partial, preserve notes/history unless explicitly provided)
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/exercises`, docId);
                const updateFields = {};
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'name')) updateFields.name = dataToSave.name;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'masterData')) updateFields.masterData = dataToSave.masterData;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'baseName')) updateFields.baseName = dataToSave.baseName || null;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'groupKey')) updateFields.groupKey = dataToSave.groupKey || null;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'notes')) updateFields.notes = dataToSave.notes; // only if provided
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'variantMeta')) updateFields.variantMeta = dataToSave.variantMeta || null;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'displayName')) updateFields.displayName = dataToSave.displayName || null;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'isCustom')) updateFields.isCustom = dataToSave.isCustom;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'source')) updateFields.source = dataToSave.source;
                // Target fields (allow direct editing from UI)
                ['targetSets','targetReps','targetRepRange','targetWeight','targetRPE'].forEach(k => {
                    if (Object.prototype.hasOwnProperty.call(dataToSave, k)) updateFields[k] = dataToSave[k];
                });
                if (Object.keys(updateFields).length > 0) {
                    await setDoc(docRef, updateFields, { merge: true });
                }
            } else { // It's a new exercise
                const q = query(exercisesRef, where("name", "==", dataToSave.name), limit(1));
                const existing = await getDocs(q);
                if (!existing.empty) {
                    const docRef = existing.docs[0].ref;
                    await setDoc(docRef, dataToSave, { merge: true });
                } else {
                    await addDoc(exercisesRef, {
                        ...dataToSave,
                        isCustom: dataToSave.isCustom !== undefined ? dataToSave.isCustom : (dataToSave.source === 'sample_db' || dataToSave.source === 'system_preset' ? false : true),
                        source: dataToSave.source || (dataToSave.isCustom === false ? 'sample_db' : 'user'),
                        baseName: dataToSave.baseName || null,
                        groupKey: dataToSave.groupKey || null,
                        variantMeta: dataToSave.variantMeta || null,
                        displayName: dataToSave.displayName || makeDisplayNameFrom(dataToSave.name, dataToSave.baseName, dataToSave.masterData)
                    });
                }
            }
        } catch (error) {
            console.error("Error saving exercise:", error);
        }
    };

    const updateExerciseSummaryFromHistory = async (exerciseId) => {
        if (!userId || !exerciseId) return;

        try {
            // Find the new most recent performance record for this exercise
            const historyRef = collection(db, 'performanceHistory');
            const q = query(
                historyRef,
                where('userId', '==', userId),
                where('exerciseId', '==', exerciseId),
                orderBy('date', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(q);

            const exerciseDocRef = doc(db, `artifacts/${appId}/users/${userId}/exercises`, exerciseId);

            if (!snapshot.empty) {
                // If there's a new "latest" record, update the exercise
                const latestRecord = snapshot.docs[0].data();
                const repsArray = Array.isArray(latestRecord.sets) ? latestRecord.sets.map(s => Number(s.reps) || 0) : [];
                const repMin = repsArray.length ? Math.min(...repsArray) : null;
                const repMax = repsArray.length ? Math.max(...repsArray) : null;
                const updatedExerciseData = {
                    lastPerformed: latestRecord.date,
                    lastVolume: latestRecord.volume,
                    lastSets: latestRecord.sets.length,
                    lastReps: repsArray,
                    lastSetsData: latestRecord.sets.map(s => ({
                        weight: s.weight,
                        reps: s.reps,
                        failed: s.failed || false,
                        volume: (Number(s.weight) || 0) * (Number(s.reps) || 0),
                        setDuration: s.setDuration || 0,
                        restDuration: s.restDuration || 0
                    })),
                    // Targets (defaults retained if already present)
                    targetSets: 3,
                    targetReps: 10,
                    targetRepRange: [8, 12],
                    targetWeight: Number((latestRecord.sets && latestRecord.sets[0]?.weight) || 0),
                    // Historical range derived from latest record (placeholder until multi-session aggregation implemented)
                    historicalRepRange: (repMin !== null && repMax !== null) ? [repMin, repMax] : null
                };
                await setDoc(exerciseDocRef, updatedExerciseData, { merge: true });
            } else {
                // If no records are left, clear the last performance fields
                await setDoc(exerciseDocRef, {
                    lastPerformed: null,
                    lastVolume: null,
                    lastSets: null,
                    lastReps: [],
                    lastSetsData: []
                }, { merge: true });
            }
        } catch (error) {
            console.error("Error updating exercise after history deletion:", error);
            // Optionally show a notification
        }
    };

    const purgeAndResetUserCustomExercises = async () => {
        if (!userId) return;

        // 1. Fetch user's performanceHistory logs
        const historyRef = collection(db, 'performanceHistory');
        const historyQuery = query(historyRef, where('userId', '==', userId));
        const historySnap = await getDocs(historyQuery);

        // Map unique exercise names to latest log stats
        const loggedExercisesMap = new Map();

        historySnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const exName = data.exerciseName || data.exercise || data.name;
            if (!exName) return;

            const key = exName.trim().toLowerCase();
            if (!loggedExercisesMap.has(key)) {
                loggedExercisesMap.set(key, {
                    name: exName.trim(),
                    lastPerformed: data.date || null,
                    lastVolume: data.volume || null,
                    lastSets: Array.isArray(data.sets) ? data.sets.length : null,
                    lastSetsData: Array.isArray(data.sets) ? data.sets : [],
                    notes: data.notes || '',
                    masterData: data.masterData || {}
                });
            }
        });

        // 2. Fetch current Firestore exercises collection and purge all existing user exercise docs
        const exercisesRef = collection(db, `artifacts/${appId}/users/${userId}/exercises`);
        const exercisesSnap = await getDocs(exercisesRef);

        const docsToDelete = exercisesSnap.docs;
        const chunkSize = 400;
        for (let i = 0; i < docsToDelete.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = docsToDelete.slice(i, i + chunkSize);
            chunk.forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
        }

        // 3. Match against userCustomSeed for masterData enrichment if applicable
        const seedMap = new Map(userCustomSeed.map(ex => [(ex.name || '').trim().toLowerCase(), ex]));

        // 4. Re-create ONLY the exercises found in the user's workout logs
        const loggedExerciseEntries = Array.from(loggedExercisesMap.values()).map(logged => {
            const key = logged.name.toLowerCase();
            const seedMatch = seedMap.get(key);
            return {
                ...(seedMatch || {}),
                name: logged.name,
                lastPerformed: logged.lastPerformed || seedMatch?.lastPerformed || null,
                lastVolume: logged.lastVolume || seedMatch?.lastVolume || null,
                lastSets: logged.lastSets || seedMatch?.lastSets || null,
                lastSetsData: logged.lastSetsData.length ? logged.lastSetsData : (seedMatch?.lastSetsData || []),
                notes: logged.notes || seedMatch?.notes || '',
                masterData: (logged.masterData && Object.keys(logged.masterData).length) ? logged.masterData : (seedMatch?.masterData || {}),
                isCustom: true,
                source: 'user'
            };
        });

        const savePromises = loggedExerciseEntries.map(ex => {
            const { id, ...exerciseToSave } = ex;
            return handleSaveExercise(exerciseToSave);
        });
        await Promise.all(savePromises);
    };

    const value = {
        masterList: exercises,
        loading,
        ensureSampleDbLoaded,
        isSampleDbLoading,
        isSampleDbLoaded,
        handleSaveExercise,
        updateExerciseSummaryFromHistory,
        generateExerciseDetails,
        parseWorkoutLog,
        parseBulkExercises,
        deriveVariantMeta,
        buildVariantKey,
        purgeAndResetUserCustomExercises,
        migrateAndSyncExercises: async () => {
            if (!userId) return;
            try {
                const updates = exercises.map(async (ex) => {
                    if (ex.isCustom === false || ex.source === 'sample_db' || (ex.id && String(ex.id).includes('sample_preset'))) {
                        return null;
                    }
                    const currentMeta = ex.variantMeta || null;
                    const nextMetaRaw = deriveVariantMeta(ex.name, ex.masterData || {});
                    const nextMeta = { ...nextMetaRaw, angleRange: null };
                    const nextDisplay = ex.displayName || makeDisplayNameFrom(ex.name, ex.baseName, ex.masterData || {});
                    const payload = {};
                    if (JSON.stringify(currentMeta) !== JSON.stringify(nextMeta)) payload.variantMeta = nextMeta;
                    if (ex.displayName !== nextDisplay) payload.displayName = nextDisplay;
                    if (Object.keys(payload).length === 0) return null;
                    const ref = doc(db, `artifacts/${appId}/users/${userId}/exercises`, ex.id);
                    await setDoc(ref, payload, { merge: true });
                    return ex.id;
                });
                await Promise.all(updates);
            } catch (e) {
                console.error('migrateAndSyncExercises failed', e);
            }
        }
    };

    return (
        <ExerciseContext.Provider value={value}>
            {children}
        </ExerciseContext.Provider>
    );
}; 