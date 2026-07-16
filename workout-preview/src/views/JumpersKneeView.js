import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, addDoc, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { appId } from '../constants';
import { ActionDialog, NumberStepper } from '../components/UI';
import { BookOpenIcon, CheckmarkIcon, InfoIcon } from '../components/Icons';
import { stage1, stage1Details, stage2, stage3, stage4, achillesProgression, JKP_COLLECTION_PATH, managingPain, stage1Warmup, twistInKneeSequence, motorCortexTools, stage2Warmup, tenThings } from '../data/jumpersKnee';
import { PainScale } from '../components/PainScale';

export function JumpersKneeView({ userId }) {
    const [state, setState] = useState({
        stage: 1,
        week: 1,
        dayIndex: 1,
        sarIndex: 1,
        achillesIndex: 0,
        painProvocationScore: null,
        nextMorningPain: null,
        completedSar: [],
        stage2Completed: {}
    });
    const [saving, setSaving] = useState(false);
    const [confirmProgression, setConfirmProgression] = useState(null);

    const path = useMemo(() => JKP_COLLECTION_PATH(appId, userId), [userId]);
    const PDF_INDEX_ABS = '/jumpers-knee/index.html';
    const PDF_INDEX_WEB = '/jumpers-knee/index.html';

    useEffect(() => {
        if (!userId) return;
        const ref = doc(db, path);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setState(prev => ({ ...prev, ...snap.data() }));
            }
        });
        return () => unsub();
    }, [userId, path]);

    const persist = async (updates) => {
        setSaving(true);
        const ref = doc(db, path);
        await setDoc(ref, { ...state, ...updates, updatedAt: new Date() }, { merge: true });
        setSaving(false);
    };

    const canProgressByPain = () => {
        const nextDayOk = (state.nextMorningPain ?? 10) <= 3;
        const provocationOk = (state.painProvocationScore ?? 10) <= 3;
        return nextDayOk || provocationOk;
    };

    // Starting workouts from the guide has been removed by design.

    const toggleSarCompleted = async (idx) => {
        const set = new Set(state.completedSar || []);
        if (set.has(idx)) set.delete(idx); else set.add(idx);
        await persist({ completedSar: Array.from(set).sort((a,b)=>a-b) });
    };

    const requestProgress = (what) => setConfirmProgression(what);

    const confirmProgress = async () => {
        const what = confirmProgression;
        setConfirmProgression(null);
        if (what === 'stage1->2' && canProgressByPain()) {
            await persist({ stage: 2 });
        } else if (what === 'stage2->3' && canProgressByPain()) {
            await persist({ stage: 3 });
        } else if (what === 'sarNext' && canProgressByPain()) {
            const next = Math.min(12, (state.sarIndex || 1) + 1);
            await persist({ sarIndex: next });
        }
    };

    const toggleStage2DayCompleted = async (week, dayIdx) => {
        const key = `w${week}-d${dayIdx+1}`;
        const current = state.stage2Completed || {};
        const updated = { ...current, [key]: !current[key] };
        await persist({ stage2Completed: updated });
    };

    // Sub-tabs: Overview | Pain Log | Stages
    const [subTab, setSubTab] = useState('overview');

    const [painEntries, setPainEntries] = useState([]);
    const [tempPainLevel, setTempPainLevel] = useState(null);
    const [tempPainNote, setTempPainNote] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingLevel, setEditingLevel] = useState(0);
    const [editingNote, setEditingNote] = useState('');
    const [editingContext, setEditingContext] = useState('general');
    useEffect(() => {
        if (!userId) return;
        const painRef = collection(db, `artifacts/${appId}/users/${userId}/jumpersKneePain`);
        const q = query(painRef, orderBy('timestamp','desc'));
        const unsub = onSnapshot(q, (snap) => {
            setPainEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [userId]);

    const savePainEntry = async ({ level, context = 'general', note }) => {
        if (!userId) return;
        const painRef = collection(db, `artifacts/${appId}/users/${userId}/jumpersKneePain`);
        await addDoc(painRef, { level, context, note: note || '', timestamp: new Date() });
    };

    const beginEditEntry = (entry) => {
        setEditingId(entry.id);
        setEditingLevel(entry.level ?? 0);
        setEditingNote(entry.note ?? '');
        setEditingContext(entry.context ?? 'general');
    };

    const cancelEditEntry = () => {
        setEditingId(null);
        setEditingLevel(0);
        setEditingNote('');
        setEditingContext('general');
    };

    const persistEditEntry = async () => {
        if (!editingId || !userId) return;
        const ref = doc(db, `artifacts/${appId}/users/${userId}/jumpersKneePain`, editingId);
        await updateDoc(ref, { level: editingLevel, note: editingNote, context: editingContext });
        cancelEditEntry();
    };

    const removeEntry = async (entryId) => {
        if (!userId) return;
        const ref = doc(db, `artifacts/${appId}/users/${userId}/jumpersKneePain`, entryId);
        await deleteDoc(ref);
        if (editingId === entryId) cancelEditEntry();
    };

    const header = (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
                <BookOpenIcon className="h-8 w-8 text-indigo-400" />
                <div>
                    <h1 className="text-2xl font-bold">Jumper's Knee Protocol</h1>
                    <p className="text-gray-400 text-sm">Guided tracker based on Jake Tuura's program</p>
                </div>
            </div>
            <div className="flex items-center space-x-2 text-sm">
                <button className={`px-3 py-1 rounded ${subTab==='overview'?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setSubTab('overview')}>Overview</button>
                <button className={`px-3 py-1 rounded ${subTab==='pain'?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setSubTab('pain')}>Pain Log</button>
                <button className={`px-3 py-1 rounded ${subTab==='stages'?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setSubTab('stages')}>Stages</button>
            </div>
        </div>
    );

    const renderOverview = () => {
        const pages = Array.from({ length: 42 }, (_, i) => String(i + 1).padStart(3, '0'));
        return (
            <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold mb-1">Official Guide</h2>
                        <p className="text-gray-400 text-sm">Open Jake Tuura's Jumper's Knee Protocol pages</p>
                    </div>
                    <div className="flex gap-2">
                        <a className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded" href={`${PDF_INDEX_WEB}`} target="_blank" rel="noreferrer">Open Web Copy</a>
                        <a className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded" href={`${PDF_INDEX_ABS}`} target="_blank" rel="noreferrer">Open Local</a>
                    </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {pages.map(p => (
                        <a key={p} href={`${PDF_INDEX_WEB}#page-${p}`} target="_blank" rel="noreferrer" className="bg-gray-900 hover:bg-gray-700 text-center py-2 rounded text-sm">
                            Page {Number(p)}
                        </a>
                    ))}
                </div>
                <div className="mt-6 bg-gray-900 p-3 rounded text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">10 Things to Keep in Mind</p>
                    <ol className="list-decimal list-inside space-y-1">{tenThings.map((t,i)=>(<li key={i}>{t}</li>))}</ol>
                </div>
            </div>
        );
    };

    const renderPainLog = () => {
        const latest = painEntries.find(()=>true);
        return (
            <div className="bg-gray-800 p-4 rounded-lg">
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <h2 className="text-xl font-bold mb-2">Log Pain (0–10)</h2>
                        <PainScale value={tempPainLevel ?? (latest?.level ?? 0)} onChange={setTempPainLevel} />
                        <div className="mt-3">
                            <label className="block text-xs text-gray-400 mb-1">Personal Notes (optional)</label>
                            <textarea value={tempPainNote} onChange={e=>setTempPainNote(e.target.value)} className="w-full bg-gray-700 p-2 rounded h-20" placeholder="e.g., Played volleyball yesterday; ankle sore in morning; pain 4/10 before session." />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            {['general','pre','post'].map(ctx => (
                                <button key={ctx} onClick={()=> { savePainEntry({ level: (tempPainLevel ?? 0), context: ctx, note: tempPainNote }); setTempPainNote(''); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded">Save {ctx}</button>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-400">Tip: Save before, after, or anytime to track daily progression.</p>
                    </div>
                    <div>
                        <div className="bg-gray-900 p-3 rounded text-sm text-gray-300">
                            <p className="font-semibold text-indigo-300 mb-2">Pain‑scale guidance</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>{managingPain.duringTraining}</li>
                                <li>{managingPain.nextDayPain}</li>
                                <li>{managingPain.painProvocationTest}</li>
                                <li>{managingPain.nextMorningPain}</li>
                            </ul>
                            <div className="mt-3 text-xs text-gray-400">
                                <a className="underline text-indigo-400" href={`${PDF_INDEX_WEB}`} target="_blank" rel="noreferrer">Source: Jake Tuura — Jumper's Knee Protocol</a>
                            </div>
                        </div>
                    </div>
                </div>

                <h3 className="mt-6 mb-2 font-semibold text-indigo-300">History</h3>
                <PainHistoryChart entries={painEntries} />
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                    {painEntries.map(e => {
                        const isEditing = editingId === e.id;
                        return (
                            <div key={e.id} className="text-sm text-gray-300 bg-gray-900 p-2 rounded">
                                {!isEditing ? (
                                    <>
                                        <div className="flex justify-between"><span>{new Date(e.timestamp.seconds ? e.timestamp.toDate() : e.timestamp).toLocaleString()} — {e.context}</span><span className="font-semibold">{e.level}/10</span></div>
                                        {e.note && <div className="mt-1 text-gray-400">Note: {e.note}</div>}
                                        <div className="mt-2 flex gap-2">
                                            <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded" onClick={() => beginEditEntry(e)}>Edit</button>
                                            <button className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded" onClick={() => removeEntry(e.id)}>Delete</button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="text-xs text-gray-400">Editing entry from {new Date(e.timestamp.seconds ? e.timestamp.toDate() : e.timestamp).toLocaleString()}</div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Level (0–10)</label>
                                            <PainScale value={editingLevel} onChange={setEditingLevel} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Context</label>
                                            <div className="flex gap-2 text-xs">
                                                {['general','pre','post'].map(ctx => (
                                                    <button key={ctx} className={`px-2 py-1 rounded ${editingContext===ctx?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setEditingContext(ctx)}>{ctx}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Note</label>
                                            <textarea className="w-full bg-gray-800 p-2 rounded h-16" value={editingNote} onChange={e=>setEditingNote(e.target.value)} />
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded" onClick={persistEditEntry}>Save</button>
                                            <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded" onClick={cancelEditEntry}>Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const PainHistoryChart = ({ entries }) => {
        // lightweight SVG line chart
        const points = entries.slice().reverse().map((e, idx) => ({
            x: idx,
            y: e.level
        }));
        const width = 600, height = 150, pad = 24;
        const maxX = Math.max(1, points.length - 1);
        const toX = (i) => pad + (i / maxX) * (width - pad * 2);
        const toY = (v) => pad + (1 - (v / 10)) * (height - pad * 2);
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`).join(' ');
        return (
            <div className="bg-gray-900 rounded p-3 overflow-x-auto">
                <svg width={width} height={height}>
                    <rect x="0" y="0" width={width} height={height} fill="#111827" />
                    {/* axes */}
                    <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#374151" />
                    <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#374151" />
                    {Array.from({length:11}).map((_,i)=> (
                        <g key={i}>
                            <line x1={pad} y1={toY(i)} x2={width-pad} y2={toY(i)} stroke="#1f2937" opacity="0.3" />
                            <text x={4} y={toY(i)+4} fontSize="10" fill="#9CA3AF">{i}</text>
                        </g>
                    ))}
                    <path d={path} fill="none" stroke="#60A5FA" strokeWidth="2" />
                    {points.map((p,i)=> (
                        <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r="3" fill="#93C5FD" />
                    ))}
                </svg>
            </div>
        );
    };

    const renderStage1 = () => (
        <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-bold mb-2">{stage1.title}</h2>
                <p className="text-gray-400 mb-4">{stage1.description}</p>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Pain rules:</span> Up to ~3/10 pain during training may be acceptable; <span className="font-semibold">next-morning pain</span> should return to baseline. If morning pain increases, reduce volume/intensity or regress a stage.</p></div>
                    <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Why isometrics?</span> Calms inhibition and restores activation (brain), builds quads/calves (muscle), and re-grooves foot/leg mechanics (kinetic chain). Use a metronome and gentle eye movements; feel the quad contracting.</p></div>
                    <div className="flex items-start space-x-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Foot tripod:</span> Heel + 1st + 5th met heads. Avoid toe gripping. This helps arches and alignment upstream.</p></div>
                </div>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">Managing Pain</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>{managingPain.duringTraining}</li>
                        <li>{managingPain.nextDayPain}</li>
                        <li>{managingPain.painProvocationTest}</li>
                        <li>{managingPain.nextMorningPain}</li>
                    </ul>
                </div>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">What “accumulate 3 min per side” means</p>
                    <p>{stage1Details.accumulateDefinition}</p>
                </div>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">When to do Stage 1</p>
                    <p>{stage1Details.whenToDo}</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        {stage1Details.sessionTemplate.map((t,i)=>(<li key={i}>{t}</li>))}
                    </ul>
                </div>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">Stage 1 Warm‑up</p>
                    <ul className="list-disc list-inside space-y-1">{stage1Warmup.map((t,i)=>(<li key={i}>{t}</li>))}</ul>
                </div>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">Motor Cortex Tools</p>
                    <ul className="list-disc list-inside space-y-1">{motorCortexTools.map((t,i)=>(<li key={i}>{t}</li>))}</ul>
                </div>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">“Twist in the Knee” Sequence</p>
                    <p className="text-gray-400 mb-2">{stage1Details.twistInKneeDescription}</p>
                    <ol className="list-decimal list-inside space-y-1">{twistInKneeSequence.map((t,i)=>(<li key={i}>{t}</li>))}</ol>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-900 p-3 rounded">
                        <p className="font-semibold text-indigo-300 mb-2">Quadriceps Isometric Options</p>
                        <ul className="list-disc list-inside space-y-1">
                            {stage1.quadricepsIsometricOptions.map((o, i) => (
                                <li key={i}>{o.name} — <span className="text-gray-400">{o.notes}</span></li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-gray-900 p-3 rounded">
                        <p className="font-semibold text-indigo-300 mb-2">Foam Roller Bridge Progression</p>
                        <ol className="list-decimal list-inside space-y-1">
                            {stage1.foamRollerBridgeProgression.map((o, i) => (
                                <li key={i}>{o.name} — <span className="text-gray-400">{o.sets} x {o.durationSec}s. {o.notes}</span></li>
                            ))}
                        </ol>
                    </div>
                    <div className="bg-gray-900 p-3 rounded">
                        <p className="font-semibold text-indigo-300 mb-2">ISO Lunge/Split Squat</p>
                        <ul className="list-disc list-inside space-y-1">
                            {stage1.isoLungeOptions.map((o, i) => (
                                <li key={i}>{o.name} — <span className="text-gray-400">{o.notes}</span></li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-gray-900 p-3 rounded">
                        <p className="font-semibold text-indigo-300 mb-2">Single-leg Stand</p>
                        <p className="text-gray-400">{stage1.singleLegStand.notes}</p>
                        <p className="text-gray-400 mt-1">How: {stage1Details.singleLegStandHow}</p>
                    </div>
                </div>
                <div className="bg-gray-900 p-3 rounded mb-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">Achilles Hopping Progression (context)</p>
                    <p className="text-gray-400 mb-2">{stage1Details.achillesInStage1Context}</p>
                    <ul className="list-disc list-inside space-y-1">
                        {achillesProgression.map((p,i)=>(
                            <li key={i}>{p.name} — {p.sets} x {p.reps}{p.eachSide? ' each side':''}{p.hurdles? ' over ~10 hurdles':''}</li>
                        ))}
                    </ul>
                </div>
                <div className="mt-4 flex flex-col md:flex-row gap-2">
                    <button onClick={() => requestProgress('stage1->2')} className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center ${!canProgressByPain() ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={!canProgressByPain()}>
                        <CheckmarkIcon className="h-5 w-5 mr-2" /> Mark Ready for Stage 2
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStage2 = () => (
        <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">{stage2.title}</h2>
                        <p className="text-gray-400">Week {state.week} / 3 — {stage2.description}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-sm">
                            <label className="block text-gray-400 text-xs">Week (1–3)</label>
                            <NumberStepper value={state.week} onValueChange={(v) => persist({ week: Math.min(3, Math.max(1, v)) })} min={1} />
                        </div>
                        <div className="text-sm">
                            <label className="block text-gray-400 text-xs">Achilles Step</label>
                            <NumberStepper value={(state.achillesIndex ?? 0) + 1} onValueChange={(v) => persist({ achillesIndex: Math.min(achillesProgression.length - 1, Math.max(0, v - 1)) })} min={1} />
                        </div>
                    </div>
                </div>
                <div className="bg-gray-900 p-3 rounded mt-4 text-sm text-gray-300">
                    <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Tempo:</span> Start with 3s down, 3s up ("health tempo"). If well tolerated and seeking performance, switch to controlled down, explosive up.</p></div>
                    <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Progression benchmarks:</span> Squat/hinge strength improving (aim ~1.5x BW est. squat max), split squat/step up symmetrical; Achilles hopping progression completed with good stiffness.</p></div>
                    <div className="flex items-start space-x-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Sport skills:</span> Minimal-stress skills from Stage 1 can become more intense here as tolerated. Pull back if next-morning pain rises.</p></div>
                </div>
                <div className="bg-gray-900 p-3 rounded mt-4 text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">Stage 2 Warm‑up (before hopping/lifting days)</p>
                    <ul className="list-disc list-inside space-y-1">{stage2Warmup.map((t,i)=>(<li key={i}>{t}</li>))}</ul>
                </div>
                <div className="space-y-6 mt-4">
                    {[1,2,3].map(week => (
                        <div key={week} className="bg-gray-900 p-4 rounded">
                            <p className="font-semibold text-indigo-300 mb-2">Week {week}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[stage2.day1, stage2.day2, stage2.day3, stage2.day4].map((day, idx) => {
                                    const key = `w${week}-d${idx+1}`;
                                    const isDone = !!(state.stage2Completed || {})[key];
                                    return (
                                        <div key={`${week}-${idx}`} className={`p-3 rounded border ${isDone ? 'bg-green-900/30 border-green-700' : 'bg-gray-950 border-gray-800'}`}>
                                            <div className="flex items-start justify-between">
                                                <p className="font-semibold text-gray-200 mb-1">{day.name}</p>
                                                <label className="text-xs flex items-center space-x-2">
                                                    <input type="checkbox" checked={isDone} onChange={() => toggleStage2DayCompleted(week, idx)} />
                                                    <span>{isDone ? 'Completed' : 'Mark complete'}</span>
                                                </label>
                                            </div>
                                            <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                                {day.items.map((it, i) => (
                                                    <li key={i}>{it.type === 'main' ? `${it.name} — ${it.repsByWeek?.[week] || 5} reps, ${it.tempo}, Rest ${it.restMin} min` : it.name}</li>
                                                ))}
                                            </ul>
                                            <div className="mt-3 text-xs text-gray-400">
                                                Review the above plan for Week {week} — {day.name}. Start your workout from the Workouts tab when ready.
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4">
                    <button onClick={() => requestProgress('stage2->3')} className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded ${!canProgressByPain() ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={!canProgressByPain()}>
                        <CheckmarkIcon className="h-5 w-5 inline mr-2" /> Mark Ready for Stage 3
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStage3 = () => {
        const current = stage3.workouts.find(w => w.index === state.sarIndex) || stage3.workouts[0];
        const completedSet = new Set(state.completedSar || []);
        return (
            <div className="space-y-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">{stage3.title} (SAR)</h2>
                            <p className="text-gray-400">Store-And-Release develops landing, jumping, acceleration/deceleration, and change-of-direction qualities.</p>
                        </div>
                        <div className="text-sm">
                            <label className="block text-gray-400 text-xs">Current SAR #</label>
                            <NumberStepper value={state.sarIndex} onValueChange={(v) => persist({ sarIndex: Math.min(12, Math.max(1, v)) })} min={1} />
                        </div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded mt-4 text-sm text-gray-300">
                        <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">What SAR means:</span> Store-and-release elastic energy using progressive landing/jumping/accel/COD drills. Intensity increases over sessions; volume generally decreases.</p></div>
                        <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">How to progress:</span> Only advance when technique is good and next-morning pain (or pain-provocation) is ≤ 3/10. Otherwise, repeat or regress.</p></div>
                        <div className="flex items-start space-x-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Weekly flow:</span> Day 1 SAR → Day 2 Isometrics → Day 3 Lifting. Use isometrics to settle any flare before lifting.</p></div>
                    </div>

                    <div className="mt-4">
                        <button onClick={() => requestProgress('sarNext')} className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded ${!canProgressByPain() ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={!canProgressByPain()}>
                            <CheckmarkIcon className="h-5 w-5 inline mr-2" /> Mark Ready for Next
                        </button>
                    </div>

                    <h3 className="mt-6 mb-2 font-semibold text-indigo-300">All SAR Workouts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stage3.workouts.map((w) => {
                            const isCurrent = w.index === current.index;
                            const isDone = completedSet.has(w.index);
                            return (
                                <div key={w.index} className={`p-4 rounded bg-gray-900 border ${isCurrent ? 'border-indigo-500' : 'border-gray-800'} ${isDone ? 'bg-green-900/30' : ''}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-bold">SAR #{w.index}</p>
                                        <label className="text-sm flex items-center space-x-2">
                                            <input type="checkbox" checked={isDone} onChange={() => toggleSarCompleted(w.index)} />
                                            <span>Completed</span>
                                        </label>
                                    </div>
                                    <div className="text-sm text-gray-300 space-y-2">
                                        <div><span className="text-indigo-300 font-semibold">Landing:</span> {w.landing}</div>
                                        <div><span className="text-indigo-300 font-semibold">Jumping:</span> {w.jumping}</div>
                                        <div><span className="text-indigo-300 font-semibold">Accel/Decel:</span> {w.accel}</div>
                                        <div><span className="text-indigo-300 font-semibold">COD:</span> {w.cod}</div>
                                        <div>
                                            <a className="text-indigo-400 underline" href={`${PDF_INDEX_ABS}#page-026`} target="_blank" rel="noreferrer">View PDF near SAR #{w.index}</a>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        {isCurrent ? (
                                            <span className="text-xs text-indigo-300 self-center">Current</span>
                                        ) : (
                                            <button onClick={() => persist({ sarIndex: w.index })} className="text-xs underline text-indigo-400 self-center">Set as Current</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderStage4 = () => (
        <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-bold">{stage4.title}</h2>
                <p className="text-gray-400">{stage4.description}</p>
                <div className="bg-gray-900 p-3 rounded mt-4 text-sm text-gray-300">
                    <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Goal:</span> Return to "thoughtless, fearless" movement. Keep monitoring next-day pain and adjust loads promptly if it rises.</p></div>
                    <div className="flex items-start space-x-2 mb-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Keep lifting:</span> Maintain Stage 2 lifts ~2x/week; use Stage 1 isometrics as needed around sport sessions.</p></div>
                    <div className="flex items-start space-x-2"><InfoIcon className="h-5 w-5 text-indigo-300 mt-0.5" /><p><span className="font-semibold">Weekly density:</span> Limit to ≤ 3 high-intensity training/competition days per week initially.</p></div>
                </div>
            </div>
        </div>
    );

    return (
        <div>
            {header}

            {subTab === 'overview' && renderOverview()}

            {subTab === 'pain' && renderPainLog()}

            {subTab === 'stages' && (
                <>
                    <div className="mb-4">
                        <div className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-400">Stage:</span>
                            <button onClick={() => persist({ stage: 1 })} className={`px-3 py-1 rounded ${state.stage === 1 ? 'bg-indigo-600' : 'bg-gray-800'}`}>1</button>
                            <button onClick={() => persist({ stage: 2 })} className={`px-3 py-1 rounded ${state.stage === 2 ? 'bg-indigo-600' : 'bg-gray-800'}`}>2</button>
                            <button onClick={() => persist({ stage: 3 })} className={`px-3 py-1 rounded ${state.stage === 3 ? 'bg-indigo-600' : 'bg-gray-800'}`}>3</button>
                            <button onClick={() => persist({ stage: 4 })} className={`px-3 py-1 rounded ${state.stage === 4 ? 'bg-indigo-600' : 'bg-gray-800'}`}>4</button>
                            {saving && <span className="text-xs text-gray-500 ml-2">Saving…</span>}
                        </div>
                    </div>

                    {state.stage === 1 && renderStage1()}
                    {state.stage === 2 && renderStage2()}
                    {state.stage === 3 && renderStage3()}
                    {state.stage === 4 && renderStage4()}
                </>
            )}

            {confirmProgression && (
                <ActionDialog
                    title="Confirm Progression"
                    message="Progress only if next-morning pain (or pain-provocation) is <= 3/10 and function is improving. Proceed?"
                    onCancel={() => setConfirmProgression(null)}
                    buttons={[{ text: 'Yes, Progress', className: 'bg-green-600 hover:bg-green-700', onClick: confirmProgress }]}
                />
            )}
        </div>
    );
}


