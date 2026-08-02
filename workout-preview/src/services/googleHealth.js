import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { appId } from '../constants';

// Google Health API v4 Scopes
export const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly'
];

/**
 * Initiates Google OAuth popup requesting Google Health API v4 scopes.
 * Obtains an access token, fetches daily metrics & health vitals, and saves to Firestore.
 */
export async function authenticateAndFetchGoogleHealth(userId) {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized.");
  }

  const provider = new GoogleAuthProvider();
  HEALTH_SCOPES.forEach(scope => provider.addScope(scope));

  // Force scope approval prompt
  provider.setCustomParameters({
    prompt: 'consent'
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error("Could not retrieve OAuth access token from Google sign-in result.");
  }

  // Fetch all metrics using Google Health API v4
  const stats = await fetchGoogleHealthV4Data(accessToken);

  // Save to Firestore
  if (userId && db) {
    await saveHealthStatsToFirestore(userId, stats);
  }

  return { stats, accessToken };
}

/**
 * Queries Google Health API v4 endpoints for full spectrum of health & fitness metrics.
 */
export async function fetchGoogleHealthV4Data(accessToken) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  let steps = 0;
  let calories = 0;
  let activeMinutes = 0;
  let avgHeartRate = null;
  let restingHeartRate = null;
  let hrvMs = null;
  let spo2Percentage = null;
  let respiratoryRate = null;
  let vo2Max = null;
  let distanceMeters = 0;
  let floorsClimbed = 0;
  let weightKg = null;
  let bodyFatPercentage = null;
  let sleepSummary = null;
  let workouts = [];
  let v4Success = false;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayStart = new Date(todayStr + 'T00:00:00').getTime();

  console.log(`[Google Health v4] Fetching full health dataset for ${todayStr}`);

  // Helper: POST dailyRollUp
  async function dailyRollUp(dataType) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const requestBody = {
      range: {
        start: {
          date: { year, month, day },
          time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 }
        },
        end: {
          date: { year, month, day },
          time: { hours: 23, minutes: 59, seconds: 59, nanos: 0 }
        }
      },
      windowSizeDays: 1
    };

    try {
      const res = await fetch(
        `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
        { method: 'POST', headers, body: JSON.stringify(requestBody) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.rollupDataPoints || data.dataPoints || (Array.isArray(data) ? data : []);
    } catch (_) {
      return [];
    }
  }

  // Helper: GET list dataPoints
  async function listDataPoints(dataType) {
    const getHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' };
    try {
      const res = await fetch(
        `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints?pageSize=1000`,
        { method: 'GET', headers: getHeaders }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.dataPoints || (Array.isArray(data) ? data : []);
    } catch (_) {
      return [];
    }
  }

  // Helper to check if record is from today or recent
  function isTodayOrRecent(dpObj) {
    if (!dpObj) return true;
    const timeStr = dpObj.interval?.startTime || dpObj.sampleTime?.physicalTime || dpObj.interval?.civilStartTime;
    if (!timeStr) return true;
    if (typeof timeStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timeStr)) {
      const [y, m, d] = timeStr.split('-').map(Number);
      return y === now.getFullYear() && (m - 1) === now.getMonth() && d === now.getDate();
    }
    const t = new Date(timeStr).getTime();
    if (isNaN(t)) return true;
    return t >= (todayStart - 3600000);
  }

  // 1. Steps — try dailyRollUp for today first, then fallback to most recent steps
  try {
    let stepsPoints = await dailyRollUp('steps');
    if (stepsPoints.length > 0) {
      stepsPoints.forEach(dp => {
        const count = parseInt(dp.steps?.countSum || dp.steps?.count || dp.countSum || dp.count || 0, 10);
        steps += count;
      });
      v4Success = true;
    }
    // If today's dailyRollUp was 0 or empty, retrieve the most recent steps list
    if (steps === 0) {
      stepsPoints = await listDataPoints('steps');
      stepsPoints.forEach(dp => {
        const count = parseInt(dp.steps?.count || dp.steps?.value || dp.count || 0, 10);
        steps += count;
      });
      if (stepsPoints.length > 0) v4Success = true;
    }
  } catch (err) {
    console.warn('[Steps Error]', err);
  }

  // 2. Calories — try dailyRollUp for today first, then fallback to most recent calories
  try {
    const calorieDataTypes = ['active-energy-burned', 'total-calories', 'calories-burned'];

    for (const dt of calorieDataTypes) {
      const rollUpPoints = await dailyRollUp(dt);
      if (rollUpPoints.length > 0) {
        rollUpPoints.forEach(dp => {
          const calObj = dp.activeEnergyBurned || dp.totalCalories || dp.caloriesBurned || dp;
          const val = parseFloat(
            calObj.energy?.value || (typeof calObj.energy === 'number' ? calObj.energy : 0) ||
            calObj.kilocaloriesSum || calObj.energySum || calObj.kilocalories || calObj.value || 0
          );
          calories += val;
        });
        if (calories > 0) break;
      }
    }

    // Fallback to most recent list points if today's rollUp is 0
    if (calories === 0) {
      for (const dt of calorieDataTypes) {
        const listPoints = await listDataPoints(dt);
        listPoints.forEach(dp => {
          const calObj = dp.activeEnergyBurned || dp.totalCalories || dp.caloriesBurned || dp;
          const val = parseFloat(
            calObj.energy?.value || (typeof calObj.energy === 'number' ? calObj.energy : 0) ||
            calObj.kilocalories || calObj.value || 0
          );
          calories += val;
        });
        if (calories > 0) break;
      }
    }
  } catch (err) {
    console.warn('[Calories Error]', err);
  }

  // 3. Active Minutes — try dailyRollUp for today first, then fallback to most recent active minutes
  try {
    const activeDataTypes = ['active-minutes', 'active-zone-minutes'];

    for (const dt of activeDataTypes) {
      const rollUpPoints = await dailyRollUp(dt);
      if (rollUpPoints.length > 0) {
        rollUpPoints.forEach(dp => {
          const actObj = dp.activeMinutes || dp.activeZoneMinutes || dp;
          const count = parseInt(actObj.countSum || actObj.minutesSum || actObj.count || actObj.minutes || 0, 10);
          activeMinutes += count;
        });
        if (activeMinutes > 0) break;
      }
    }

    if (activeMinutes === 0) {
      for (const dt of activeDataTypes) {
        const listPoints = await listDataPoints(dt);
        listPoints.forEach(dp => {
          const actObj = dp.activeMinutes || dp.activeZoneMinutes || dp;
          const count = parseInt(actObj.count || actObj.minutes || actObj.durationMinutes || 0, 10);
          activeMinutes += count;
        });
        if (activeMinutes > 0) break;
      }
    }
  } catch (err) {
    console.warn('[Active Minutes Error]', err);
  }

  // 4. Distance — try dailyRollUp for today first, then fallback to most recent distance
  try {
    const distPoints = await dailyRollUp('distance');
    if (distPoints.length > 0) {
      distPoints.forEach(dp => {
        const distObj = dp.distance || dp;
        const m = parseFloat(
          distObj.distance?.value || (typeof distObj.distance === 'number' ? distObj.distance : 0) ||
          distObj.distanceMetersSum || distObj.distanceMeters || distObj.value || 0
        );
        const mm = parseFloat(distObj.distanceMillimetersSum || distObj.distanceMillimeters || 0);
        distanceMeters += mm > 0 ? (mm / 1000) : m;
      });
    }

    if (distanceMeters === 0) {
      const listDist = await listDataPoints('distance');
      listDist.forEach(dp => {
        const distObj = dp.distance || dp;
        const m = parseFloat(
          distObj.distance?.value || (typeof distObj.distance === 'number' ? distObj.distance : 0) ||
          distObj.distanceMeters || distObj.value || 0
        );
        const mm = parseFloat(distObj.distanceMillimeters || 0);
        distanceMeters += mm > 0 ? (mm / 1000) : m;
      });
    }
  } catch (err) {
    console.warn('[Distance Error]', err);
  }

  // 5. Floors Climbed
  try {
    const floorPoints = await dailyRollUp('floors');
    floorPoints.forEach(dp => {
      floorsClimbed += parseInt(dp.floors?.countSum || dp.floors?.count || dp.countSum || dp.count || 0, 10);
    });
    if (floorsClimbed === 0) {
      const listFloors = await listDataPoints('floors');
      listFloors.forEach(dp => {
        floorsClimbed += parseInt(dp.floors?.count || dp.count || 0, 10);
      });
    }
  } catch (err) {
    console.warn('[Floors Error]', err);
  }

  // 6. Heart Rate (Average of most recent heart rate readings)
  try {
    const hrPoints = await listDataPoints('heart-rate');
    if (hrPoints.length > 0) {
      let hrSum = 0;
      let hrCount = 0;
      // Take up to the last 100 readings available
      const recentPoints = hrPoints.slice(-100);
      recentPoints.forEach(dp => {
        const bpm = parseFloat(dp.heartRate?.beatsPerMinute || dp.heartRate?.bpm || dp.beatsPerMinute || dp.bpm || 0);
        if (bpm > 0) {
          hrSum += bpm;
          hrCount++;
        }
      });
      if (hrCount > 0) avgHeartRate = Math.round(hrSum / hrCount);
    }
  } catch (err) {
    console.warn('[Heart Rate Error]', err);
  }

  // 7. Daily Resting Heart Rate (Most Recent)
  try {
    const rhrPoints = await listDataPoints('daily-resting-heart-rate');
    if (rhrPoints.length > 0) {
      const lastRhr = rhrPoints[rhrPoints.length - 1];
      restingHeartRate = Math.round(parseFloat(lastRhr.dailyRestingHeartRate?.beatsPerMinute || lastRhr.dailyRestingHeartRate?.bpm || lastRhr.bpm || lastRhr.value || 0));
    }
  } catch (err) {
    console.warn('[Resting HR Error]', err);
  }

  // 8. Daily Heart Rate Variability / HRV (Most Recent)
  try {
    const hrvPoints = await listDataPoints('daily-heart-rate-variability');
    if (hrvPoints.length > 0) {
      const lastHrv = hrvPoints[hrvPoints.length - 1];
      hrvMs = Math.round(parseFloat(lastHrv.dailyHeartRateVariability?.rmssdMs || lastHrv.dailyHeartRateVariability?.ms || lastHrv.value || 0));
    }
  } catch (err) {
    console.warn('[HRV Error]', err);
  }

  // 9. Daily Oxygen Saturation / SpO2 (Most Recent)
  try {
    const spo2Points = await listDataPoints('daily-oxygen-saturation');
    if (spo2Points.length > 0) {
      const lastSpo2 = spo2Points[spo2Points.length - 1];
      const val = parseFloat(lastSpo2.dailyOxygenSaturation?.percentage || lastSpo2.percentage || lastSpo2.value || 0);
      if (val > 0) spo2Percentage = Math.round(val > 1 ? val : val * 100);
    }
  } catch (err) {
    console.warn('[SpO2 Error]', err);
  }

  // 10. Daily Respiratory Rate (Most Recent)
  try {
    const respPoints = await listDataPoints('daily-respiratory-rate');
    if (respPoints.length > 0) {
      const lastResp = respPoints[respPoints.length - 1];
      respiratoryRate = parseFloat((lastResp.dailyRespiratoryRate?.breathsPerMinute || lastResp.breathsPerMinute || lastResp.value || 0).toFixed(1));
    }
  } catch (err) {
    console.warn('[Respiratory Rate Error]', err);
  }

  // 11. Daily VO2 Max (Most Recent)
  try {
    const vo2Points = await listDataPoints('daily-vo2-max');
    if (vo2Points.length > 0) {
      const lastVo2 = vo2Points[vo2Points.length - 1];
      vo2Max = parseFloat((lastVo2.dailyVo2Max?.value || lastVo2.vo2Max || lastVo2.value || 0).toFixed(1));
    }
  } catch (err) {
    console.warn('[VO2 Max Error]', err);
  }

  // 12. Weight & Body Fat (Most Recent)
  try {
    const weightPoints = await listDataPoints('weight');
    if (weightPoints.length > 0) {
      const lastW = weightPoints[weightPoints.length - 1];
      weightKg = parseFloat((lastW.weight?.kg || lastW.weight?.kilograms || lastW.kg || lastW.value || 0).toFixed(1));
    }

    const fatPoints = await listDataPoints('body-fat');
    if (fatPoints.length > 0) {
      const lastF = fatPoints[fatPoints.length - 1];
      bodyFatPercentage = parseFloat((lastF.bodyFat?.percentage || lastF.percentage || lastF.value || 0).toFixed(1));
    }
  } catch (err) {
    console.warn('[Weight/Fat Error]', err);
  }

  // 13. Sleep Sessions (Most Recent Main Session)
  try {
    const sleepPoints = await listDataPoints('sleep');
    if (sleepPoints.length > 0) {
      // Sort chronologically by interval end time descending (latest session first)
      const sortedSleep = sleepPoints.sort((a, b) => {
        const endA = a.sleep?.interval?.endTime || a.interval?.endTime || '';
        const endB = b.sleep?.interval?.endTime || b.interval?.endTime || '';
        return new Date(endB).getTime() - new Date(endA).getTime();
      });

      // Prefer main sleep session over nap segments if tagged
      const mainSleep = sortedSleep.find(dp => (dp.sleep || dp).metadata?.main === true) || sortedSleep[0];
      const sleepObj = mainSleep.sleep || mainSleep;
      const summary = sleepObj.summary || {};
      const interval = sleepObj.interval || {};

      let totalMin = 0;
      if (summary.minutesInSleepPeriod) {
        totalMin = parseInt(summary.minutesInSleepPeriod, 10);
      } else if (interval.startTime && interval.endTime) {
        const diffMs = new Date(interval.endTime).getTime() - new Date(interval.startTime).getTime();
        totalMin = Math.round(diffMs / 60000);
      }

      const minutesAsleep = parseInt(summary.minutesAsleep || totalMin || 0, 10);
      const minutesAwake = parseInt(summary.minutesAwake || 0, 10);
      const displayDurationMin = totalMin > 0 ? totalMin : (minutesAsleep + minutesAwake);

      sleepSummary = {
        totalMinutes: displayDurationMin,
        minutesAsleep,
        minutesAwake,
        efficiency: parseInt(summary.efficiency || Math.round((minutesAsleep / (displayDurationMin || 1)) * 100) || 90, 10),
        stages: summary.stagesSummary || []
      };
    }
  } catch (err) {
    console.warn('[Sleep Error]', err);
  }

  // 14. Exercise / Workout Sessions (Most Recent)
  try {
    const exercisePoints = await listDataPoints('exercise');
    // Take the most recent workout sessions recorded
    const recentWorkouts = exercisePoints.slice(-10).reverse();
    recentWorkouts.forEach(dp => {
      const ex = dp.exercise || dp;
      const summary = ex.metricsSummary || {};

      workouts.push({
        name: ex.displayName || ex.exerciseType || 'Workout Session',
        type: ex.exerciseType || 'GENERIC',
        durationSeconds: parseInt(ex.activeDuration?.replace('s', '') || 0, 10),
        calories: parseFloat(summary.caloriesKcal || 0),
        steps: parseInt(summary.steps || 0, 10),
        avgHeartRate: parseInt(summary.averageHeartRateBeatsPerMinute || 0, 10),
        activeZoneMinutes: parseInt(summary.activeZoneMinutes || 0, 10),
        distanceMeters: parseFloat(summary.distanceMillimeters || 0) / 1000
      });

      if (calories === 0 && summary.caloriesKcal) {
        calories += parseFloat(summary.caloriesKcal || 0);
      }
      if (activeMinutes === 0 && summary.activeZoneMinutes) {
        activeMinutes += parseInt(summary.activeZoneMinutes || 0, 10);
      }
    });
  } catch (err) {
    console.warn('[Exercise Error]', err);
  }

  console.log('[Google Health v4 Summary]', { steps, calories, activeMinutes, avgHeartRate, restingHeartRate, spo2Percentage, workouts, v4Success });

  return {
    steps: Math.round(steps),
    calories: Math.round(calories),
    activeMinutes: Math.round(activeMinutes),
    avgHeartRate,
    restingHeartRate,
    hrvMs,
    spo2Percentage,
    respiratoryRate,
    vo2Max,
    distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
    floorsClimbed,
    weightKg,
    bodyFatPercentage,
    sleepSummary,
    workouts,
    lastSynced: new Date().toISOString(),
    provider: 'Google Health API v4'
  };
}

/**
 * Legacy Google Fitness API aggregate endpoint fallback
 */
async function fetchLegacyFitnessFallback(accessToken) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endTime = now.getTime();
  const startTime = (endTime - startOfDay < 6 * 3600 * 1000) ? endTime - (24 * 3600 * 1000) : startOfDay;

  const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [
        { dataTypeName: 'com.google.step_count.delta' },
        { dataTypeName: 'com.google.calories.expended' },
        { dataTypeName: 'com.google.active_minutes' },
        { dataTypeName: 'com.google.heart_rate.bpm' }
      ],
      bucketByTime: { durationMillis: endTime - startTime + 1 },
      startTimeMillis: startTime,
      endTimeMillis: endTime
    })
  });

  if (!response.ok) return null;
  const data = await response.json();

  let steps = 0, calories = 0, activeMinutes = 0, hrSum = 0, hrCount = 0;
  data.bucket?.forEach(b => {
    b.dataset?.forEach((ds, idx) => {
      ds.point?.forEach(p => {
        p.value?.forEach(v => {
          const val = v.intVal || v.fpVal || 0;
          if (idx === 0) steps += val;
          else if (idx === 1) calories += Math.round(val);
          else if (idx === 2) activeMinutes += val;
          else if (idx === 3 && val > 0) { hrSum += val; hrCount++; }
        });
      });
    });
  });

  return {
    steps: Math.round(steps),
    calories: Math.round(calories),
    activeMinutes: Math.round(activeMinutes),
    avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    lastSynced: new Date().toISOString(),
    provider: 'Google Fitness Legacy'
  };
}

/**
 * Saves health stats to Firestore under artifacts/{appId}/users/{userId}/health/googleHealthLatest
 */
export async function saveHealthStatsToFirestore(userId, stats) {
  const docRef = doc(db, `artifacts/${appId}/users/${userId}/health/googleHealthLatest`);
  await setDoc(docRef, {
    ...stats,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}
