import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { appId } from '../constants';

// Fitbit Client ID from environment (configure in .env)
export const DEFAULT_FITBIT_CLIENT_ID = process.env.REACT_APP_FITBIT_CLIENT_ID || '';

/**
 * Generates the Fitbit OAuth 2.0 authorization URL for Implicit Grant flow (Client-side Web Apps).
 */
export function getFitbitAuthUrl(clientId = DEFAULT_FITBIT_CLIENT_ID, redirectUri = window.location.origin) {
  const scopes = encodeURIComponent('activity heartrate profile sleep');
  const encodedRedirect = encodeURIComponent(redirectUri);
  return `https://www.fitbit.com/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=${scopes}&expires_in=604800`;
}

/**
 * Parses URL hash fragments (e.g. #access_token=...&user_id=...) returned by Fitbit OAuth.
 */
export function parseFitbitUrlHash() {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const accessToken = params.get('access_token');
  const userId = params.get('user_id');
  const expiresIn = params.get('expires_in');

  if (accessToken && userId) {
    return { accessToken, userId, expiresIn };
  }
  return null;
}

/**
 * Fetches today's activities and heart rate metrics directly from the Fitbit Web API.
 */
export async function fetchFitbitApiData(accessToken, fitbitUserId = '-') {
  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch daily activity summary (steps, calories, active minutes)
  const activityRes = await fetch(`https://api.fitbit.com/1/user/${fitbitUserId}/activities/date/${today}.json`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!activityRes.ok) {
    const errData = await activityRes.json().catch(() => ({}));
    throw new Error(errData?.errors?.[0]?.message || `Fitbit API error ${activityRes.status}`);
  }

  const activityData = await activityRes.json();

  // 2. Fetch daily heart rate summary
  let avgHeartRate = null;
  try {
    const heartRes = await fetch(`https://api.fitbit.com/1/user/${fitbitUserId}/activities/heart/date/${today}/1d.json`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (heartRes.ok) {
      const heartData = await heartRes.json();
      const resting = heartData?.['activities-heart']?.[0]?.value?.restingHeartRate;
      if (resting) avgHeartRate = resting;
    }
  } catch (_) {
    // Non-critical if heart rate endpoint fails
  }

  const summary = activityData?.summary || {};

  return {
    steps: summary.steps || 0,
    calories: summary.caloriesOut || summary.activityCalories || 0,
    activeMinutes: (summary.veryActiveMinutes || 0) + (summary.fairlyActiveMinutes || 0),
    avgHeartRate,
    lastSynced: new Date().toISOString(),
    provider: 'Fitbit Direct API'
  };
}

/**
 * Saves Fitbit synced data to Firestore.
 */
export async function saveFitbitStatsToFirestore(userId, stats) {
  const docRef = doc(db, `artifacts/${appId}/users/${userId}/health/fitbitLatest`);
  await setDoc(docRef, {
    ...stats,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}
