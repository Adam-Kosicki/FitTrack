import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { TrashIcon, PlusIcon } from '../components/Icons';

const ADMIN_EMAILS = ['adamjkosicki@gmail.com'];

export function FeedbackView({ user }) {
    const [feedbackItems, setFeedbackItems] = useState([]);
    const [newFeedback, setNewFeedback] = useState('');
    const [loading, setLoading] = useState(true);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);

    const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());

    useEffect(() => {
        // Only subscribe to feedback list if the logged in user is an admin
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        const feedbackRef = collection(db, 'feedback');
        const q = query(feedbackRef, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFeedbackItems(items);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching feedback:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAdmin]);

    const handleAddFeedback = async (e) => {
        e.preventDefault();
        if (!newFeedback.trim()) return;

        try {
            await addDoc(collection(db, 'feedback'), {
                text: newFeedback,
                userEmail: user?.email || 'Anonymous',
                userId: user?.uid || null,
                createdAt: new Date(),
            });
            setNewFeedback('');
            setSubmittedSuccess(true);
            setTimeout(() => setSubmittedSuccess(false), 4000);
        } catch (error) {
            console.error("Error adding feedback:", error);
        }
    };

    const handleDeleteFeedback = async (id) => {
        try {
            await deleteDoc(doc(db, 'feedback', id));
        } catch (error) {
            console.error("Error deleting feedback:", error);
        }
    };

    return (
        <div className="p-4 md:p-6 text-white max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Bugs & Feedback</h1>
                    <p className="text-gray-400 text-sm mt-1">Submit feedback, report issues, or suggest new features.</p>
                </div>
                {isAdmin && (
                    <span className="bg-indigo-900/80 border border-indigo-500 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>Admin View
                    </span>
                )}
            </div>

            {submittedSuccess && (
                <div className="mb-6 p-4 bg-emerald-900/60 border border-emerald-500 text-emerald-200 rounded-lg text-sm flex items-center justify-between">
                    <span>Thank you! Your feedback has been submitted successfully.</span>
                </div>
            )}

            <form onSubmit={handleAddFeedback} className="flex items-center space-x-2 mb-8">
                <input
                    type="text"
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                    placeholder="Describe a bug report or feedback..."
                    className="w-full bg-gray-800 p-3.5 rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-lg flex items-center space-x-2 transition-colors shrink-0"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>Submit</span>
                </button>
            </form>

            {isAdmin ? (
                <div>
                    <h2 className="text-xl font-semibold mb-4 text-indigo-300 flex items-center gap-2">Submitted Feedback Logs
                        <span className="text-xs bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded-full">Admin Only</span>
                    </h2>
                    {loading ? (
                        <p className="text-gray-400">Loading feedback entries...</p>
                    ) : feedbackItems.length > 0 ? (
                        <div className="space-y-3">
                            {feedbackItems.map(item => (
                                <div key={item.id} className="bg-gray-800/90 border border-gray-700/80 p-4 rounded-lg flex justify-between items-start">
                                    <div>
                                        <p className="text-gray-100 font-medium">{item.text}</p>
                                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                                            <span>From: <strong className="text-gray-300">{item.userEmail || 'Anonymous'}</strong></span>
                                            <span>•</span>
                                            <span>{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString() : new Date().toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteFeedback(item.id)}
                                        className="text-red-400 hover:text-red-300 p-2 hover:bg-red-950/40 rounded-lg transition-colors ml-4"
                                        title="Delete Feedback Entry"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 bg-gray-800/40 p-6 rounded-lg text-center">No feedback entries found.</p>
                    )}
                </div>
            ) : (
                <div className="bg-gray-800/50 border border-gray-700/60 p-5 rounded-lg text-center text-sm text-gray-400">Submitted reports are private and reviewed directly by the admin team.
                </div>
            )}
        </div>
    );
}