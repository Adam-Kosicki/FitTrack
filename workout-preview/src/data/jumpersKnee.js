// Program data and helpers for Jake Tuura's Jumper's Knee Protocol

export const JKP_COLLECTION_PATH = (appId, userId) => `artifacts/${appId}/users/${userId}/programs/jumpersKnee`;

// Stage 1 — Isometrics
export const stage1 = {
    title: "Stage 1 — Isometrics",
    description: "Do daily (preferably twice per day). Progress when next-day pain is <= 3/10 and function improves.",
    quadricepsIsometricOptions: [
        { name: "Single-leg Leg Extension (60°)", notes: "5 x 30–45s holds. Choose a load that is near failure by end of set." },
        { name: "Single-leg Leg Press (60°)", notes: "5 x 30–45s holds at bottom position." },
        { name: "Spanish Squat (60–90°)", notes: "5 x 30–45s holds, torso upright." },
        { name: "Single-leg Wall Sit (60–90°)", notes: "5 x 30–45s holds." },
        { name: "Single-leg Sissy Squat (as tolerated)", notes: "5 x 30–45s holds." },
        { name: "Reverse Nordic (as tolerated)", notes: "5 x 30–45s holds." }
    ],
    foamRollerBridgeProgression: [
        { name: "Double-leg Bridge (heels lifted)", sets: 3, durationSec: 30, notes: "Stay on heel and 1st/5th met heads; avoid toe gripping." },
        { name: "Single-leg Bridge (heel lifted)", sets: 3, durationSec: 30, notes: "Hold smooth position; glutes just off floor." },
        { name: "Single-leg Bridge w/ Calf Raises", sets: 3, durationSec: 30, notes: "Slow, controlled calf raises during hold." }
    ],
    isoLungeOptions: [
        { name: "ISO Lunge (long stride)", notes: "Accumulate 3 min each side in as few sets as possible." },
        { name: "ISO Split Squat (short stride)", notes: "Accumulate 3 min each side. Back glute engaged." },
        { name: "ISO RFESS (rear foot elevated)", notes: "Accumulate 3 min each side. Most load on front foot." }
    ],
    singleLegStand: { name: "Single-leg Stand (tripod foot)", notes: "Accumulate 3 min each side. Add load when easy." }
};

// Stage 1 additional guidance shown in the UI
export const stage1Details = {
    accumulateDefinition: "Accumulate means total time. Aim to reach 3 minutes per side in as few sets as you can with good technique. If you fatigue, rest briefly and continue until you reach 3 minutes.",
    whenToDo: "Stage 1 is a standalone session done daily (ideally twice per day, spaced by ~6 hours).",
    singleLegStandHow: "Stand on the tripod of the foot (heel + 1st + 5th met heads). Keep the knee softly bent and pelvis centered. When 3 minutes straight becomes easy, add load (e.g., hold kettlebells) or raise the non-stance leg higher.",
    sessionTemplate: [
        "Optional: ‘Twist in the Knee’ sequence (5–10 min) if the knee feels locked/stiff before isometrics",
        "Warm-up: 2 x 30–45s quadriceps isometric holds (light → moderate) — these do not count toward the 5 work sets",
        "Main: Quadriceps Isometric — 5 x 30–45s at the prescribed joint angle",
        "Accessory Isometrics: Foam Roller Bridge (3 x 30s), ISO Lunge/Split Squat (accumulate 3 min each side), Single‑leg Stand (accumulate 3 min each side)",
        "Optional: Log pain before/after; monitor next‑morning pain to decide progression"
    ],
    achillesInStage1Context: "Read the Achilles Hopping Progression now. It primarily starts in Stage 2. In Stage 1, only consider very light Step 1 (band‑assisted pogos) for neural prep if pain is minimal and next‑morning pain returns to baseline.",
    twistInKneeDescription: "A 10‑move mobility/activation sequence to ‘untwist’ the lower limb by addressing foot/ankle, tibia, hips, and trunk. Use before Stage 1 if you feel locked/stiff or as needed to improve movement quality."
};

