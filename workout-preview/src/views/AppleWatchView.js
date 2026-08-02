import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase/firebase';
import { appId } from '../constants';
import { doc, onSnapshot } from 'firebase/firestore';

export function AppleWatchView({ userId }) {
    const [latest, setLatest] = useState(null);
    const [error, setError] = useState(null);

    const latestDocRef = useMemo(() => (
        doc(db, `artifacts/${appId}/users/${userId}/health/heartRateLatest`)
    ), [userId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(latestDocRef, (snap) => {
            if (snap.exists()) {
                setLatest(snap.data());
            } else {
                setLatest(null);
            }
        }, (e) => setError(e.message));
        return () => unsubscribe();
    }, [latestDocRef]);

    // Your Firebase projectId from src/firebase/firebase.js
    const projectId = 'personal-workout-app-1bbf9';
    const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/ingestHealth`;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Apple Watch Integration (No-code via Shortcuts)</h2>
            <p className="text-gray-300">This page shows simple instructions to send your last recorded heart rate from Apple Health to this app using an iOS Shortcut. The data is stored in your private Firestore and shown below.</p>

            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="text-xl font-semibold">Step-by-step (one-time setup on iPhone)</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-200">
                    <li>Open the <span className="font-semibold">Shortcuts</span> app on your iPhone.</li>
                    <li>Create a new Shortcut named <span className="font-semibold">Send Heart Rate to FitTrack</span>.</li>
                    <li>Add action <span className="font-semibold">Get Health Samples</span>:
                        <ul className="list-disc ml-6 mt-1 text-gray-300">
                            <li>Type: <span className="font-semibold">Heart Rate</span></li>
                            <li>Filter: <span className="font-semibold">Most Recent</span> (or Last 1)</li>
                        </ul>
                    </li>
                    <li>Add action <span className="font-semibold">Get Dictionary from</span> the sample with keys you need, e.g. create JSON:
                        <pre className="bg-gray-900 p-3 rounded overflow-auto text-xs whitespace-pre-wrap">{`{
  "userId": "{your Firebase UID}",
  "samples": [
    {"type":"heart_rate","timestamp":"Repeat with sample.startDate","bpm":"Repeat with sample.heartRate"}
  ]
}`}</pre>
                        Tip: You can also use <span className="font-semibold">Get Dictionary</span> → build keys and use Magic Variables from the Health sample.
                    </li>
                    <li>Add action <span className="font-semibold">Get Contents of URL</span>:
                        <ul className="list-disc ml-6 mt-1 text-gray-300">
                            <li>Method: <span className="font-semibold">POST</span></li>
                            <li>URL: <code className="bg-gray-900 px-2 py-1 rounded">{functionUrl}</code></li>
                            <li>Headers: add <code className="bg-gray-900 px-2 py-1 rounded">x-health-secret</code> with your secret value</li>
                            <li>Request Body: <span className="font-semibold">JSON</span> (the dictionary you built above)</li>
                        </ul>
                    </li>
                    <li>Optional: In <span className="font-semibold">Automation</span>, schedule to run daily without asking.</li>
                </ol>

                <p className="text-gray-400 text-sm">Note: You must configure the Cloud Function and set the <code className="bg-gray-900 px-2 py-0.5 rounded">x-health-secret</code> before running the Shortcut (instructions are below).</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="text-xl font-semibold">Cloud Function endpoint</h3>
                <p className="text-gray-200">Endpoint URL:</p>
                <code className="block bg-gray-900 p-3 rounded break-all">{functionUrl}</code>
                <p className="text-gray-400 text-sm">Set your secret with: <code className="bg-gray-900 px-2 py-0.5 rounded">firebase functions:config:set health.secret="YOUR_LONG_RANDOM_SECRET"</code> and deploy.</p>
                <p className="text-gray-400 text-sm">Expected JSON body (example):</p>
                <pre className="bg-gray-900 p-3 rounded overflow-auto text-xs whitespace-pre-wrap">{`{
  "userId": "{your Firebase UID}",
  "samples": [
    {"type":"heart_rate","timestamp":"2025-08-18T17:30:05Z","bpm": 61}
  ]
}`}</pre>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <h3 className="text-xl font-semibold">Latest Heart Rate</h3>
                {error && <p className="text-red-400">{error}</p>}
                {!latest && !error && (
                    <p className="text-gray-300">No heart rate received yet. Run your Shortcut to send the latest value.</p>
                )}
                {latest && (
                    <div className="text-gray-100">
                        <p className="text-3xl font-bold">{latest.bpm} bpm</p>
                        {latest.timestamp && (
                            <p className="text-gray-400 text-sm mt-1">at {new Date(latest.timestamp).toLocaleString()}</p>
                        )}
                        {latest.source && (
                            <p className="text-gray-400 text-sm">source: {latest.source}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


