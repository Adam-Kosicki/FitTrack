const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Simple auth via shared secret header to keep the endpoint private to you
function assertAuthorized(req) {
    const provided = req.header('x-health-secret');
    const expected = functions.config().health && functions.config().health.secret;
    if (!expected) {
        throw new Error('Missing functions config health.secret');
    }
    if (!provided || provided !== expected) {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
    }
}

exports.ingestHealth = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }
    try {
        assertAuthorized(req);
    } catch (e) {
        return res.status(e.status || 500).send(e.message);
    }

    const body = req.body || {};
    const userId = body.userId;
    const samples = Array.isArray(body.samples) ? body.samples : [];
    if (!userId || samples.length === 0) {
        return res.status(400).json({ error: 'userId and samples required' });
    }

    const appId = 'default-app-id'; // match src/constants.js default; adjust if you set __app_id

    const batch = db.batch();
    let latestHeartRate = null;

    for (const sample of samples) {
        if (sample.type === 'heart_rate') {
            const ts = sample.timestamp ? new Date(sample.timestamp) : new Date();
            const bpm = Number(sample.bpm);
            if (!Number.isFinite(bpm)) continue;
            const docRef = db.doc(`artifacts/${appId}/users/${userId}/health/heartRate/entries/${ts.getTime()}`);
            batch.set(docRef, {
                bpm,
                timestamp: ts.toISOString(),
                source: sample.source || 'shortcut',
                receivedAt: new Date().toISOString(),
            }, { merge: true });

            if (!latestHeartRate || ts > latestHeartRate.ts) {
                latestHeartRate = { ts, bpm, source: sample.source || 'shortcut' };
            }
        }
    }

    if (latestHeartRate) {
        const latestRef = db.doc(`artifacts/${appId}/users/${userId}/health/heartRateLatest`);
        batch.set(latestRef, {
            bpm: latestHeartRate.bpm,
            timestamp: latestHeartRate.ts.toISOString(),
            source: latestHeartRate.source,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    }

    await batch.commit();
    return res.json({ ok: true, ingested: samples.length, latest: latestHeartRate ? latestHeartRate.bpm : null });
});


