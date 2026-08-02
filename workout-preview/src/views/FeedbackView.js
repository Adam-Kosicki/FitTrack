import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { TrashIcon, PlusIcon } from '../components/Icons';

export function FeedbackView() {
    const [feedbackItems, setFeedbackItems] = useState([]);
    const [newFeedback, setNewFeedback] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
    }, []);

    const handleAddFeedback = async (e) => {
        e.preventDefault();
        if (!newFeedback.trim()) return;

        try {
            await addDoc(collection(db, 'feedback'), {
                text: newFeedback,
                createdAt: new Date(),
            });
            setNewFeedback('');
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
        <div className="p-4 md:p-6 text-white">
            <h1 className="text-3xl font-bold mb-6">Bugs & Feedback</h1>

            <form onSubmit={handleAddFeedback} className="flex items-center space-x-2 mb-8">
                <input
                    type="text"
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                    placeholder="Enter a bug report or feedback..."
                    className="w-full bg-gray-700 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>Add</span>
                </button>
            </form>

            {loading ? (
                <p>Loading feedback...</p>
            ) : feedbackItems.length > 0 ? (
                <div className="space-y-4">
                    {feedbackItems.map(item => (
                        <div key={item.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                            <p className="text-gray-200">{item.text}</p>
                            <button onClick={() => handleDeleteFeedback(item.id)} className="text-red-500 hover:text-red-400 p-2 rounded-full transition-colors" title="Delete Feedback">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500">No feedback yet. Be the first to add something!</p>
            )}
        </div>
    );
} 