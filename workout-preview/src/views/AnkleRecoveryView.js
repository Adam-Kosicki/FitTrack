import React, { useMemo, useState, useEffect } from 'react';
import { BookOpenIcon } from '../components/Icons';
import { ankleRecoveryTranscript } from '../data/ankleRecoveryTranscript';

export function AnkleRecoveryView() {
    const [tab, setTab] = useState('guide');
    const [selectedImageSrc, setSelectedImageSrc] = useState(null);
    const [selectedImageAlt, setSelectedImageAlt] = useState('');

    const YT_BASE = 'https://youtu.be/mr0YhNAc4a8';

    const timeToSeconds = (hhmmss) => {
        const [hh, mm, ss] = hhmmss.split(':').map((v) => parseInt(v, 10) || 0);
        return hh * 3600 + mm * 60 + ss;
    };

    const TimeLink = ({ time }) => {
        const seconds = timeToSeconds(time);
    return (
            <a
                href={`${YT_BASE}?t=${seconds}`}
                target="_blank"
                rel="noreferrer"
                className="underline text-indigo-400"
            >
                [{time}]
            </a>
        );
    };

    const TimeSpan = ({ start, end }) => (
        <span className="text-gray-400">
            <TimeLink time={start} />{end ? <span>–<TimeLink time={end} /></span> : null}
        </span>
    );

    const openImage = (src, alt = '') => {
        setSelectedImageSrc(src);
        setSelectedImageAlt(alt || '');
    };

    const closeImage = () => setSelectedImageSrc(null);

    useEffect(() => {
        if (!selectedImageSrc) return;
        const onKey = (e) => {
            if (e.key === 'Escape') closeImage();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedImageSrc]);

    const Section = ({ title, children }) => (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">{title}</h2>
            <div className="text-gray-300 text-sm space-y-2">{children}</div>
        </div>
    );

    const header = useMemo(() => (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
                <BookOpenIcon className="h-8 w-8 text-indigo-400" />
                <div>
                    <h1 className="text-2xl font-bold">Chronic Ankle Instability (CAI)</h1>
                    <p className="text-gray-400 text-sm">Rehab and prevention guide derived from transcript and blog</p>
                    <p className="text-gray-500 text-xs">By Marc Surdyka — August 29, 2021</p>
                </div>
            </div>
            <div className="flex items-center space-x-2 text-sm">
                <a
                    className="px-3 py-1 rounded bg-gray-800 underline text-indigo-300"
                    href={`${YT_BASE}`}
                    target="_blank"
                    rel="noreferrer"
                >Source video</a>
                <a
                    className="px-3 py-1 rounded bg-gray-800 underline text-indigo-300"
                    href={`https://e3rehab.com/cai/`}
                    target="_blank"
                    rel="noreferrer"
                >Source blog</a>
                <button className={`px-3 py-1 rounded ${tab==='guide'?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setTab('guide')}>Guide</button>
                <button className={`px-3 py-1 rounded ${tab==='weekly'?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setTab('weekly')}>Weekly Plan</button>
                <button className={`px-3 py-1 rounded ${tab==='transcript'?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setTab('transcript')}>Transcript</button>
                <button className={`px-3 py-1 rounded ${tab==='resources'?'bg-indigo-600':'bg-gray-800'}`} onClick={()=>setTab('resources')}>Resources</button>
            </div>
        </div>
    ), [tab]);

    const Guide = () => (
        <div className="space-y-4">
            <Section title="Overview">
                <img onClick={()=>openImage('/e3_images/image copy 19.png','Chronic Ankle Instability overview')} src="/e3_images/image copy 19.png" alt="Chronic Ankle Instability overview" className="rounded mb-3 border border-gray-700 cursor-zoom-in" />
                <p className="text-gray-300">Do you have lingering issues from an old ankle sprain? Are you confident in your ability to quickly hop back and forth? How’s your dynamic balance? Can you perform both of these tests on your injured side just as well as your uninjured side? This guide summarizes evidence-based progressions for chronic ankle instability (CAI) and how to put them into a simple weekly plan.</p>
                <div className="mt-2 text-sm">
                    <a className="underline text-indigo-400" href="https://e3rehab.com/programs/" target="_blank" rel="noreferrer">Check out the Ankle Resilience program</a>
                </div>
            </Section>

            <Section title="What CAI Is">
                <p>
                    Defined as: “repetitive episodes or perceptions of the ankle giving way, ongoing symptoms such as pain, weakness, or reduced ankle range of motion… and recurrent ankle sprains that persist for more than one year after the initial injury” <TimeSpan start="00:00:25" end="00:00:45" />.
                </p>
                <p>
                    Most often follows a lateral ankle sprain affecting the ATFL or CFL ligaments <TimeSpan start="00:00:46" end="00:01:01" />.
                </p>
                <p>~40% of first-time sprains lead to CAI <TimeSpan start="00:01:03" end="00:01:13" />.</p>
            </Section>

            <Section title="Common Deficits in CAI">
                <ul className="list-disc list-inside space-y-1">
                    <li>Reduced ankle dorsiflexion</li>
                    <li>Decreased ankle/foot strength; proximal weakness</li>
                    <li>Biomechanical alterations with gait/landing/cutting</li>
                    <li>Delayed peroneal reaction time</li>
                    <li>Diminished plantar sensation and increased reliance on visual information</li>
                    <li>Impaired stability and proprioception <TimeSpan start="00:01:36" end="00:02:01" /></li>
                    <li>Decreased spinal reflex excitability in soleus and peroneus longus</li>
                </ul>
            </Section>

            <Section title="1) Plyometrics">
                <img onClick={()=>openImage('/e3_images/image.png','Plyometric double-leg hops')} src="/e3_images/image.png" alt="Plyometric double-leg hops" className="rounded mb-3 border border-gray-700 cursor-zoom-in" />
                <div>
                    <p className="font-semibold">Progression A</p>
                    <ul className="list-disc list-inside">
                        <li>Hop in place, 3×30s → forward/backward → side‑to‑side → repeat single‑leg <TimeSpan start="00:02:33" end="00:02:53" /></li>
                    </ul>
                </div>
                <div>
                    <p className="font-semibold">Progression B</p>
                    <ul className="list-disc list-inside">
                        <li>Jump up and land on two legs — 3×8 → one‑to‑two → one‑to‑one — 3×6. Stick the landing <TimeSpan start="00:02:55" end="00:03:11" /></li>
                    </ul>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <img onClick={()=>openImage('/e3_images/image copy 2.png','Forward/backward hops')} src="/e3_images/image copy 2.png" alt="Forward/backward hops" className="rounded border border-gray-700 cursor-zoom-in" />
                    <img onClick={()=>openImage('/e3_images/image copy 3.png','Side-to-side hops')} src="/e3_images/image copy 3.png" alt="Side-to-side hops" className="rounded border border-gray-700 cursor-zoom-in" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <img onClick={()=>openImage('/e3_images/image copy 16.png','Diagonal hops')} src="/e3_images/image copy 16.png" alt="Diagonal hops" className="rounded border border-gray-700 cursor-zoom-in" />
                    <img onClick={()=>openImage('/e3_images/image copy 17.png','Single-leg landing stick')} src="/e3_images/image copy 17.png" alt="Single-leg landing stick" className="rounded border border-gray-700 cursor-zoom-in" />
                </div>
            </Section>

            <Section title="2) Strength">
                <img onClick={()=>openImage('/e3_images/image copy 4.png','Single-leg RDL')} src="/e3_images/image copy 4.png" alt="Single-leg RDL" className="rounded mb-3 border border-gray-700 cursor-zoom-in" />
                <div>
                    <p className="font-semibold">Option A — Single‑Leg RDL</p>
                    <p>Assisted → unassisted → dumbbell in opposite hand. 3–4×6–12 reps <TimeSpan start="00:03:29" end="00:03:43" /></p>
                </div>
                <div>
                    <p className="font-semibold">Option B — Lateral Step Down</p>
                    <p>Start low, increase height. 3–4×6–12 reps <TimeSpan start="00:03:47" end="00:03:59" /></p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <img onClick={()=>openImage('/e3_images/image copy 5.png','Lateral step down - low step')} src="/e3_images/image copy 5.png" alt="Lateral step down - low step" className="rounded border border-gray-700 cursor-zoom-in" />
                    <img onClick={()=>openImage('/e3_images/image copy 6.png','Lateral step down - progression')} src="/e3_images/image copy 6.png" alt="Lateral step down - progression" className="rounded border border-gray-700 cursor-zoom-in" />
                </div>
                <p className="mt-3 text-xs text-gray-400">Note: Do NOT stand on an unstable surface for these strength exercises.</p>
            </Section>

            <Section title="3) Dynamic Balance">
                <img onClick={()=>openImage('/e3_images/image copy 7.png','Clock taps - foot reaches')} src="/e3_images/image copy 7.png" alt="Clock taps - foot reaches" className="rounded mb-3 border border-gray-700 cursor-zoom-in" />
                <div>
                    <p className="font-semibold">Option A — Foot Reaches (Modified Y Balance)</p>
                    <p>Standing on one leg, tap targets (e.g., 1:30, 3:00, 4:30). 3×30–60s <TimeSpan start="00:04:14" end="00:04:40" /></p>
                </div>
                <div>
                    <p className="font-semibold">Option B — Hand Reaches (3‑Way RDL)</p>
                    <p>Reach for 10:30, 12:00, 1:30 <TimeSpan start="00:04:42" end="00:04:51" /></p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <img onClick={()=>openImage('/e3_images/image copy 8.png','Hand reaches - 3 way RDL')} src="/e3_images/image copy 8.png" alt="Hand reaches - 3 way RDL" className="rounded border border-gray-700 cursor-zoom-in" />
                    <img onClick={()=>openImage('/e3_images/image copy 9.png','Hand reaches - alternate angles')} src="/e3_images/image copy 9.png" alt="Hand reaches - alternate angles" className="rounded border border-gray-700 cursor-zoom-in" />
                </div>
            </Section>

            <Section title="4) Static Balance">
                <img onClick={()=>openImage('/e3_images/image copy 10.png','Single leg stance - eyes open')} src="/e3_images/image copy 10.png" alt="Single leg stance - eyes open" className="rounded mb-3 border border-gray-700 cursor-zoom-in" />
                <p>Eyes open → eyes closed → foam pad → add perturbations.</p>
                <p>Goal: stand on one leg, arms across chest, 3×60s, barefoot on hard floor <TimeSpan start="00:04:57" end="00:05:15" />. Progress without errors (no touch‑downs, no trunk sway, no bracing) <TimeSpan start="00:05:15" end="00:05:32" />.</p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <img onClick={()=>openImage('/e3_images/image copy 11.png','Foam pad progression')} src="/e3_images/image copy 11.png" alt="Foam pad progression" className="rounded border border-gray-700 cursor-zoom-in" />
                    <img onClick={()=>openImage('/e3_images/image copy 12.png','Self-perturbations kettlebell')} src="/e3_images/image copy 12.png" alt="Self-perturbations kettlebell" className="rounded border border-gray-700 cursor-zoom-in" />
                </div>
                <div className="mt-3 bg-gray-900 p-3 rounded text-sm text-gray-300">
                    <p className="font-semibold text-indigo-300 mb-1">Advance only when error‑free:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>No touching down with the opposite limb</li>
                        <li>No excessive trunk motion</li>
                        <li>Arms remain across chest</li>
                        <li>No bracing the non‑stance limb against the stance limb</li>
                    </ul>
                    <p className="text-xs text-gray-400 mt-2">Expect to progress faster with eyes open than eyes closed.</p>
                </div>
            </Section>

            <Section title="5) Ankle‑Specific Strength">
                <img onClick={()=>openImage('/e3_images/image copy 13.png','Band eversion setup')} src="/e3_images/image copy 13.png" alt="Band eversion setup" className="rounded mb-3 border border-gray-700 cursor-zoom-in" />
                <ul className="list-disc list-inside space-y-1">
                    <li>Eversion & dorsiflexion with bands — work to 3×25 <TimeSpan start="00:06:08" end="00:06:45" /></li>
                    <li>Heel raises: double → single flat → single step → add weight; 3–4×6–12, slow tempo, full ROM <TimeSpan start="00:06:48" end="00:07:07" /></li>
                </ul>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <img onClick={()=>openImage('/e3_images/image copy 14.png','Dorsiflexion band setup')} src="/e3_images/image copy 14.png" alt="Dorsiflexion band setup" className="rounded border border-gray-700 cursor-zoom-in" />
                    <img onClick={()=>openImage('/e3_images/image copy 15.png','Weighted single-leg heel raise')} src="/e3_images/image copy 15.png" alt="Weighted single-leg heel raise" className="rounded border border-gray-700 cursor-zoom-in" />
                </div>
            </Section>

            <Section title="Walking">
                <img onClick={()=>openImage('/e3_images/image copy 18.png','Walking for activity')} src="/e3_images/image copy 18.png" alt="Walking for activity" className="rounded mb-3 border border-gray-700 cursor-zoom-in" />
                <p>Use walking to build a virtuous cycle of activity and function. Increase gradually as tolerated. <TimeSpan start="00:07:58" end="00:08:12" /></p>
                <p className="text-sm text-gray-400">Research notes: Associations reported between BMI/waist circumference and CAI; individuals with CAI take ~2,100 fewer steps/day than controls. Gradual increases in walking can counteract this.</p>
            </Section>

            <Section title="Activity Modifications">
                <p>Competition risk is higher than practice; indoor/court sports have the highest risk. Temporarily modify or reduce participation if struggling with CAI.</p>
                <p className="text-gray-400 text-sm">Based on Swenson 2013 and Doherty 2014.</p>
            </Section>

            <Section title="Bracing">
                <p>Strong evidence supports exercise therapy and bracing to prevent recurrence. Lace‑up ankle braces are preferred and recommended for 6–12 months after a sprain.</p>
            </Section>

            <Section title="Surgery">
                <p>Surgery may be considered if symptoms persist after 3–6 months of non‑surgical care and findings are consistent on exam and imaging. Exhaust conservative care first.</p>
            </Section>

            <Section title="Guidelines, Not Rules">
                <p>These are guidelines. Individualize frequency, intensity, and volume to your history, symptoms, goals, and context. Some will partially progress a few exercises; others can fully progress all.</p>
            </Section>
        </div>
    );

    const Weekly = () => (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Example Weekly Plan</h2>
            <p className="text-gray-400 text-sm mb-2">From transcript summary <TimeSpan start="00:11:13" end="00:12:08" /></p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                    <p className="font-semibold text-indigo-300 mb-1">Mon / Wed / Fri</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Warm‑up: 5–10 min, light sweat.</li>
                        <li>Plyos: single‑leg lateral hopping 3×30s OR single‑leg jump/land 3×6.</li>
                        <li>Strength: single‑leg RDL or lateral step down, 3–4×6–12.</li>
                        <li>Dynamic balance: foot or hand reaches, 3×30–60s.</li>
                        <li>Static balance: foam pad, EO/EC, 3×60s.</li>
                        <li>Heel raises: single‑leg on step with weight, 3–4×6–12.</li>
                        <li>Bands: eversion and dorsiflexion, 3×25.</li>
                    </ol>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                    <p className="font-semibold text-indigo-300 mb-1">Off Days</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Upper body movements</li>
                        <li>Technical sport‑specific skills</li>
                        <li>Cardiovascular conditioning</li>
                    </ul>
                </div>
            </div>
        </div>
    );

    const Transcript = () => (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Transcript</h2>
            <div className="whitespace-pre-wrap text-gray-300 text-sm bg-gray-900 p-3 rounded max-h-[70vh] overflow-y-auto font-mono">
                {ankleRecoveryTranscript.split('\n').map((line, idx) => {
                    const parts = [];
                    const regex = /\[(\d{2}:\d{2}:\d{2})\]/g;
                    let lastIndex = 0;
                    let match;
                    let keyIndex = 0;
                    while ((match = regex.exec(line)) !== null) {
                        const before = line.slice(lastIndex, match.index);
                        if (before) parts.push(<span key={`t-${idx}-${keyIndex++}`}>{before}</span>);
                        parts.push(<TimeLink key={`t-${idx}-${keyIndex++}`} time={match[1]} />);
                        lastIndex = regex.lastIndex;
                    }
                    const after = line.slice(lastIndex);
                    if (after) parts.push(<span key={`t-${idx}-${keyIndex++}`}>{after}</span>);
                    return <div key={idx}>{parts}</div>;
                })}
            </div>
        </div>
    );

    const Resources = () => (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Further Advice & Resources</h2>
            <p className="text-gray-400 text-sm mb-4">Complementary videos and reading that expand on concepts in this guide.</p>
            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-900 p-3 rounded border border-gray-800">
                    <p className="font-semibold text-indigo-300 mb-1">E3 Rehab — Chronic Ankle Instability</p>
                    <a className="underline text-indigo-400" href="https://www.youtube.com/watch?v=ga_OAPf6IOI" target="_blank" rel="noreferrer">Watch on YouTube</a>
                </div>
                <div className="bg-gray-900 p-3 rounded border border-gray-800">
                    <p className="font-semibold text-indigo-300 mb-1">E3 Rehab — Additional Ankle Guidance</p>
                    <a className="underline text-indigo-400" href="https://www.youtube.com/watch?v=S5xKokqeOb4" target="_blank" rel="noreferrer">Watch on YouTube</a>
                </div>
                <div className="bg-gray-900 p-3 rounded border border-gray-800 md:col-span-2">
                    <p className="font-semibold text-indigo-300 mb-1">E3 Rehab — Ankle Dorsiflexion Blog</p>
                    <a className="underline text-indigo-400" href="https://e3rehab.com/ankle-dorsiflexion/" target="_blank" rel="noreferrer">Read the article</a>
                </div>
            </div>
        </div>
    );

    const AdditionalFigures = () => {
        const filenames = [
            'image.png',
            'image copy.png',
            'image copy 2.png',
            'image copy 3.png',
            'image copy 4.png',
            'image copy 5.png',
            'image copy 6.png',
            'image copy 7.png',
            'image copy 8.png',
            'image copy 9.png',
            'image copy 10.png',
            'image copy 11.png',
            'image copy 12.png',
            'image copy 13.png',
            'image copy 14.png',
            'image copy 15.png',
            'image copy 16.png',
            'image copy 17.png',
            'image copy 18.png',
            'image copy 19.png',
        ];
        return (
            <div className="bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-bold mb-2">Additional Figures</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filenames.map((name) => (
                        <div key={name} className="bg-gray-900 p-2 rounded border border-gray-800">
                            <img onClick={()=>openImage(`/e3_images/${name}`, name)} src={`/e3_images/${name}`} alt={name} className="rounded cursor-zoom-in" />
                            <div className="mt-1 text-xs text-gray-500 truncate">{name}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 text-white">
            {header}
            {tab === 'guide' && <Guide />}
            {tab === 'weekly' && <Weekly />}
            {tab === 'transcript' && <Transcript />}
            {tab === 'resources' && <Resources />}
            {(tab !== 'weekly' && tab !== 'resources') && (
                <div className="mt-6">
                    <AdditionalFigures />
                </div>
            )}
            {selectedImageSrc && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={closeImage}>
                    <div className="max-w-6xl max-h-[90vh] p-2" onClick={(e)=>e.stopPropagation()}>
                        <img src={selectedImageSrc} alt={selectedImageAlt} className="max-h-[85vh] max-w-[90vw] rounded shadow-lg" />
                        <div className="text-right mt-2">
                            <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm" onClick={closeImage}>Close (Esc)</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


