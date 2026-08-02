import { ExerciseAISchema, WorkoutLogParseSchema } from '../ExerciseContext';

test('ExerciseAISchema validates isolation rule structural shape', () => {
  const data = {
    name: 'EZ-bar Curl',
    masterData: {
      muscleGroup: 'Arms',
      primaryMuscle: 'Biceps',
      secondaryMuscle: 'Brachialis',
      musclesInvolved: ['Biceps','Brachialis','Forearms'],
      mechanics: 'Isolation',
      forceType: 'Pull',
      movementPattern: [],
      jointAction: ['Flexion'],
      equipment: ['EZ-bar'],
      grip: 'Underhand',
      planeOfMotion: 'Sagittal',
      unilateral: false,
      tags: ['bodybuilding']
    }
  };
  expect(() => ExerciseAISchema.parse(data)).not.toThrow();
});

test('WorkoutLogParseSchema validates basic structure', () => {
  const data = {
    date: '2024-07-15',
    workout: [
      { exerciseName: 'Push Up', sets: [ { weight: 0, reps: 10, failed: false } ] }
    ]
  };
  expect(() => WorkoutLogParseSchema.parse(data)).not.toThrow();
});