// Stage 2 — Lifting (3-week wave for main lifts)
export const stage2 = {
    title: "Stage 2 — Lifting",
    description: "Repeat 4-day sequence. Main lifts use 3-week wave: Week1=5 reps, Week2=4 reps, Week3=3 reps (approx. 5 sets).",
    weeks: [1, 2, 3],
    day1: {
        name: "Day 1 — Squat & Split Squat",
        items: [
            { type: "achilles", name: "Achilles Hopping Progression", notes: "Pick current progression. 4 sets as prescribed." },
            { type: "main", name: "Knee-dominant Squat", sets: 5, repsByWeek: {1:5,2:4,3:3}, tempo: "3 ECC / 3 CON", restMin: 3, options: ["Goblet Squat","Front Squat","Back Squat","Zercher Squat"] },
            { type: "main", name: "Split Squat (front knee ~90°)", sets: 5, repsByWeek: {1:5,2:4,3:3}, tempo: "3 ECC / 3 CON", restMin: 3, options: ["Front Foot Elevated Split Squat","Split Squat","Rear Foot Elevated Split Squat"] },
            { type: "assist", name: "Lateral Lunge", sets: 3, reps: 10, notes: "Single DB in inside hand; focus on hip IR + foot pronation.", rest: "as needed" }
        ]
    },
    day2: { name: "Day 2 — Isometrics", items: [ { type: "isometrics", name: "Stage 1 Isometric Session" } ] },
    day3: {
        name: "Day 3 — Hip Hinge & Step Up",
        items: [
            { type: "achilles", name: "Achilles Hopping Progression", notes: "Pick current progression. 4 sets as prescribed." },
            { type: "main", name: "Hip Hinge", sets: 5, repsByWeek: {1:5,2:4,3:3}, tempo: "3 ECC / 3 CON", restMin: 3, options: ["Barbell RDL","DB/KB RDL","Trap Bar Deadlift"] },
            { type: "main", name: "Step Up (start ~60° knee)", sets: 5, repsByWeek: {1:5,2:4,3:3}, tempo: "3 ECC / 3 CON", restMin: 3, options: ["Front Step Up","Side Step Up"] },
            { type: "assist", name: "Lateral Sled Drag", sets: 4, distanceYds: 20, notes: "20 yd each side per set.", rest: "as needed" }
        ]
    },
    day4: {
        name: "Day 4 — Isometrics + Calves/Hips",
        items: [
            { type: "isometrics", name: "Quadriceps Isometric (as Stage 1)" },
            { type: "calves", name: "Soleus (bent-knee calf raise)", sets: 3, reps: 20, unilateral: true, restMin: 2 },
            { type: "calves", name: "Gastrocnemius (straight-knee calf raise)", sets: 3, reps: 10, unilateral: true, restMin: 2 },
            { type: "adductor", name: "Bench Adductor/Abductor", sets: 4, reps: 25, unilateral: false, rest: "as needed" }
        ]
    }
};

