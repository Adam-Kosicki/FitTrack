import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { appId } from '../constants';
import { authenticateAndFetchGoogleHealth, saveHealthStatsToFirestore } from '../services/googleHealth';
import { getFitbitAuthUrl, parseFitbitUrlHash, fetchFitbitApiData, saveFitbitStatsToFirestore } from '../services/fitbit';

export function GoogleHealthView({ userId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [fitbitClientIdInput, setFitbitClientIdInput] = useState('');
  const [showFitbitModal, setShowFitbitModal] = useState(false);

  // Firestore reference for real-time health sync status
  const healthDocRef = useMemo(() => (
    doc(db, `artifacts/${appId}/users/${userId}/health/googleHealthLatest`)
  ), [userId]);

  // Listen to Firestore updates
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(healthDocRef, (snap) => {
      if (snap.exists()) {
        setStats(snap.data());
      } else {
        setStats(null);
      }
    }, (err) => {
      console.error("Firestore health doc subscription error:", err);
    });
    return () => unsubscribe();
  }, [healthDocRef, userId]);

  // Handle Fitbit OAuth URL redirect token parsing
  useEffect(() => {
    const fitbitHashData = parseFitbitUrlHash();
    if (fitbitHashData && userId) {
      setLoading(true);
      fetchFitbitApiData(fitbitHashData.accessToken, fitbitHashData.userId)
        .then(async (fitbitStats) => {
          setStats(fitbitStats);
          await saveFitbitStatsToFirestore(userId, fitbitStats);
          await saveHealthStatsToFirestore(userId, fitbitStats);
          window.history.replaceState(null, '', window.location.pathname);
        })
        .catch((err) => {
          console.error("Fitbit Sync Failed:", err);
          setError("Fitbit API sync failed: " + err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [userId]);

  const handleConnectAndSyncGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const { stats: fetchedStats } = await authenticateAndFetchGoogleHealth(userId);
      setStats(fetchedStats);
    } catch (err) {
      console.error("Google Health Sync Failed:", err);
      setError(err.message || "Failed to authenticate or fetch Google Health data.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectFitbitDirect = () => {
    const clientId = fitbitClientIdInput.trim() || '23RR99';
    const fitbitUrl = getFitbitAuthUrl(clientId, window.location.origin + window.location.pathname);
    window.location.href = fitbitUrl;
  };

  const handleLoadDemoData = async () => {
    const demoStats = {
      steps: 18518,
      calories: 785,
      activeMinutes: 62,
      avgHeartRate: 105,
      restingHeartRate: 62,
      hrvMs: 48,
      spo2Percentage: 98,
      respiratoryRate: 14.5,
      vo2Max: 44.2,
      distanceKm: 12.8,
      floorsClimbed: 14,
      weightKg: 78.5,
      bodyFatPercentage: 16.4,
      sleepSummary: {
        minutesAsleep: 442,
        minutesAwake: 38,
        efficiency: 92
      },
      workouts: [
        {
          name: "Morning Trail Run",
          type: "RUNNING",
          durationSeconds: 2100,
          calories: 420,
          steps: 5400,
          avgHeartRate: 148,
          activeZoneMinutes: 35,
          distanceMeters: 5.2
        },
        {
          name: "Evening HIIT Workout",
          type: "AEROBIC_WORKOUT",
          durationSeconds: 1620,
          calories: 365,
          steps: 1800,
          avgHeartRate: 132,
          activeZoneMinutes: 27,
          distanceMeters: 0.8
        }
      ],
      lastSynced: new Date().toISOString(),
      isDemo: true,
      provider: 'Google Health API v4 (Demo)'
    };
    try {
      await saveHealthStatsToFirestore(userId, demoStats);
    } catch (err) {
      setStats(demoStats);
    }
  };

  const stepGoal = 10000;
  const currentSteps = stats?.steps || 0;
  const stepPercentage = Math.min(100, Math.round((currentSteps / stepGoal) * 100));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-lg">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Google Health & Fitbit Intelligence Hub</h2>
              <p className="text-sm text-gray-400">Live telemetry, vital signs, sleep, and workout analytics via Google Health API v4.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleConnectAndSyncGoogle}
            disabled={loading}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-sm text-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span>Syncing Telemetry...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{stats ? 'Re-sync Google Health' : 'Connect Google Health'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowFitbitModal(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex items-center space-x-1.5"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z" />
            </svg>
            <span>Fitbit Direct</span>
          </button>

          <button
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium py-2.5 px-3 rounded-lg transition-colors"
          >
            {showSetupGuide ? 'Hide Guide' : 'Setup Guide'}
          </button>
        </div>
      </div>

      {/* Fitbit Direct Modal */}
      {showFitbitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl max-w-md w-full space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-cyan-400">Fitbit OAuth 2.0 Direct Login</span>
            </h3>
            <p className="text-sm text-gray-300">
              Connect directly to the Fitbit Web API for standalone Fitbit accounts.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-semibold block">Fitbit App Client ID:</label>
              <input
                type="text"
                placeholder="23RR99 (Default Dev ID)"
                value={fitbitClientIdInput}
                onChange={(e) => setFitbitClientIdInput(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowFitbitModal(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectFitbitDirect}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm px-5 py-2 rounded-lg"
              >
                Sign In with Fitbit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 p-4 rounded-lg flex items-start space-x-3">
          <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h4 className="font-semibold text-red-300">Sync Error</h4>
            <p className="text-sm text-red-200 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Setup Guide Drawer */}
      {showSetupGuide && (
        <div className="bg-gray-800/90 border border-indigo-500/30 rounded-xl p-5 space-y-4 text-gray-200 text-sm">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="bg-indigo-600 text-xs px-2 py-0.5 rounded font-mono">GCP Config</span>
            Google Health API Scopes
          </h3>
          <p className="text-gray-300 text-xs">Ensure your GCP project has enabled the Google Health API and approved the following scopes in the OAuth Consent Screen:</p>
          <ul className="list-disc ml-5 space-y-1 text-xs font-mono text-indigo-300">
            <li>https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly</li>
            <li>https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly</li>
            <li>https://www.googleapis.com/auth/googlehealth.sleep.readonly</li>
          </ul>
        </div>
      )}

      {/* SECTION 1: Activity & Movement */}
      <div>
        <h3 className="text-sm uppercase tracking-wider font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
          Activity & Movement Telemetry
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Steps Card */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs uppercase tracking-wider font-semibold">Daily Steps</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white">
                {stats ? (stats.steps?.toLocaleString() || '0') : '--'}
              </div>
              <p className="text-xs text-gray-400 mt-1">Goal: {stepGoal.toLocaleString()} steps</p>
            </div>
            <div className="space-y-1">
              <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${stepPercentage}%` }}
                ></div>
              </div>
              <div className="text-right text-[11px] text-emerald-400 font-semibold">{stepPercentage}%</div>
            </div>
          </div>

          {/* Calories Burned Card */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs uppercase tracking-wider font-semibold">Calories Expended</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white">
                {stats ? (stats.calories?.toLocaleString() || '0') : '--'} <span className="text-sm font-normal text-gray-400">kcal</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Active & Total Energy</p>
            </div>
            <div className="text-xs text-amber-400/90 font-medium pt-2 border-t border-gray-700/50">
              active-energy-burned API
            </div>
          </div>

          {/* Active Minutes Card */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs uppercase tracking-wider font-semibold">Active Minutes</span>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white">
                {stats ? `${stats.activeMinutes || 0}` : '--'} <span className="text-sm font-normal text-gray-400">min</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Moderate to intense motion</p>
            </div>
            <div className="text-xs text-blue-400/90 font-medium pt-2 border-t border-gray-700/50">
              active-zone-minutes API
            </div>
          </div>

          {/* Distance Card */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs uppercase tracking-wider font-semibold">Distance</span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white">
                {stats?.distanceKm !== undefined ? stats.distanceKm : '--'} <span className="text-sm font-normal text-gray-400">km</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {stats?.distanceKm ? `~${(stats.distanceKm * 0.621371).toFixed(2)} miles` : 'Traveled today'}
              </p>
            </div>
            <div className="text-xs text-purple-400/90 font-medium pt-2 border-t border-gray-700/50">
              distance API
            </div>
          </div>

          {/* Floors Card */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs uppercase tracking-wider font-semibold">Floors Climbed</span>
              <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white">
                {stats?.floorsClimbed !== undefined ? stats.floorsClimbed : '--'}
              </div>
              <p className="text-xs text-gray-400 mt-1">Elevation gain</p>
            </div>
            <div className="text-xs text-teal-400/90 font-medium pt-2 border-t border-gray-700/50">
              floors API
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Cardiovascular & Vitals */}
      <div>
        <h3 className="text-sm uppercase tracking-wider font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-rose-400 rounded-full"></span>
          Cardiovascular & Health Vitals
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Average Heart Rate */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Avg Heart Rate</span>
            <div className="text-2xl font-bold text-white">
              {stats?.avgHeartRate ? `${stats.avgHeartRate} bpm` : 'N/A'}
            </div>
            <span className="text-[11px] text-rose-400 block font-mono">heart-rate API</span>
          </div>

          {/* Resting Heart Rate */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Resting HR</span>
            <div className="text-2xl font-bold text-white">
              {stats?.restingHeartRate ? `${stats.restingHeartRate} bpm` : 'N/A'}
            </div>
            <span className="text-[11px] text-rose-300 block font-mono">daily-resting-hr</span>
          </div>

          {/* HRV */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Heart Rate Var (HRV)</span>
            <div className="text-2xl font-bold text-white">
              {stats?.hrvMs ? `${stats.hrvMs} ms` : 'N/A'}
            </div>
            <span className="text-[11px] text-indigo-400 block font-mono">daily-hrv API</span>
          </div>

          {/* Oxygen Saturation (SpO2) */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Blood Oxygen (SpO2)</span>
            <div className="text-2xl font-bold text-white">
              {stats?.spo2Percentage ? `${stats.spo2Percentage}%` : 'N/A'}
            </div>
            <span className="text-[11px] text-cyan-400 block font-mono">daily-oxygen-sat</span>
          </div>

          {/* Respiratory Rate */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Respiratory Rate</span>
            <div className="text-2xl font-bold text-white">
              {stats?.respiratoryRate ? `${stats.respiratoryRate} rpm` : 'N/A'}
            </div>
            <span className="text-[11px] text-amber-300 block font-mono">daily-respiratory-rate</span>
          </div>

          {/* VO2 Max */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">VO2 Max</span>
            <div className="text-2xl font-bold text-white">
              {stats?.vo2Max ? `${stats.vo2Max}` : 'N/A'}
            </div>
            <span className="text-[11px] text-emerald-400 block font-mono">daily-vo2-max</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: Sleep, Body Composition & Workout Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sleep Summary */}
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Sleep Analysis
            </h4>
            <span className="text-xs text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded font-mono">sleep API</span>
          </div>

          {stats?.sleepSummary ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-gray-700 pb-2">
                <span className="text-xs text-gray-400">Total Duration:</span>
                <span className="text-xl font-bold text-white">
                  {Math.floor(stats.sleepSummary.minutesAsleep / 60)}h {stats.sleepSummary.minutesAsleep % 60}m
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-900 p-2.5 rounded border border-gray-700/50">
                  <span className="text-gray-400 block">Efficiency:</span>
                  <span className="text-sm font-semibold text-emerald-400">{stats.sleepSummary.efficiency}%</span>
                </div>
                <div className="bg-gray-900 p-2.5 rounded border border-gray-700/50">
                  <span className="text-gray-400 block">Awake Time:</span>
                  <span className="text-sm font-semibold text-amber-400">{stats.sleepSummary.minutesAwake} min</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center italic">No sleep logs recorded for today.</p>
          )}
        </div>

        {/* Body Composition */}
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5 5 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              Body Metrics
            </h4>
            <span className="text-xs text-teal-300 bg-teal-900/40 px-2 py-0.5 rounded font-mono">weight/body-fat</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 space-y-1">
              <span className="text-gray-400 block">Weight:</span>
              <div className="text-xl font-bold text-white">
                {stats?.weightKg ? `${stats.weightKg} kg` : '--'}
              </div>
              {stats?.weightKg && <span className="text-[10px] text-gray-400 font-mono">~{(stats.weightKg * 2.20462).toFixed(1)} lbs</span>}
            </div>
            <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 space-y-1">
              <span className="text-gray-400 block">Body Fat:</span>
              <div className="text-xl font-bold text-white">
                {stats?.bodyFatPercentage ? `${stats.bodyFatPercentage}%` : '--'}
              </div>
              <span className="text-[10px] text-teal-400 font-mono">Bioimpedance scale</span>
            </div>
          </div>
        </div>

        {/* Workout Sessions */}
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Recorded Sessions ({stats?.workouts?.length || 0})
            </h4>
            <span className="text-xs text-amber-300 bg-amber-900/40 px-2 py-0.5 rounded font-mono">exercise API</span>
          </div>

          {stats?.workouts && stats.workouts.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {stats.workouts.map((w, idx) => (
                <div key={idx} className="bg-gray-900 p-2.5 rounded border border-gray-700/60 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white block">{w.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {Math.floor(w.durationSeconds / 60)} min • {w.calories} kcal • {w.avgHeartRate ? `${w.avgHeartRate} bpm` : ''}
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded font-mono">{w.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center italic">No exercise sessions logged today.</p>
          )}
        </div>
      </div>

      {/* Sync Status Footer & Demo Trigger */}
      <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm text-gray-400">
        <div>
          {stats ? (
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
              <span>
                Last Synced: <strong className="text-gray-200">{stats.lastSynced ? new Date(stats.lastSynced).toLocaleString() : 'Just now'}</strong>
                {stats.isDemo && <span className="ml-2 text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded">Demo Data</span>}
                {stats.provider && <span className="ml-2 text-xs bg-cyan-600/30 text-cyan-300 px-2 py-0.5 rounded">{stats.provider}</span>}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-gray-500 rounded-full"></span>
              <span>No Google Health data connected yet. Click <strong>Connect Google Health</strong> to sync.</span>
            </div>
          )}
        </div>

        <button
          onClick={handleLoadDemoData}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline self-start md:self-auto"
        >
          Load Preview / Demo Metrics
        </button>
      </div>
    </div>
  );
}
