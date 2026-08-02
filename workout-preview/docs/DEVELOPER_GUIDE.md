## Developer Guide

### Refactor overview
- Oversized views are being decomposed. Key extractions:
  - `src/components/SetList.js`: renders sets list per exercise.
  - `src/components/TargetsModal.js`: handles Targets & Options.
  - `src/components/FinishFlowDialog.js`: handles the finish/save flow.
- `WorkoutSession.js` now avoids deep JSON clones and uses structured updates.

### Validation
- Zod schemas added in `src/context/ExerciseContext.js` and used to validate AI JSON and parsed logs prior to use.

### Accessibility
- Modals and dialogs in `src/components/UI.js` now include `role="dialog"`, `aria-modal`, labeled titles, ESC to close, and a basic focus trap.

### Testing
- Jest + RTL tests added:
  - `src/views/__tests__/WorkoutSession.test.js`: simple flow test for completing a set.
  - `src/context/__tests__/ExerciseContext.test.js`: schema validation sanity checks.
- Extend with routing and notification smoke tests as you add routes.

### Next steps
- Continue decomposing `WorkoutSession` (extract `ExerciseCard`, `HUD`).
- Apply the same decomposition to `WorkoutsDashboard.js`.
- Consider a reducer (`useReducer`) for session state transitions.


