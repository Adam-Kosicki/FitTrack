import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from './firebase/firebase';
import { DumbbellIcon, BookOpenIcon, DatabaseIcon, CogIcon, ClipboardListIcon, BugIcon } from './components/Icons';
import { JumpersKneeView } from './views/JumpersKneeView';
import { GuidesView } from './views/GuidesView';
import { AnkleRecoveryView } from './views/AnkleRecoveryView';
import { PostureView } from './views/PostureView';
import { WorkoutsDashboard } from './views/WorkoutsDashboard';
import { WorkoutSession } from './views/WorkoutSession';
import { ExerciseDatabaseView } from './views/ExerciseDatabaseView';
import { LogView } from './views/LogView';
import { ActionDialog } from './components/UI';
import { WorkoutTemplateEditor } from './views/WorkoutTemplateEditor';
import { useNotification } from './context/NotificationContext';
import { ExerciseProvider } from './context/ExerciseContext';
import { FeedbackView } from './views/FeedbackView';
import { AppleWatchView } from './views/AppleWatchView';
import { SettingsView } from './views/SettingsView';

const LoginScreen = ({ onLogin }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <DumbbellIcon className="h-24 w-24 text-indigo-400 mb-6" />
        <h1 className="text-4xl font-bold mb-3">FitTrack</h1>
        <p className="text-lg text-gray-400 mb-8">Your personal workout companion.</p>
        <button
            onClick={onLogin}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg flex items-center transition-colors text-lg"
        >
            Sign In with Google
        </button>
    </div>
);

// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('workouts');
    const [currentContext, setCurrentContext] = useState({});
    const [activeWorkout, setActiveWorkout] = useState(null);
    const [navigationIntent, setNavigationIntent] = useState(null);
    const { notification } = useNotification();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // The onAuthStateChanged listener will handle setting the user.
        } catch (error) {
            console.error("Google Sign-in failed:", error);
        }
    };
    
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            // The onAuthStateChanged listener will set user to null.
        } catch (error) {
            console.error("Sign-out failed:", error);
        }
    };

    const navigate = useCallback((newView, context = {}) => {
        if (activeWorkout && view === 'log' && newView !== 'log') {
            setNavigationIntent({ view: newView, context });
        } else {
            setView(newView);
            setCurrentContext(context);
        }
    }, [activeWorkout, view]);

    useEffect(() => {
        const onNavigate = (e) => {
            const { view: v, context } = e.detail || {};
            if (!v) return;
            navigate(v, context || {});
        };
        window.addEventListener('navigate', onNavigate);
        return () => window.removeEventListener('navigate', onNavigate);
    }, [navigate]);

    const handleCancelWorkout = () => {
        setActiveWorkout(null);
        setView('workouts');
        setCurrentContext({});
        setNavigationIntent(null);
    };

    const handleLeaveAnyway = () => {
        if (navigationIntent) {
            setView(navigationIntent.view);
            setCurrentContext(navigationIntent.context);
            setNavigationIntent(null);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>;
    }

    if (!user) {
        return <LoginScreen onLogin={handleGoogleSignIn} />;
    }

    // All user-dependent rendering is now inside this return statement.
    return (
        <ExerciseProvider userId={user.uid}>
            <MainApp
                user={user}
                view={view}
                navigate={navigate}
                activeWorkout={activeWorkout}
                setActiveWorkout={setActiveWorkout}
                currentContext={currentContext}
                navigationIntent={navigationIntent}
                setNavigationIntent={setNavigationIntent}
                handleCancelWorkout={handleCancelWorkout}
                handleLeaveAnyway={handleLeaveAnyway}
                handleSignOut={handleSignOut}
                notification={notification}
            />
        </ExerciseProvider>
    );
}

