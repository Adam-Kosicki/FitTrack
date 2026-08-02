import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { appId } from '../constants';
import { TrashIcon, BookOpenIcon } from '../components/Icons';
import { useNotification } from '../context/NotificationContext';
import { ConfirmationDialog } from '../components/UI';

const MEASUREMENT_GUIDE = [
    {
        title: "1. Neck",
        method: "Wrap the measuring tape around the neck, just below the Adam’s apple.",
        rule: "Place two fingers flat against the skin directly underneath the tape. This ensures the measurement has enough breathing room built in so a buttoned collar won't choke you."
    },
    {
        title: "2. Chest (Upper & Nipple)",
        method: "Wrap the tape under the armpits and straight across the widest part of the chest, directly over the nipples.",
        rule: "Stand in front of a mirror to verify the tape is perfectly level across the back. Stand with relaxed posture, exhale completely normally, and take the number."
    },
    {
        title: "3. Shoulders (The Sticky Note Wall Hack)",
        method: "Because reaching across your own back warps the tape, stand completely flat against a bare wall with your heels, butt, and shoulders touching it.",
        rule: "Reach across your body and place a sticky note on the wall exactly where the outermost bony bump of each shoulder (the AC joint) touches the wall. Step away and measure the straight distance between the inside edges of the two notes."
    },
    {
        title: "4. Biceps (Relaxed & Flexed)",
        method: "Bend the arm to a 90-degree angle and flex hard (or let hang completely relaxed for relaxed metric).",
        rule: "Wrap the tape around the absolute highest peak of the flexed muscle. Track flexed to capture gym progress and relaxed for baseline."
    },
    {
        title: "5. Sleeve Length (The Two-Step Addition)",
        method: "Must be done on a bent arm to ensure shirt sleeves don't ride up when moving.",
        rule: "Break it into two parts. First, measure from the prominent bone at the back center of the neck (C7 vertebra) to the outer shoulder bone (e.g. 8.5\"). Second, place your hand on your hip to bend the arm at 90 degrees. Measure from that outer shoulder bone, down over the point of the elbow, to about one inch past the wrist bone (e.g. 23.5\"). Add them together."
    },
    {
        title: "6. True Waist (At Belly Button)",
        method: "Wrap the tape around the torso directly at or slightly above the belly button.",
        rule: "Keep the tape parallel to the floor, do not suck the stomach in, and stand relaxed. This tracks core mass and fat loss."
    },
    {
        title: "7. Trouser Waist (Hip Bones)",
        method: "Wrap the tape lower down, directly around the hip bones where a belt naturally sits.",
        rule: "Slide one finger under the tape for breathing room. This is the measurement used to dictate clothing sizes."
    },
    {
        title: "8. Hips / Seat",
        method: "Stand perfectly straight with your feet close together.",
        rule: "Wrap the tape around the absolute widest, most protruding part of the glutes. Keep it parallel to the floor."
    },
    {
        title: "9. Thighs (Upper & Lower)",
        method: "Stand with feet slightly apart and body weight distributed evenly across both legs.",
        rule: "For Upper Thigh: wrap tape around thickest part of leg (1-2 inches below crotch). For Lower Thigh: measure exactly 4 inches above the top of the kneecap."
    },
    {
        title: "10. Calves",
        method: "Sit down on a chair or bench with the foot planted flat on the floor, creating a 90-degree angle at the knee.",
        rule: "Wrap the tape around the thickest, widest part of the calf muscle."
    },
    {
        title: "11. Inseam (The Garment Hack)",
        method: "Measuring this on your own body is highly inaccurate. Instead, take your best-fitting pair of pants that break cleanly at the shoe.",
        rule: "Lay pants completely flat on the floor. Fold the top leg out of the way. Measure the bottom leg's inside seam starting exactly from the crotch seam intersection straight down to the very edge of the ankle hem."
    }
];