// Stage 3 — Store-and-Release (12 progressive workouts)
export const stage3 = {
    title: "Stage 3 — Store-And-Release",
    description: "6-day weekly sequence with 12 progressive Store-And-Release (SAR) workouts. Progress only when next-day pain is okay and technique is good.",
    workouts: [
        { index: 1, landing: "Bilateral Trap Bar/DB Land — 3x5 (hold 2s at ~60–90°)", jumping: "Band-Assisted Jump — 4x20 reps @50%",
          accel: "Tempo Intervals — 6x60y @70%", cod: "45° Zig-Zag — 5x3 cuts each way @70%" },
        { index: 2, landing: "Bilateral Trap Bar/DB Land — 3x5 (increase load)", jumping: "Seated Box Jump — 4x10 @50%",
          accel: "Tempo Intervals — 8x60y @70%", cod: "90° Box — 5x3 cuts each way @70%" },
        { index: 3, landing: "Bilateral Trap Bar/DB Land — 3x5 (increase load)", jumping: "Standing Box Jump — 4x10 @50%",
          accel: "Tempo Intervals — 10x60y @70%", cod: "180° 5-10-5 — 5x2 cuts each way @70%" },
        { index: 4, landing: "DB Split Land — 3x5 each", jumping: "Continuous Squat Jump — 4x10 @50%",
          accel: "Flying Sprints — 3 sets (20 accel/10 hold/30 decel)", cod: "180° 10-20-10 — 5x2 cuts each way @70%" },
        { index: 5, landing: "DB Split Land — 3x5 each (increase load)", jumping: "Approach Box Jump — 4x5 each @50%",
          accel: "Flying Sprints — 4 sets (20/10/30)", cod: "45° Zig-Zag — 4x3 cuts each way @90%" },
        { index: 6, landing: "DB Split Land — 3x5 each (increase load)", jumping: "Continuous Approach Jump — 4x5 each @50%",
          accel: "Flying Sprints — 5 sets (20/10/30)", cod: "90° Box — 4x3 cuts each way @90%" },
        { index: 7, landing: "Staggered Depth Drop — 3x5 each", jumping: "Band-Assisted Jump — 4x10 @100%",
          accel: "Accel/Decel — 6 sets (10 accel/5 decel) @70%", cod: "180° 5-10-5 — 4x2 cuts each way @90%" },
        { index: 8, landing: "Staggered Depth Drop — 3x5 each (higher)", jumping: "Seated Box Jump — 4x5 @100%",
          accel: "Accel/Decel — 8 sets (10/5) @70%", cod: "180° 10-20-10 — 4x2 cuts each way @90%" },
        { index: 9, landing: "Staggered Depth Drop — 3x5 each (higher)", jumping: "Standing Box Jump — 4x5 @100%",
          accel: "Accel/Decel — 10 sets (10/5) @70%", cod: "45° Zig-Zag — 3x3 cuts each way @100%" },
        { index: 10, landing: "Bilateral Jump to Unilateral Land — 3x5 each", jumping: "Continuous Squat Jump — 4x5 @100%",
          accel: "Accel/Decel — 6 sets (10/5) @90–100%", cod: "90° Box — 3x3 cuts each way @100%" },
        { index: 11, landing: "Bilateral Jump to Unilateral Land — 3x5 each (higher)", jumping: "Approach Box Jump — 4x3 each @100%",
          accel: "Accel/Decel — 8 sets (10/5) @90–100%", cod: "180° 5-10-5 — 3x2 cuts each way @100%" },
        { index: 12, landing: "Bilateral Jump to Unilateral Land — 3x5 each (higher)", jumping: "Continuous Approach Jump — 4x3 each @100%",
          accel: "Accel/Decel — 10 sets (10/5) @90–100%", cod: "180° 10-20-10 — 3x2 cuts each way @100%" }
    ]
};

export const stage4 = {
    title: "Stage 4 — Return to Sport",
    description: "Replace Store-And-Release days with sport practice/competition. Keep Stage 2 lifting ~2x/week and use Stage 1 isometrics as needed. Manage weekly high-intensity days (<= 3)."
};

export const achillesProgression = [
    { name: "Band-Assisted DL Pogos", sets: 4, reps: 25 },
    { name: "Double-leg Pogos", sets: 4, reps: 20 },
    { name: "Alternate-leg Pogos", sets: 4, reps: 10, eachSide: true },
    { name: "Single-leg Pogos", sets: 4, reps: 10, eachSide: true },
    { name: "Low Hurdle Hopping", sets: 4, reps: 10, hurdles: true },
    { name: "Medium Hurdle Hopping", sets: 4, reps: 10, hurdles: true },
    { name: "Double-leg Tuck Jumps", sets: 4, reps: 5 },
    { name: "Single-leg Tuck Jumps", sets: 4, reps: 3, eachSide: true }
];

