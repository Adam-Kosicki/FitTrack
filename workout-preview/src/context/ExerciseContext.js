import React, { createContext, useState, useEffect, useContext } from 'react';
import { z } from 'zod';
import { collection, onSnapshot, query, addDoc, where, getDocs, doc, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { appId } from '../constants';
import { GoogleGenerativeAI } from '@google/generative-ai';
import GEMINI_API_KEY from '../firebase/gemini-api';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const getSystemPrompt = () => {
    return `You are a TAXONOMY LABELER for a strength-training exercise database.

Rules
- Use ONLY the options in the pick-lists below; never invent new terms.
- Choose exactly ONE value where a single pick is required.
- If genuinely uncertain about a field, output the JSON literal null (no quotes).
- Every array field may be empty ([]). Do NOT fill with the string "null".
- If 'mechanics' is 'Isolation' (single joint), 'movementPattern' **must be an empty array**; the string "Isolation" is never a valid pattern.
- Grip fallback: if a cable/rope attachment keeps the wrist neutral, use "Neutral"; reserve "Overhand" for pronated bars; many lower-body machines use "None".
- If two muscles tie for primary, pick the one initiating the concentric.
- Planes of motion: use Frontal for vertical presses, Sagittal for rows/pulldowns, Multi-planar for complex arcs like an Arnold Press.
- If more than one major joint moves through active ROM, mechanics must be 'Compound'.
- Return VALID, MINIFIED JSON matching the template—no comments, no extra keys.

### SIMPLE MUSCLE GROUPS (use for 'muscleGroup')
Back, Chest, Shoulders, Arms, Legs, Core

### DETAILED MUSCLE LIST (use for 'primaryMuscle', 'secondaryMuscle', 'musclesInvolved')
Abdominals, Abductors, Adductors, Biceps, Brachialis, Chest, Forearms, Front Delts, Gastrocnemius, Glutes, Hamstrings, Lats, Lower Back, Obliques, Quadriceps, Rear Delts, Rhomboids, Serratus Anterior, Side Delts, Soleus, Trapezius, Triceps

### MOVEMENT PATTERN LIST (array for 'movementPattern')
Vertical Press, Horizontal Press, Vertical Pull, Horizontal Pull, Squat, Lunge, Hip Hinge, Rotation, Carry

### JOINT ACTION LIST (array for 'jointAction')
Flexion, Extension, Abduction, Adduction, Plantarflexion

### FORCE TYPE (use for 'forceType')
Push, Pull, Hinge, Rotation, Carry, Static, Isometric

### GRIP (use for 'grip')
Overhand, Underhand, Neutral, Mixed, None

### PLANE OF MOTION (use for 'planeOfMotion')
Sagittal, Frontal, Transverse, Scapular, Multi-planar


Template
{
  "name": "<Exercise Name>",
  "masterData": {
    "muscleGroup": "<Simple Muscle Group>",
    "primaryMuscle": "<Detailed Muscle>",
    "secondaryMuscle": "<Detailed Muscle or null>",
    "musclesInvolved": ["<Primary>", "<Secondary if any>", "..."],
    "mechanics": "<Compound|Isolation>",
    "forceType": "<Force Type>",
    "movementPattern": ["<Movement Pattern(s)>"],
    "jointAction": ["<Joint Action(s) or empty array>"],
    "equipment": ["<All equipment required>"],
    "grip": "<Grip style or null>",
    "planeOfMotion": "<Plane of Motion>",
    "unilateral": "<true|false>",
    "tags": ["<e.g., plyometric, powerlifting, rehab, bodybuilding>"]
  }
}

Here are a few examples:

Example 1: User input "Arnold Press"
{
  "name": "Arnold Press",
  "masterData": {
    "muscleGroup": "Shoulders",
    "primaryMuscle": "Front Delts",
    "secondaryMuscle": "Side Delts",
    "musclesInvolved": ["Front Delts", "Side Delts", "Triceps", "Trapezius", "Serratus Anterior"],
    "mechanics": "Compound",
    "forceType": "Push",
    "movementPattern": ["Vertical Press", "Rotation"],
    "jointAction": ["Flexion", "Extension", "Abduction"],
    "equipment": ["Dumbbell", "Bench"],
    "grip": "Neutral",
    "planeOfMotion": "Multi-planar",
    "unilateral": false,
    "tags": ["bodybuilding"]
  }
}

Example 2: User input "Barbell Back Squat"
{
  "name": "Barbell Back Squat",
  "masterData": {
    "muscleGroup": "Legs",
    "primaryMuscle": "Quadriceps",
    "secondaryMuscle": "Glutes",
    "musclesInvolved": ["Quadriceps", "Glutes", "Hamstrings", "Adductors", "Lower Back"],
    "mechanics": "Compound",
    "forceType": "Push",
    "movementPattern": ["Squat"],
    "jointAction": ["Extension"],
    "equipment": ["Barbell", "Squat Rack"],
    "grip": "None",
    "planeOfMotion": "Sagittal",
    "unilateral": false,
    "tags": ["powerlifting", "bodybuilding"]
  }
}

Example 3: User input "EZ-bar Curl"
{
    "name": "EZ-bar Curl",
    "masterData": {
        "muscleGroup": "Arms",
        "primaryMuscle": "Biceps",
        "secondaryMuscle": "Brachialis",
        "musclesInvolved": ["Biceps", "Brachialis", "Forearms"],
        "mechanics": "Isolation",
        "forceType": "Pull",
        "movementPattern": [],
        "jointAction": ["Flexion"],
        "equipment": ["EZ-bar"],
        "grip": "Underhand",
        "planeOfMotion": "Sagittal",
        "unilateral": false,
        "tags": ["bodybuilding"]
    }
}`;
};

const getLogParserPrompt = (exerciseNames) => {
    return `You are a WORKOUT LOG PARSER for a strength-training app.

Your task is to extract workout data from a user's unstructured text and format it into a structured JSON array.

1.  **Analyze the Input**: Read the user's text, which contains a list of exercises with weights, reps, and sets.
2.  **Strip Prefixes**: Exercise lines often start with a prefix (e.g., "A.", "B1.", "C2."). You MUST remove this prefix to get the clean exercise name. For example, "C1. Seated DB Overhead Press" becomes "Seated DB Overhead Press".
3.  **Match Exercises**: Compare the clean exercise name to the provided list of existing exercises in the database: \`[${exerciseNames.join(', ')}]\`.
    *   If a clean name is an exact match or a very close synonym to one in the database, use the database name from the provided list.
    *   If an exercise is not in the database, use the clean name.
4.  **Extract Data**: For each exercise, identify the weight used and the reps performed for each set.
5.  **Detect Date**: Look for a date in the user's text. If a date is present, return it in "YYYY-MM-DD" format. If no date is found, return \`null\`.
6.  **Detect Failure**: Analyze the 'Notes' or 'Reps' column for keywords indicating a failed set, such as "(failed)", "failure", or "burnout". If found, set a "failed": true boolean for that set. Otherwise, set "failed": false.
7.  **Format Output**: Return a single, minified JSON object. Do not include any extra text, comments, or explanations.

**JSON Output Schema:**
{
  "date": "<YYYY-MM-DD or null>",
  "workout": [
    {
      "exerciseName": "<string>",
      "sets": [
        { "weight": <number>, "reps": <number>, "failed": <boolean> },
        ...
      ]
    },
    ...
  ]
}

**Example:**
User Input:
"C1. Seated DB Overhead Press
- Reps: 8, 6, 5 (failed)
B1. Seated Calf Raise Machine
- Weight: 90 lbs
- Reps: 12, 13, 10
(July 15)"

Database Exercises: \`["Seated DB Overhead Press", "Seated Calf Extension Machine"]\`

Expected Output:
{"date":"2024-07-15","workout":[{"exerciseName":"Seated DB Overhead Press","sets":[{"weight":0,"reps":8,"failed":false},{"weight":0,"reps":6,"failed":false},{"weight":0,"reps":5,"failed":true}]},{"exerciseName":"Seated Calf Extension Machine","sets":[{"weight":90,"reps":12,"failed":false},{"weight":90,"reps":13,"failed":false},{"weight":90,"reps":10,"failed":false}]}]}`;
};


const normalizeAiData = (data) => {
    if (data.masterData.mechanics === "Isolation") {
        data.masterData.movementPattern = [];
    }

    if (data.masterData.equipment) {
        const equipmentMap = {
            "lat-pulldown machine": "Lat Pulldown Machine",
            "pec deck": "Pec Deck Machine",
            "rope": "Rope Attachment",
        };
        data.masterData.equipment = data.masterData.equipment.map(item => equipmentMap[item.toLowerCase()] || item);
    }
    
    return data;
};

// Zod schemas for AI and log parsing validation
const VariantMetaSchema = z.object({
    isometric: z.boolean().optional().nullable(),
    legMode: z.enum(['single','double','alternating']).optional().nullable(),
    armMode: z.enum(['single','double','alternating']).optional().nullable(),
    unilateral: z.boolean().optional().nullable(),
    isAngled: z.boolean().optional().nullable(),
    angleDeg: z.number().optional().nullable(),
    equipment: z.string().optional().nullable(),
    equipmentSubType: z.string().optional().nullable(),
    angleRange: z.any().optional().nullable()
});
const VariantPresetSchema = z.object({
    label: z.string(),
    variantMeta: VariantMetaSchema
});
const MasterDataSchema = z.object({
    muscleGroup: z.string(),
    primaryMuscle: z.string(),
    secondaryMuscle: z.string().nullable(),
    musclesInvolved: z.array(z.string()),
    mechanics: z.enum(['Compound', 'Isolation']),
    forceType: z.string(),
    movementPattern: z.array(z.string()),
    jointAction: z.array(z.string()),
    equipment: z.array(z.string()).optional(),
    grip: z.string().nullable().optional(),
    planeOfMotion: z.string(),
    unilateral: z.boolean(),
    tags: z.array(z.string())
});

const ExerciseAISchema = z.object({
    name: z.string(),
    masterData: MasterDataSchema,
    variantPresets: z.array(z.object({
        label: z.string(),
        variantMeta: VariantMetaSchema
    })).optional()
});

const WorkoutLogParseSchema = z.object({
    date: z.string().nullable(),
    workout: z.array(z.object({
        exerciseName: z.string(),
        sets: z.array(z.object({
            weight: z.number(),
            reps: z.number(),
            failed: z.boolean()
        }))
    }))
});

export { ExerciseAISchema, WorkoutLogParseSchema };
const ExerciseContext = createContext();

export const useExercises = () => useContext(ExerciseContext);

export const ExerciseProvider = ({ children, userId }) => {
    const [exercises, setExercises] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setExercises([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const exercisesRef = collection(db, `artifacts/${appId}/users/${userId}/exercises`);
        const q = query(exercisesRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const exercisesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            exercisesData.sort((a, b) => a.name.localeCompare(b.name));
            setExercises(exercisesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching user exercises:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);
    
    const generateExerciseDetails = async (prompt) => {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", generationConfig: { temperature: 0.1 } });
        const systemPrompt = getSystemPrompt();
        const variantRules = `\n\nAdditionally, provide an array 'variantPresets' where each item has {label, variantMeta}.\nConstraints:\n- For upper-body (Chest/Back/Shoulders/Arms): include armMode (single/double/alternating). Do NOT include legMode.\n- For lower-body (Legs): include legMode (single/double/alternating). Do NOT include armMode.\n- isAngled true must include angleDeg; false means flat. No ranges.\n- Equipment subtype: use the most specific tool (e.g., Preacher curl machine, Hack Squat Machine).\n- Enforce logical combinations (e.g., Bench Press: flat=0°, incline=30/45/60°, decline=-15; no 60° on "flat" barbell bench).\n- Pre-generate 3–8 sensible presets per exercise base (e.g., Bench Press: Flat BB, Flat DB, Incline 30° DB, Incline 45° BB, Decline BB; Lateral Raise: DB, Cable).\n- Keep labels concise (e.g., 'DB 30°', 'BB Flat', 'Cable', 'Single-leg').\n- Return valid JSON; place variantPresets at top-level next to masterData.`;
        const result = await model.generateContent([systemPrompt + variantRules, `Now, fulfill this request for the exercise named: "${prompt}"`]);
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
        const systemPrompt = `You are a BULK EXERCISE PARSER for a strength-training app.\n\nTask: Extract a clean list of exercises from the user's pasted text.\n- Each exercise should become one object with: name (string), notes (string), isIsometric (boolean).\n- Ignore sets/reps counts beyond copying them into the notes string verbatim.\n- If the exercise is an isometric hold or the notes clearly indicate isometrics (e.g., 'hold', 'isometric', 'accumulate time'), set isIsometric: true. Otherwise false.\n- Preserve any instructional sentences as notes.\n- DO NOT invent fields not requested.\n- Return a MINIFIED JSON array only, no commentary.\n\nExamples input snippet:\nSingle-leg Leg Extension (60°) — 5 x 30–45s holds. Choose a load that is near failure by end of set.\nSpanish Squat (60–90°) — 5 x 30–45s holds, torso upright.\n\nExpected output (minified):\n[{"name":"Single-leg Leg Extension (60°)","notes":"5 x 30–45s holds. Choose a load that is near failure by end of set.","isIsometric":true},{"name":"Spanish Squat (60–90°)","notes":"5 x 30–45s holds, torso upright.","isIsometric":true}]`;
        const result = await model.generateContent([systemPrompt, `Here is the list to parse:\n\n${bulkText}`]);
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

    // Derive structured variant metadata from an exercise name and masterData
    const deriveVariantMeta = (name, masterData = {}) => {
        const raw = String(name || '').toLowerCase();
        const tags = (masterData.tags || []).map(t => String(t).toLowerCase());
        const forceType = String(masterData.forceType || '').toLowerCase();
        const muscleGroup = String(masterData.muscleGroup || '').toLowerCase();
        const movementPatterns = (masterData.movementPattern || []).map(s => String(s).toLowerCase());

        const isometric = raw.startsWith('iso ') || raw.includes(' isometric') || forceType === 'static' || tags.includes('isometric');
        // Leg mode inference (single/double/alternating) — only for lower body
        let legMode = null;
        if (muscleGroup === 'legs') {
            if (/alternate\s*-?leg|alternating/.test(raw)) legMode = 'alternating';
            if (/single\s*-?leg/.test(raw)) legMode = 'single';
            if (/double\s*-?leg/.test(raw)) legMode = 'double';
            if (!legMode) {
                if (movementPatterns.includes('lunge') || raw.includes('split squat')) legMode = 'single';
                else if (movementPatterns.includes('squat')) legMode = 'double';
            }
        }
        // Arm mode inference (single/double/alternating) — for upper body
        let armMode = null;
        if (muscleGroup === 'chest' || muscleGroup === 'back' || muscleGroup === 'shoulders' || muscleGroup === 'arms' || muscleGroup === 'core') {
            if (/single\s*-?arm|one\s*-?arm/.test(raw)) armMode = 'single';
            else if (/alternating|alternate\s*-?arm/.test(raw)) armMode = 'alternating';
            else armMode = 'double';
        }
        // unified unilateral flag: single limb (arm or leg)
        const unilateral = legMode === 'single' || armMode === 'single' || Boolean(masterData.unilateral && muscleGroup === 'legs');

        // angle parsing like (30°) or (60–90°)
        let angleDeg = null;
        const angleSingle = raw.match(/\((\d{1,3})°\)/);
        if (angleSingle) {
            angleDeg = Number(angleSingle[1]);
        }
        const isAngled = typeof angleDeg === 'number';

        // equipment primary group
        const eqList = (masterData.equipment || []).map(e => String(e).toLowerCase());
        // preserve most specific subtype for labeling
        const equipmentSubType = eqList[0] || null;
        const equipment = (() => {
            if (eqList.some(e => e.includes('dumbbell'))) return 'dumbbell';
            if (eqList.some(e => e.includes('barbell'))) return 'barbell';
            if (eqList.some(e => e.includes('cable'))) return 'cable';
            if (eqList.some(e => e.includes('machine'))) return 'machine';
            if (eqList.some(e => e === 'none' || e === 'bodyweight')) return 'bodyweight';
            return eqList[0] || null;
        })();

        return { isometric, legMode, armMode, unilateral, isAngled, angleDeg, equipment, equipmentSubType };
    };

    const buildVariantKey = (baseName, variantMeta) => {
        const slug = (s) => String(s || '')
            .toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        const v = variantMeta || {};
        return [
            slug(baseName || ''),
            `iso:${!!v.isometric}`,
            `leg:${v.legMode || ''}`,
            `arm:${v.armMode || ''}`,
            `uni:${!!v.unilateral}`,
            `angled:${!!v.isAngled}`,
            `angle:${v.angleDeg ?? ''}`,
            `equip:${String(v.equipment || '')}`
        ].join('|');
    };

    const makeDisplayNameFrom = (name, baseName, masterData = {}) => {
        if (baseName) return baseName;
        let n = String(name || '').trim();
        // Remove parenthetical qualifiers
        n = n.replace(/\([^)]*\)/g, '').trim();
        // Remove common qualifiers
        const removeTokens = [
            'smith machine','machine','db','dumbbell','dumbbells','bb','barbell','ez bar','ez-bar','cable','band',
            'seated','standing','lying','neutral-grip','close-grip','wide-grip','incline','decline',
            'single-leg','single leg','double-leg','double leg','alternate-leg','alternate leg','alternating',
            'iso','isometric','rear foot elevated','rear-foot-elevated','rfe'
        ];
        let lowered = n.toLowerCase();
        removeTokens.forEach(tok => { lowered = lowered.replace(new RegExp(`(^|\\s)${tok}(\\s|$)`, 'g'), ' '); });
        lowered = lowered.replace(/\s+/g, ' ').trim();
        // Normalizations
        lowered = lowered.replace(/lat-?pulldown/g, 'lat pulldown');
        lowered = lowered.replace(/t-?bar row/g, 't-bar row');
        lowered = lowered.replace(/pull-?up(s)?/g, 'pull-ups');
        lowered = lowered.replace(/pogos?/g, 'pogos');
        lowered = lowered.replace(/wall\s*sit(s)?/g, 'wall sit');
        // Title case
        const title = lowered.replace(/\b\w/g, c => c.toUpperCase());
        return title || name;
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

            if (docId) { // It's an update (partial, preserve notes/history unless explicitly provided)
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/exercises`, docId);
                const updateFields = {};
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'name')) updateFields.name = dataToSave.name;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'masterData')) updateFields.masterData = dataToSave.masterData;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'baseName')) updateFields.baseName = dataToSave.baseName || null;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'groupKey')) updateFields.groupKey = dataToSave.groupKey || null;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'notes')) updateFields.notes = dataToSave.notes; // only if provided
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'variantMeta')) updateFields.variantMeta = dataToSave.variantMeta || null;
                if (Object.prototype.hasOwnProperty.call(dataToSave, 'displayName')) updateFields.displayName = dataToSave.displayName || null;
                // Target fields (allow direct editing from UI)
                ['targetSets','targetReps','targetRepRange','targetWeight','targetRPE'].forEach(k => {
                    if (Object.prototype.hasOwnProperty.call(dataToSave, k)) updateFields[k] = dataToSave[k];
                });
                if (Object.keys(updateFields).length > 0) {
                    await updateDoc(docRef, updateFields);
                }
            } else { // It's a new exercise
                const q = query(exercisesRef, where("name", "==", dataToSave.name), limit(1));
                const existing = await getDocs(q);
                if (!existing.empty) {
                    const docRef = existing.docs[0].ref;
                    await updateDoc(docRef, dataToSave);
                } else {
                    await addDoc(exercisesRef, {
                        ...dataToSave,
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
                await updateDoc(exerciseDocRef, updatedExerciseData);
            } else {
                // If no records are left, clear the last performance fields
                await updateDoc(exerciseDocRef, {
                    lastPerformed: null,
                    lastVolume: null,
                    lastSets: null,
                    lastReps: [],
                    lastSetsData: []
                });
            }
        } catch (error) {
            console.error("Error updating exercise after history deletion:", error);
            // Optionally show a notification
        }
    };

    const value = {
        masterList: exercises,
        loading,
        handleSaveExercise,
        updateExerciseSummaryFromHistory,
        generateExerciseDetails,
        parseWorkoutLog,
        parseBulkExercises,
        deriveVariantMeta,
        buildVariantKey,
        migrateAndSyncExercises: async () => {
            if (!userId) return;
            try {
                const updates = exercises.map(async (ex) => {
                    const currentMeta = ex.variantMeta || null;
                    const nextMetaRaw = deriveVariantMeta(ex.name, ex.masterData || {});
                    // Remove angleRange from legacy data during migration
                    const nextMeta = { ...nextMetaRaw, angleRange: null };
                    const nextDisplay = ex.displayName || makeDisplayNameFrom(ex.name, ex.baseName, ex.masterData || {});
                    const payload = {};
                    if (JSON.stringify(currentMeta) !== JSON.stringify(nextMeta)) payload.variantMeta = nextMeta;
                    if (ex.displayName !== nextDisplay) payload.displayName = nextDisplay;
                    // Backfill variant presets if missing: call AI for this base name once per exercise
                    if (!Array.isArray(ex.variantPresets) || ex.variantPresets.length === 0) {
                        try {
                            const ai = await generateExerciseDetails(ex.baseName || ex.name);
                            if (Array.isArray(ai.variantPresets) && ai.variantPresets.length > 0) {
                                payload.variantPresets = ai.variantPresets;
                            }
                        } catch (e) {
                            // best-effort; skip on failure
                        }
                    }
                    if (Object.keys(payload).length === 0) return null;
                    const ref = doc(db, `artifacts/${appId}/users/${userId}/exercises`, ex.id);
                    await updateDoc(ref, payload);
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