// --- Main App Presentation Component ---
// This component assumes that 'user' is not null.
function MainApp({
    user, view, navigate, activeWorkout, setActiveWorkout, currentContext,
    navigationIntent, setNavigationIntent, handleCancelWorkout, handleLeaveAnyway,
    handleSignOut, notification
}) {
    useEffect(() => {
        if (!activeWorkout || !activeWorkout.log) return;
        const hasUnfinishedSets = Object.values(activeWorkout.log).some((sets) =>
            Array.isArray(sets) && sets.some((s) => s.status !== 'completed')
        );
        if (!hasUnfinishedSets) {
            setActiveWorkout(null);
        }
    }, [activeWorkout, setActiveWorkout]);
    const renderView = () => {
        const workoutIdentifier = currentContext.workoutId;
        const isActiveWorkout = activeWorkout && activeWorkout.identifier === workoutIdentifier;

        if (view === 'log' && !isActiveWorkout && activeWorkout) {
            return (
                <div className="bg-gray-800 p-6 rounded-lg text-center">
                    <h2 className="text-2xl font-bold mb-4">Workout in Progress</h2>
                    <p className="mb-4">You have another workout in progress. Please finish or cancel it before starting a new one.</p>
                    <button
                        onClick={() => navigate('log', { workoutId: activeWorkout.identifier })}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
                    >
                        Resume Workout
                    </button>
                </div>
            );
        }

        switch (view) {
            case 'log':
                return <WorkoutSession
                    userId={user.uid}
                    workoutId={currentContext.workoutId}
                    workout={currentContext.workout}
                    isEditingTemplate={currentContext.isEditingTemplate}
                    navigate={navigate}
                    activeWorkout={isActiveWorkout ? activeWorkout : null}
                    setActiveWorkout={setActiveWorkout}
                />;
            case 'guides':
                return <GuidesView navigate={navigate} />;
            case 'jumpersKnee':
                return <JumpersKneeView userId={user.uid} />;
            case 'ankleRecovery':
                return <AnkleRecoveryView />;
            case 'posture':
                return <PostureView />;
            case 'edit-template':
                return <WorkoutTemplateEditor
                    userId={user.uid}
                    workoutId={currentContext.workoutId}
                    navigate={navigate}
                />;
            case 'exerciseDatabase':
                return <ExerciseDatabaseView userId={user.uid} navigate={navigate} />;
            case 'logTab':
                return <LogView userId={user.uid} />;
            case 'feedback':
                return <FeedbackView />;
            case 'appleWatch':
                return <AppleWatchView userId={user.uid} />;
            case 'settings':
                return <SettingsView />;
            case 'workouts':
            default:
                return <WorkoutsDashboard userId={user.uid} navigate={navigate} activeWorkoutId={activeWorkout?.identifier} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex">
            {navigationIntent && (
                <ActionDialog
                    title="Workout in Progress"
                    message="You have an active workout. What would you like to do?"
                    onCancel={() => setNavigationIntent(null)}
                    buttons={[
                        { text: "Leave Anyway (Workout Paused)", onClick: handleLeaveAnyway, className: "bg-yellow-600 hover:bg-yellow-700" },
                        { text: "Cancel Workout", onClick: handleCancelWorkout, className: "bg-red-600 hover:bg-red-700" },
                    ]}
                />
            )}
            {notification.show && (
                <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg z-50 ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    {notification.message}
                </div>
            )}
            <aside className="w-16 md:w-56 bg-gray-950 p-2 md:p-4 flex flex-col">
                <div className="flex items-center mb-8 md:mb-10">
                    <DumbbellIcon className="h-8 w-8 text-indigo-400" />
                    <h1 className="hidden md:block text-2xl font-bold ml-2">FitTrack</h1>
                </div>
                <nav className="flex flex-col space-y-2">
                    <button onClick={() => navigate('workouts')} className="flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <BookOpenIcon className="h-6 w-6" />
                        <span className="hidden md:inline ml-3">Workouts</span>
                    </button>
                    <button onClick={() => navigate('guides')} className="flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <BookOpenIcon className="h-6 w-6" />
                        <span className="hidden md:inline ml-3">Guides</span>
                    </button>
                    <button onClick={() => navigate('exerciseDatabase')} className="flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <DatabaseIcon className="h-6 w-6" />
                        <span className="hidden md:inline ml-3">Exercise DB</span>
                    </button>
                    <button onClick={() => navigate('logTab')} className="flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <ClipboardListIcon className="h-6 w-6" />
                        <span className="hidden md:inline ml-3">Log</span>
                    </button>
                    <button onClick={() => navigate('feedback')} className="flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <BugIcon className="h-6 w-6" />
                        <span className="hidden md:inline ml-3">Bugs/Feedback</span>
                    </button>
                    <button onClick={() => navigate('appleWatch')} className="flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <BookOpenIcon className="h-6 w-6" />
                        <span className="hidden md:inline ml-3">Apple Watch</span>
                    </button>
                    <button onClick={() => navigate('settings')} className="flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <CogIcon className="h-6 w-6" />
                        <span className="hidden md:inline ml-3">Settings</span>
                    </button>
                </nav>
                {activeWorkout && (
                    <div className="mt-4 bg-yellow-900/40 border border-yellow-700 rounded-lg p-2 md:p-3">
                        <p className="text-[10px] md:text-xs text-yellow-300 font-semibold">Workout in progress</p>
                        <div className="mt-2 flex flex-col md:flex-row gap-2">
                            <button
                                onClick={() => navigate('log', { workoutId: activeWorkout.identifier })}
                                className="text-[10px] md:text-xs bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-1 px-2 rounded"
                            >Resume</button>
                            <button
                                onClick={handleCancelWorkout}
                                className="text-[10px] md:text-xs bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-2 rounded"
                            >Cancel</button>
                        </div>
                    </div>
                )}
                <div className="mt-auto hidden md:block">
                    <p className="text-xs text-gray-500">User:</p>
                    <p className="text-xs text-gray-400 break-words">{user.displayName || 'N/A'}</p>
                    <p className="text-xs text-gray-500 mt-2">UID:</p>
                    <p className="text-xs text-gray-400 break-all">{user.uid}</p>
                    <button onClick={handleSignOut} className="mt-4 text-xs text-red-400 hover:underline">Sign Out</button>
                </div>
            </aside>
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                {renderView()}
            </main>
        </div>
    );
}

