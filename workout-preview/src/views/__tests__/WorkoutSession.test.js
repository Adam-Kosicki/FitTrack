import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutSession } from '../WorkoutSession';
import { NotificationProvider } from '../../context/NotificationContext';

jest.mock('../../context/ExerciseContext', () => ({
  useExercises: () => ({ masterList: [], loading: false, handleSaveExercise: jest.fn() })
}));

jest.mock('../../firebase/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), doc: jest.fn(), addDoc: jest.fn(), setDoc: jest.fn(), getDoc: jest.fn().mockResolvedValue({ exists: () => false }), getDocs: jest.fn(), query: jest.fn(), where: jest.fn(), limit: jest.fn(), Timestamp: { fromDate: (d) => d }
}));

function renderSession(props = {}) {
  return render(
    <NotificationProvider>
      <WorkoutSession
        userId={null}
        workoutId={null}
        navigate={jest.fn()}
        activeWorkout={null}
        setActiveWorkout={jest.fn()}
        workout={{ id: 'adhoc1', isAdHoc: true, name: 'Ad Hoc', exercises: [ { name: 'Push Up', id: 'ex1', sets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }] } ] }}
        {...props}
      />
    </NotificationProvider>
  );
}

test('renders WorkoutSession and completes a set', () => {
  renderSession();
  expect(screen.getByDisplayValue('Ad Hoc')).toBeInTheDocument();
  const buttons = screen.getAllByTitle(/Mark Set as Done/i);
  fireEvent.click(buttons[0]);
});