export function BodyMeasurementsView({ userId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const { showNotification } = useNotification();

    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        neck: '',
        shoulders: '',
        bicepLeftRelaxed: '',
        bicepLeftFlexed: '',
        bicepRightRelaxed: '',
        bicepRightFlexed: '',
        upperChest: '',
        chestNipple: '',
        sleeveLength: '',
        trueWaist: '',
        trouserWaist: '',
        hipsSeat: '',
        upperThighLeft: '',
        upperThighRight: '',
        lowerThighLeft: '',
        lowerThighRight: '',
        calfLeft: '',
        calfRight: '',
        inseam: '',
        bodyWeight: '',
        restingHeartRate: '',
        gripStrengthLeft: '',
        gripStrengthRight: '',
        notes: ''
    });

    useEffect(() => {
        if (!userId) {
            setRecords([]);
            setLoading(false);
            return;
        }

        const ref = collection(db, `artifacts/${appId}/users/${userId}/bodyMeasurements`);
        const q = query(ref, orderBy('date', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setRecords(data);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching body measurements:', err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const handleInputChange = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
    };

    const handleSaveRecord = async (e) => {
        e.preventDefault();
        if (!userId) return;

        try {
            const numericFields = [
                'neck', 'shoulders', 'bicepLeftRelaxed', 'bicepLeftFlexed', 'bicepRightRelaxed', 'bicepRightFlexed',
                'upperChest', 'chestNipple', 'sleeveLength', 'trueWaist', 'trouserWaist', 'hipsSeat',
                'upperThighLeft', 'upperThighRight', 'lowerThighLeft', 'lowerThighRight', 'calfLeft', 'calfRight',
                'inseam', 'bodyWeight', 'restingHeartRate', 'gripStrengthLeft', 'gripStrengthRight'
            ];

            const payload = {
                date: form.date || new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp(),
                notes: form.notes || ''
            };

            numericFields.forEach(f => {
                payload[f] = form[f] !== '' ? parseFloat(form[f]) : null;
            });

            const ref = collection(db, `artifacts/${appId}/users/${userId}/bodyMeasurements`);
            await addDoc(ref, payload);
            showNotification('Body measurements saved successfully!', 'success');

            // Reset form except date
            setForm({
                date: new Date().toISOString().split('T')[0],
                neck: '', shoulders: '', bicepLeftRelaxed: '', bicepLeftFlexed: '', bicepRightRelaxed: '', bicepRightFlexed: '',
                upperChest: '', chestNipple: '', sleeveLength: '', trueWaist: '', trouserWaist: '', hipsSeat: '',
                upperThighLeft: '', upperThighRight: '', lowerThighLeft: '', lowerThighRight: '', calfLeft: '', calfRight: '',
                inseam: '', bodyWeight: '', restingHeartRate: '', gripStrengthLeft: '', gripStrengthRight: '', notes: ''
            });
        } catch (err) {
            console.error('Error saving measurement:', err);
            showNotification('Failed to save body measurements.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/bodyMeasurements`, deletingId));
            showNotification('Measurement record deleted.', 'success');
        } catch (err) {
            console.error('Failed to delete measurement:', err);
            showNotification('Failed to delete record.', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDiff = (curr, prev) => {
        if (curr === null || curr === undefined || prev === null || prev === undefined) return null;
        const diff = (Number(curr) - Number(prev)).toFixed(1);
        if (diff === '0.0') return <span className="text-gray-400 font-mono text-xs">(0)</span>;
        const isPos = Number(diff) > 0;
        return (
            <span className={`font-mono text-xs font-bold ${isPos ? 'text-green-400' : 'text-amber-400'}`}>
                ({isPos ? '+' : ''}{diff})
            </span>
        );
    };

    if (loading) return <div className="bg-gray-800 p-6 rounded-lg text-white">Loading body measurements...</div>;

    return (
        <div className="bg-gray-800 p-6 rounded-lg space-y-6 text-gray-100">
            {deletingId && (
                <ConfirmationDialog
                    message="Are you sure you want to delete this measurement log?"
                    onConfirm={handleDelete}
                    onCancel={() => setDeletingId(null)}
                />
            )}

            {/* Header & Guide Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        📏 Basic Health Data & Body Measurements
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Track physical growth, circumference changes, and baseline vitals over time with standardized accuracy.
                    </p>
                </div>
                <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 text-sm transition-colors shadow-lg"
                >
                    <BookOpenIcon className="w-5 h-5" />
                    {showGuide ? 'Hide Methodology Guide' : 'Measurement Methodology Guide'}
                </button>
            </div>

            {/* Measurement Methodology Guide Banner */}
            {showGuide && (
                <div className="bg-gray-900 border border-indigo-500/50 p-6 rounded-xl space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                        <h2 className="text-xl font-bold text-indigo-300 flex items-center gap-2">
                            <span>📋</span> Standardized Measurement Protocol & Hacks
                        </h2>
                        <span className="text-xs text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full font-mono border border-indigo-700">
                            Eliminating Skewed Numbers
                        </span>
                    </div>
                    <p className="text-xs text-gray-300">
                        Doing measurements solo often skews results. Follow these exact workarounds (Sticky Note Wall Hack, Two-Finger Rule, Garment Hack) to guarantee consistent readings every time:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MEASUREMENT_GUIDE.map((item, idx) => (
                            <div key={idx} className="bg-gray-800/80 p-4 rounded-lg border border-gray-700 space-y-1">
                                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                                    {item.title}
                                </h4>
                                <p className="text-xs text-gray-300"><span className="font-semibold text-gray-400">Method:</span> {item.method}</p>
                                <p className="text-xs text-indigo-200"><span className="font-semibold text-indigo-400">The Rule:</span> {item.rule}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Form Input Section */}
            <form onSubmit={handleSaveRecord} className="bg-gray-900 p-5 rounded-xl border border-gray-700 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        ✍️ Log New Baseline Entry
                    </h3>
                    <input
                        type="date"
                        value={form.date}
                        onChange={e => handleInputChange('date', e.target.value)}
                        className="bg-gray-800 text-white border border-gray-700 p-2 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                </div>

                {/* Grid Category 1: Upper Body */}
                <div className="space-y-2">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">1. Upper Body (Inches)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        <div>
                            <label className="text-xs text-gray-400 block">Neck</label>
                            <input type="number" step="0.1" value={form.neck} onChange={e => handleInputChange('neck', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Shoulders (Widest)</label>
                            <input type="number" step="0.1" value={form.shoulders} onChange={e => handleInputChange('shoulders', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Upper Chest (Armpit)</label>
                            <input type="number" step="0.1" value={form.upperChest} onChange={e => handleInputChange('upperChest', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Chest (Nipple)</label>
                            <input type="number" step="0.1" value={form.chestNipple} onChange={e => handleInputChange('chestNipple', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Sleeve Length</label>
                            <input type="number" step="0.1" value={form.sleeveLength} onChange={e => handleInputChange('sleeveLength', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                    </div>
                </div>

                {/* Arms */}
                <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">2. Arms (Relaxed vs. Flexed)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-gray-400 block">Left Bicep (Relaxed)</label>
                            <input type="number" step="0.1" value={form.bicepLeftRelaxed} onChange={e => handleInputChange('bicepLeftRelaxed', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Left Bicep (Flexed Peak)</label>
                            <input type="number" step="0.1" value={form.bicepLeftFlexed} onChange={e => handleInputChange('bicepLeftFlexed', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Right Bicep (Relaxed)</label>
                            <input type="number" step="0.1" value={form.bicepRightRelaxed} onChange={e => handleInputChange('bicepRightRelaxed', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Right Bicep (Flexed Peak)</label>
                            <input type="number" step="0.1" value={form.bicepRightFlexed} onChange={e => handleInputChange('bicepRightFlexed', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                    </div>
                </div>

                {/* Waist & Hips */}
                <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">3. Waist, Hips & Inseam</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-gray-400 block">True Waist (Belly Button)</label>
                            <input type="number" step="0.1" value={form.trueWaist} onChange={e => handleInputChange('trueWaist', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Trouser Waist (Hip Bones)</label>
                            <input type="number" step="0.1" value={form.trouserWaist} onChange={e => handleInputChange('trouserWaist', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Hips / Seat (Widest)</label>
                            <input type="number" step="0.1" value={form.hipsSeat} onChange={e => handleInputChange('hipsSeat', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Inseam (Garment Hack)</label>
                            <input type="number" step="0.1" value={form.inseam} onChange={e => handleInputChange('inseam', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                    </div>
                </div>

                {/* Lower Body */}
                <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block">4. Lower Body (Thighs & Calves)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        <div>
                            <label className="text-xs text-gray-400 block">Upper Thigh (L)</label>
                            <input type="number" step="0.1" value={form.upperThighLeft} onChange={e => handleInputChange('upperThighLeft', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Upper Thigh (R)</label>
                            <input type="number" step="0.1" value={form.upperThighRight} onChange={e => handleInputChange('upperThighRight', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Lower Thigh L (4" Knee)</label>
                            <input type="number" step="0.1" value={form.lowerThighLeft} onChange={e => handleInputChange('lowerThighLeft', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Lower Thigh R (4" Knee)</label>
                            <input type="number" step="0.1" value={form.lowerThighRight} onChange={e => handleInputChange('lowerThighRight', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Calf (L)</label>
                            <input type="number" step="0.1" value={form.calfLeft} onChange={e => handleInputChange('calfLeft', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Calf (R)</label>
                            <input type="number" step="0.1" value={form.calfRight} onChange={e => handleInputChange('calfRight', e.target.value)} placeholder="in" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                    </div>
                </div>

                {/* Vitals & Grip */}
                <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">5. Vitals & Performance Measurements</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-gray-400 block">Body Weight (lbs)</label>
                            <input type="number" step="0.1" value={form.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} placeholder="lbs" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Resting HR (early AM bpm)</label>
                            <input type="number" step="1" value={form.restingHeartRate} onChange={e => handleInputChange('restingHeartRate', e.target.value)} placeholder="bpm" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Grip Strength Left</label>
                            <input type="number" step="0.5" value={form.gripStrengthLeft} onChange={e => handleInputChange('gripStrengthLeft', e.target.value)} placeholder="lbs" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block">Grip Strength Right</label>
                            <input type="number" step="0.5" value={form.gripStrengthRight} onChange={e => handleInputChange('gripStrengthRight', e.target.value)} placeholder="lbs" className="w-full bg-gray-800 p-2 rounded text-sm text-white mt-1 border border-gray-700" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <input
                        type="text"
                        value={form.notes}
                        onChange={e => handleInputChange('notes', e.target.value)}
                        placeholder="Optional notes (e.g., morning baseline post-deload)..."
                        className="bg-gray-800 p-2 rounded text-sm text-white border border-gray-700 w-2/3"
                    />
                    <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-lg"
                    >
                        Save Measurement Entry
                    </button>
                </div>
            </form>

            {/* Historical Measurement Logs Table */}
            <div className="bg-gray-900 p-5 rounded-xl border border-gray-700 space-y-4">
                <h3 className="text-xl font-bold text-white">📊 Historical Body Measurement Logs ({records.length})</h3>

                {records.length === 0 ? (
                    <p className="text-gray-400 text-sm">No body measurements recorded yet. Fill out the form above to start tracking physical growth!</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wider">
                                    <th className="p-2 min-w-[90px]">Date</th>
                                    <th className="p-2">Weight</th>
                                    <th className="p-2">Rest HR</th>
                                    <th className="p-2">Neck</th>
                                    <th className="p-2">Shoulders</th>
                                    <th className="p-2">Chest (Nip)</th>
                                    <th className="p-2">True Waist</th>
                                    <th className="p-2">Trouser Waist</th>
                                    <th className="p-2">Hips</th>
                                    <th className="p-2">Bicep L (Flx)</th>
                                    <th className="p-2">Bicep R (Flx)</th>
                                    <th className="p-2">Thigh L (Up)</th>
                                    <th className="p-2">Thigh R (Up)</th>
                                    <th className="p-2">Calf L</th>
                                    <th className="p-2">Calf R</th>
                                    <th className="p-2">Grip (L/R)</th>
                                    <th className="p-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {records.map((rec, idx) => {
                                    const prev = records[idx + 1];
                                    return (
                                        <tr key={rec.id} className="hover:bg-gray-800/60 transition-colors">
                                            <td className="p-2 font-bold text-indigo-300 whitespace-nowrap">{rec.date}</td>
                                            <td className="p-2">{rec.bodyWeight ? `${rec.bodyWeight} lbs` : '--'} {formatDiff(rec.bodyWeight, prev?.bodyWeight)}</td>
                                            <td className="p-2">{rec.restingHeartRate ? `${rec.restingHeartRate} bpm` : '--'} {formatDiff(rec.restingHeartRate, prev?.restingHeartRate)}</td>
                                            <td className="p-2">{rec.neck ? `${rec.neck}"` : '--'} {formatDiff(rec.neck, prev?.neck)}</td>
                                            <td className="p-2">{rec.shoulders ? `${rec.shoulders}"` : '--'} {formatDiff(rec.shoulders, prev?.shoulders)}</td>
                                            <td className="p-2">{rec.chestNipple ? `${rec.chestNipple}"` : '--'} {formatDiff(rec.chestNipple, prev?.chestNipple)}</td>
                                            <td className="p-2">{rec.trueWaist ? `${rec.trueWaist}"` : '--'} {formatDiff(rec.trueWaist, prev?.trueWaist)}</td>
                                            <td className="p-2">{rec.trouserWaist ? `${rec.trouserWaist}"` : '--'} {formatDiff(rec.trouserWaist, prev?.trouserWaist)}</td>
                                            <td className="p-2">{rec.hipsSeat ? `${rec.hipsSeat}"` : '--'} {formatDiff(rec.hipsSeat, prev?.hipsSeat)}</td>
                                            <td className="p-2">{rec.bicepLeftFlexed ? `${rec.bicepLeftFlexed}"` : '--'} {formatDiff(rec.bicepLeftFlexed, prev?.bicepLeftFlexed)}</td>
                                            <td className="p-2">{rec.bicepRightFlexed ? `${rec.bicepRightFlexed}"` : '--'} {formatDiff(rec.bicepRightFlexed, prev?.bicepRightFlexed)}</td>
                                            <td className="p-2">{rec.upperThighLeft ? `${rec.upperThighLeft}"` : '--'} {formatDiff(rec.upperThighLeft, prev?.upperThighLeft)}</td>
                                            <td className="p-2">{rec.upperThighRight ? `${rec.upperThighRight}"` : '--'} {formatDiff(rec.upperThighRight, prev?.upperThighRight)}</td>
                                            <td className="p-2">{rec.calfLeft ? `${rec.calfLeft}"` : '--'} {formatDiff(rec.calfLeft, prev?.calfLeft)}</td>
                                            <td className="p-2">{rec.calfRight ? `${rec.calfRight}"` : '--'} {formatDiff(rec.calfRight, prev?.calfRight)}</td>
                                            <td className="p-2">
                                                {rec.gripStrengthLeft || rec.gripStrengthRight ? `${rec.gripStrengthLeft || 0}/${rec.gripStrengthRight || 0} lbs` : '--'}
                                            </td>
                                            <td className="p-2 text-right">
                                                <button onClick={() => setDeletingId(rec.id)} className="text-red-400 hover:text-red-300 p-1" title="Delete Entry">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
