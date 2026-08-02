// Real-time Dev Telemetry Client
// Automatically streams console logs, errors, exercise database state, and workout logs
// to local workspace directory (.dev-telemetry/) for instant AI agent inspection.

const TELEMETRY_URL = 'http://localhost:3001/api/telemetry';
const capturedLogs = [];

function postTelemetry(type, payload) {
    if (process.env.NODE_ENV === 'production') return;
    setTimeout(async () => {
        try {
            await fetch(TELEMETRY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, payload })
            });
        } catch (e) {
            // Silently ignore if telemetry server is offline
        }
    }, 0);
}

export function initConsoleTelemetry() {
    if (window.__TELEMETRY_INITIATED__) return;
    window.__TELEMETRY_INITIATED__ = true;

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const pushLog = (level, args) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        capturedLogs.push({ time: new Date().toISOString(), level, msg });
        if (capturedLogs.length > 100) capturedLogs.shift();
        
        postTelemetry('console', {
            recentLogs: capturedLogs,
            latestLog: { level, msg, time: new Date().toISOString() }
        });
    };

    console.log = (...args) => {
        originalLog(...args);
        pushLog('info', args);
    };

    console.error = (...args) => {
        originalError(...args);
        pushLog('error', args);
    };

    console.warn = (...args) => {
        originalWarn(...args);
        pushLog('warn', args);
    };
}

let lastExerciseDbHash = '';
export function syncExerciseDbTelemetry(exercises = [], filters = {}) {
    if (!Array.isArray(exercises) || exercises.length === 0) return;
    const currentHash = `${exercises.length}_${JSON.stringify(filters)}`;
    if (currentHash === lastExerciseDbHash) return;
    lastExerciseDbHash = currentHash;

    const muscleGroups = Array.from(new Set(exercises.map(e => e.masterData?.muscleGroup).filter(Boolean))).sort();
    const tags = Array.from(new Set(exercises.flatMap(e => e.masterData?.tags || []).filter(Boolean))).sort();
    const mechanics = Array.from(new Set(exercises.map(e => e.masterData?.mechanics).filter(Boolean))).sort();
    const forceTypes = Array.from(new Set(exercises.map(e => e.masterData?.forceType).filter(Boolean))).sort();
    const equipment = Array.from(new Set(exercises.flatMap(e => e.masterData?.equipment || []).filter(Boolean))).sort();

    postTelemetry('exercise_db', {
        summary: {
            totalExercises: exercises.length,
            customCount: exercises.filter(e => e.isCustom).length,
            presetCount: exercises.filter(e => !e.isCustom).length,
        },
        activeFilters: filters,
        availableTags: {
            muscleGroups,
            mechanics,
            forceTypes,
            tags,
            equipment
        },
        sampleExercises: exercises.slice(0, 15).map(e => ({
            name: e.name,
            isCustom: Boolean(e.isCustom),
            muscleGroup: e.masterData?.muscleGroup,
            primaryMuscle: e.masterData?.primaryMuscle,
            equipment: e.masterData?.equipment
        }))
    });
}

let lastLogsHash = '';
export function syncWorkoutLogsTelemetry(logs = []) {
    if (!Array.isArray(logs)) return;
    const currentHash = `${logs.length}_${logs[0]?.id || ''}`;
    if (currentHash === lastLogsHash) return;
    lastLogsHash = currentHash;

    postTelemetry('workout_logs', {
        totalLogs: logs.length,
        recentSessions: logs.slice(0, 10).map(l => ({
            id: l.id,
            exerciseName: l.exerciseName,
            date: l.date?.toDate ? l.date.toDate().toISOString() : l.date,
            volume: l.volume,
            setsCount: l.sets?.length || 0
        }))
    });
}

export function syncUiStateTelemetry(view, context = {}) {
    postTelemetry('ui_state', {
        activeView: view,
        context
    });
}
