// --------------------------------------------------------------------------
// Exercise Utility & Normalization Helpers
// --------------------------------------------------------------------------

/**
 * Normalizes AI output data to ensure consistent schema conventions.
 */
export const normalizeAiData = (data) => {
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

/**
 * Derives structured variant metadata from an exercise name and masterData.
 */
export const deriveVariantMeta = (name, masterData = {}) => {
    const raw = String(name || '').toLowerCase();
    const tags = (masterData.tags || []).map(t => String(t).toLowerCase());
    const forceType = String(masterData.forceType || '').toLowerCase();
    const muscleGroup = String(masterData.muscleGroup || '').toLowerCase();
    const movementPatterns = (masterData.movementPattern || []).map(s => String(s).toLowerCase());

    const isometric = raw.startsWith('iso ') || raw.includes(' isometric') || forceType === 'static' || tags.includes('isometric');
    
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

    let armMode = null;
    if (muscleGroup === 'chest' || muscleGroup === 'back' || muscleGroup === 'shoulders' || muscleGroup === 'arms' || muscleGroup === 'core') {
        if (/single\s*-?arm|one\s*-?arm/.test(raw)) armMode = 'single';
        else if (/alternating|alternate\s*-?arm/.test(raw)) armMode = 'alternating';
        else armMode = 'double';
    }

    const unilateral = legMode === 'single' || armMode === 'single' || Boolean(masterData.unilateral && muscleGroup === 'legs');

    let angleDeg = null;
    const angleSingle = raw.match(/\((\d{1,3})°\)/);
    if (angleSingle) {
        angleDeg = Number(angleSingle[1]);
    }
    const isAngled = typeof angleDeg === 'number';

    const eqList = (masterData.equipment || []).map(e => String(e).toLowerCase());
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

/**
 * Builds a deterministic composite key for identifying an exercise variant combination.
 */
export const buildVariantKey = (baseName, variantMeta) => {
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

/**
 * Intelligently extracts the core movement family / base name from any exercise title.
 */
export const extractBaseName = (name) => {
    if (!name) return 'Exercise';
    let n = String(name).trim();

    // Remove text in parentheses
    n = n.replace(/\([^)]*\)/g, '').trim();
    const lower = n.toLowerCase();

    // Core movement family patterns (matched longest / specific first)
    if (lower.includes('bicep curl') || lower.includes('biceps curl')) return 'Bicep Curl';
    if (lower.includes('hammer curl')) return 'Hammer Curl';
    if (lower.includes('zottman curl')) return 'Zottman Curl';
    if (lower.includes('preacher curl') || lower.includes('scott curl')) return 'Preacher Curl';
    if (lower.includes('spider curl')) return 'Spider Curl';
    if (lower.includes('concentration curl')) return 'Concentration Curl';
    if (lower.includes('curl') && (lower.includes('bicep') || lower.includes('arm'))) return 'Bicep Curl';

    if (lower.includes('tricep extension') || lower.includes('triceps extension')) return 'Tricep Extension';
    if (lower.includes('skull crusher') || lower.includes('skullcrusher')) return 'Skull Crusher';
    if (lower.includes('tricep dip') || lower.includes('triceps dip') || lower.includes('bench dip') || lower.includes('dip')) return 'Dip';
    if (lower.includes('pushdown') || lower.includes('push-down')) return 'Tricep Pushdown';

    if (lower.includes('bench press')) return 'Bench Press';
    if (lower.includes('chest press')) return 'Chest Press';
    if (lower.includes('overhead press') || lower.includes('shoulder press') || lower.includes('military press') || lower.includes('strict press') || lower.includes('arnold press')) return 'Overhead Press';
    if (lower.includes('push up') || lower.includes('push-up') || lower.includes('pushup')) return 'Push Up';
    if (lower.includes('chest fly') || lower.includes('pec fly') || lower.includes('dumbbell fly') || lower.includes('fly')) return 'Chest Fly';

    if (lower.includes('lat pulldown') || lower.includes('lat pull-down')) return 'Lat Pulldown';
    if (lower.includes('pull up') || lower.includes('pull-up') || lower.includes('pullup')) return 'Pull Up';
    if (lower.includes('chin up') || lower.includes('chin-up') || lower.includes('chinup')) return 'Chin Up';
    if (lower.includes('dead hang')) return 'Dead Hang';
    if (lower.includes('row')) return 'Row';

    if (lower.includes('squat')) return 'Squat';
    if (lower.includes('lunge')) return 'Lunge';
    if (lower.includes('leg press')) return 'Leg Press';
    if (lower.includes('leg extension')) return 'Leg Extension';
    if (lower.includes('leg curl') || lower.includes('hamstring curl')) return 'Leg Curl';
    if (lower.includes('deadlift')) return 'Deadlift';
    if (lower.includes('hip thrust') || lower.includes('glute bridge')) return 'Hip Thrust';
    if (lower.includes('calf raise') || lower.includes('calves raise')) return 'Calf Raise';

    if (lower.includes('lateral raise') || lower.includes('side raise')) return 'Lateral Raise';
    if (lower.includes('front raise')) return 'Front Raise';
    if (lower.includes('rear delt fly') || lower.includes('reverse fly') || lower.includes('face pull')) return 'Rear Delt Fly';
    if (lower.includes('shrug')) return 'Shrug';

    if (lower.includes('crunch')) return 'Crunch';
    if (lower.includes('plank')) return 'Plank';
    if (lower.includes('leg raise')) return 'Leg Raise';
    if (lower.includes('sit up') || lower.includes('sit-up') || lower.includes('situp')) return 'Sit Up';

    // Fallback token stripping
    const removeTokens = [
        'bodyweight','smith machine','machine','double','single','alternating','alternate','db','dumbbell','dumbbells','bb','barbell','kettlebell','kb','ez bar','ez-bar','cable','band',
        'seated','standing','lying','prone','supine','kneeling','tall kneeling','half kneeling','neutral-grip','close-grip','wide-grip','incline','decline','flat','bench','box',
        'single-leg','single leg','double-leg','double leg','alternate-leg','alternate leg','feet elevated','feet-elevated',
        'single-arm','single arm','double-arm','double arm','alternate-arm','alternate arm','cross body','cross-body','archer','aztec','pike','fingertip','diamond','dive bomber','eccentric',
        'iso','isometric','rear foot elevated','rear-foot-elevated','rfe'
    ];
    let stripped = lower;
    removeTokens.forEach(tok => { stripped = stripped.replace(new RegExp(`(^|\\s)${tok}(\\s|$)`, 'g'), ' '); });
    stripped = stripped.replace(/\s+/g, ' ').trim();
    if (stripped.length > 2) {
        return stripped.replace(/\b\w/g, c => c.toUpperCase());
    }
    return name;
};

/**
 * Derives a human-readable display name from an exercise name and base metadata.
 */
export const makeDisplayNameFrom = (name, baseName, masterData = {}) => {
    if (baseName) return baseName;
    return extractBaseName(name);
};