// Helper to build ad-hoc workout payloads for the existing WorkoutSession
export function buildAdHocWorkout(name, items) {
    const now = Date.now();
    return {
        id: `ad-hoc-${now}`,
        isAdHoc: true,
        category: 'jumpersKnee',
        name,
        description: "Generated from Jumper's Knee Protocol",
        createdAt: new Date(),
        exercises: items.map((it, idx) => ({
            id: `jkp-${now}-${idx}`,
            name: it.name,
            baseName: it.name,
            notes: it.notes || '',
            variantOptions: it.variantOptions || it.options || undefined,
            loadType: it.loadType,
            holdSeconds: it.holdSeconds,
            sets: Array.from({ length: it.sets || 1 }, (_, i) => ({ id: `s${i+1}`, reps: it.reps ?? 1, weight: 0 }))
        }))
    };
}

// ----- Additional content from the program text (for interactive guidance) -----
export const managingPain = {
    duringTraining: "Up to ~3/10 tendon pain during training can be acceptable if not excruciating. The key is how it feels the next day.",
    nextDayPain: "Increased tendon pain 24h later or next morning is not OK — indicates exceeded capacity; scale back.",
    painProvocationTest: "Daily single‑leg decline squat to ~90° (or to pain‑limited angle). Use same conditions/time each day. If pain returns to baseline → proceed; if worse → reduce intensity/volume or regress a stage.",
    nextMorningPain: "On rising and walking around, compare to yesterday. Increased stiffness/pain → exceeded capacity; adjust training."
};

export const stage1Warmup = [
    "30–45s quad isometric with light weight or easier position",
    "30–45s quad isometric with moderate weight or slightly harder position",
    "Begin session; warm‑up sets don’t count toward the 5 sets"
];

export const twistInKneeSequence = [
    "Calcaneal Eversion — 20 reps each side",
    "Tibial Internal Rotation — 20 reps each side (lunge position)",
    "Wall Single‑leg Bridge — 30s each side",
    "90/90 Hip Lift — 1 minute",
    "90/90 Hip Switches — 20 reps each side",
    "Arm Bar — 20 reps each side (25–50 lb)",
    "Bench Adductor — 20 reps each side",
    "Full Squat — 2 minutes (heels down, knees forward, breathe into ribs)",
    "DB Side Bend — 20 reps each side",
    "Hanging Knee Raise — 20 reps"
];

export const motorCortexTools = [
    "Metronome at 60 bpm",
    "Eye movements with the beat (up/down, side/side)",
    "Hands on quad to feel activation"
];

export const stage2Warmup = [
    "Jog 100 yards",
    "Backwards jog 100 yards",
    "Shuffle 100 yards each side",
    "Carioca 100 yards each side",
    "Skip 100 yards or low‑level game (e.g., spikeball)"
];

export const tenThings = [
    "Spend enough time with isometrics to normalize inhibition/activation",
    "Strengthen muscle with lifting (squats, split squats, hip hinges, step ups, calf raises)",
    "Develop soleus–hamstring co‑contractions (foam roller bridge, hopping)",
    "Develop ankle/foot/Achilles to avoid knee compensation",
    "Eat right — ~1 g protein/lb bodyweight; collagen/proline/glycine; vitamin C",
    "Sleep ~8h; keep consistent sleep–wake to support tendon remodeling",
    "Move — aim ~10,000 steps/day; avoid sedentary highs in blood sugar",
    "Change loads gradually — don’t jump from 0 to 100 jumps/week",
    "Appreciate tendon timelines — reactive responses can last weeks/months; listen to next‑day pain",
    "Consider biopsychosocial factors — thoughts/emotions/behaviors and context matter"
];


