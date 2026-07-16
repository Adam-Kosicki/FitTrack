import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { TrashIcon, SparklesIcon, MenuIcon } from '../components/Icons';
import { appId } from '../constants';
import { useExercises } from '../context/ExerciseContext';
import { useNotification } from '../context/NotificationContext';
import { GeminiExerciseGeneratorModal } from '../components/GeminiExerciseGeneratorModal';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

function AddExerciseFromDBModal({ isOpen, onClose, exerciseDatabase, onAddExercises, onGenerateExercise }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedExercises, setSelectedExercises] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedExercises([]);
            setSearchTerm('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSelectExercise = (exercise) => {
        setSelectedExercises(prev =>
            prev.some(ex => ex.id === exercise.id)
                ? prev.filter(ex => ex.id !== exercise.id)
                : [...prev, exercise]
        );
    };

    const filteredExercises = exerciseDatabase.filter(ex =>
        ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col" style={{height: '90vh'}}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Add Exercises from Database</h2>
                    <button onClick={onGenerateExercise} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors">
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        Generate with AI
                    </button>
                </div>
                <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded mb-4"
                />
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {filteredExercises.map(ex => (
                        <div
                            key={ex.id}
                            onClick={() => handleSelectExercise(ex)}
                            className={`p-3 rounded-lg cursor-pointer flex items-center ${selectedExercises.some(selEx => selEx.id === ex.id) ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedExercises.some(selEx => selEx.id === ex.id)}
                                readOnly
                                className="mr-4 h-5 w-5 rounded text-indigo-500 focus:ring-0"
                            />
                            <div>
                                <p className="font-semibold">{ex.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onAddExercises(selectedExercises);
                            onClose();
                        }}
                        disabled={selectedExercises.length === 0}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500"
                    >
                        Add Selected ({selectedExercises.length})
                    </button>
                </div>
            </div>
        </div>
    );
}


export function WorkoutTemplateEditor({ userId, workoutId, navigate }) {
    const { masterList: exerciseDatabase, loading: exercisesLoading, handleSaveExercise } = useExercises();
    const [template, setTemplate] = useState(null);
    const [addExerciseModalOpen, setAddExerciseModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const { showNotification } = useNotification();

    useEffect(() => {
        const loadData = async () => {
            if (exercisesLoading || !userId) return;

            if (!workoutId) {
                showNotification('No workout ID provided for editor.', 'error');
                navigate('workouts');
                return;
            }

            const workoutDoc = await getDoc(doc(db, `artifacts/${appId}/users/${userId}/workouts`, workoutId));
            if (!workoutDoc.exists()) {
                showNotification('Workout template not found.', 'error');
                navigate('workouts');
                return;
            }
            const fetchedTemplate = { id: workoutDoc.id, ...workoutDoc.data() };
            
            if (!fetchedTemplate.exercises) {
                fetchedTemplate.exercises = [];
            }

            setTemplate(fetchedTemplate);
        };

        loadData();
    }, [userId, workoutId, navigate, exercisesLoading, showNotification]);

    const handleTemplateChange = (field, value) => setTemplate(t => ({ ...t, [field]: value }));

    const handleAddExercises = (selectedExercises) => {
        const newExercises = selectedExercises.map(dbExercise => {
            return {
                ...dbExercise,
                id: dbExercise.id || `${dbExercise.name}-${Date.now()}` // Ensure a unique ID
            };
        });
        
        setTemplate(t => ({ ...t, exercises: [...(t.exercises || []), ...newExercises] }));
    };

    const removeExercise = (exIndex) => {
        const newExercises = template.exercises.filter((_, i) => i !== exIndex);
        setTemplate(t => ({ ...t, exercises: newExercises }));
    };

    const handleOnDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(template.exercises);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setTemplate(t => ({ ...t, exercises: items }));
    };

    const handleSave = async () => {
        if (!template.name) {
            showNotification('Workout name cannot be empty.', 'error');
            return;
        }

        try {
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/workouts`, workoutId), template);
            showNotification('Workout template updated!', 'success');
            navigate('workouts');
        } catch (error) {
            console.error("Error saving template: ", error);
            showNotification('Failed to save template.', 'error');
        }
    };

    if (!template || exercisesLoading) return <div>Loading editor...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                 <input type="text" value={template.name} onChange={e => handleTemplateChange('name', e.target.value)} className="text-3xl font-bold bg-transparent border-b-2 border-gray-700 focus:border-indigo-500 outline-none w-2/3" />
            </div>

            <textarea value={template.description} onChange={e => handleTemplateChange('description', e.target.value)} className="w-full bg-gray-700 p-2 rounded mt-1 mb-4 h-24" placeholder="Workout Description..."></textarea>

            <DragDropContext onDragEnd={handleOnDragEnd}>
                <Droppable droppableId="exercises">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef}>
                            {template.exercises.map((ex, exIndex) => (
                                <Draggable key={ex.id} draggableId={ex.id} index={exIndex}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className="bg-gray-800 p-4 rounded-lg mb-4 flex justify-between items-center"
                                        >
                                            <div className="flex items-center">
                                                <MenuIcon className="h-6 w-6 mr-4 text-gray-500" />
                                                <p className="text-xl font-bold text-indigo-300">{ex.name}</p>
                                            </div>
                                            <button onClick={() => removeExercise(exIndex)} className="text-red-500 hover:text-red-400 p-1 ml-2 flex-shrink-0">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <div className="flex space-x-4 mt-4">
                 <button onClick={() => setAddExerciseModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg w-full">+ Add From Database</button>
            </div>
            
            <div className="mt-6 flex flex-col md:flex-row justify-between space-y-2 md:space-y-0 md:space-x-2">
                <button onClick={() => navigate('workouts')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg w-full md:w-auto">
                    Cancel
                </button>
                <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg w-full md:w-auto">
                    Save Template
                </button>
            </div>

            <AddExerciseFromDBModal
                isOpen={addExerciseModalOpen}
                onClose={() => setAddExerciseModalOpen(false)}
                exerciseDatabase={exerciseDatabase}
                onAddExercises={handleAddExercises}
                onGenerateExercise={() => {
                    setAddExerciseModalOpen(false);
                    setIsGenerating(true);
                }}
            />

            {isGenerating && (
                <GeminiExerciseGeneratorModal
                    onSave={handleSaveExercise}
                    onCancel={() => setIsGenerating(false)}
                />
            )}
        </div>
    );
} 