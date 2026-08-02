# 🏋️ FitTrack

**A personal fitness web app built by an athlete and researcher who got tired of every workout app missing the features that matter.**

---

## The Story

I'm an athlete, fitness enthusiast, and researcher at UT Austin. I treat working out like a game — progression systems, measurable stats, data-driven decisions. I wanted an app that could keep up with how I actually train.

I tried dozens of fitness apps. Every single one was missing something. One had great logging but no exercise database. Another tracked sets well but couldn't handle rehab protocols. None of them let me integrate AI to speed up data entry, and not a single one gave me full control over how my workout data was organized, exported, and analyzed.

So I built my own.

FitTrack is a personal project designed exactly the way I want a fitness app to work — no compromises, no subscriptions, no features locked behind a paywall. If I can build it, why pay someone else for a worse version?

---

## What It Does

### 🎯 Workout Dashboard
- Create, organize, and manage workout templates with drag-and-drop reordering
- Group workouts into training blocks (e.g., Push/Pull/Legs, Upper/Lower splits)
- AI-powered workout generation — describe what you want and Gemini builds the template
- AI-generated group summaries that analyze your training split
- One-click workout export for sharing or backup

### 💪 Live Workout Session
- Real-time workout logging with per-set tracking (weight, reps, RPE)
- Load type support: weighted, bodyweight, isometric, plyometric
- **Exercise variants** — track the same exercise across equipment, stance, and grip variations (e.g., "Bench Press" with barbell vs. dumbbell, incline vs. flat) with independent progression history per variant
- Auto-populated previous performance data so you always know what to beat
- Built-in rest timer with countdown and pause controls
- Built-in metronome (powered by Tone.js) for tempo-controlled movements and isometric holds
- Unilateral/bilateral tracking for single-limb exercises
- Target rep ranges, target weight, and RPE percentage goals per exercise
- Add exercises mid-workout from your database or generate new ones with AI on the fly
- Stats HUD showing real-time volume, sets completed, and workout duration
- Active workout persistence — navigate away and resume without losing progress

### 📊 Exercise Database
- Full exercise library with detailed metadata: muscle group, mechanics (compound/isolation), force type (push/pull/hinge), equipment, and custom tags
- **AI-powered exercise generation** — type an exercise name and Gemini auto-fills all metadata (primary muscles, secondary muscles, mechanics, tags, and more)
- **Bulk import** — paste a list of exercises and batch-generate metadata for all of them
- Filterable by muscle group, mechanics, force type, equipment, isometric, unilateral, and custom tags
- Grouped view organizing exercises by muscle group with collapsible sections
- Per-exercise history tracking with performance summaries (best set, estimated 1RM, volume trends)
- Personal notes per exercise
- Import/export entire exercise database as JSON

### 📋 Performance Log
- Complete workout history with every set logged to Firestore in real-time
- Filter by all workouts, rehab-specific (Jumper's Knee), or standard training
- Export logs by timeframe (today or all-time)
- **AI Log Parser** — paste an unstructured workout log (from notes, text messages, etc.) and Gemini parses it into structured data, auto-matching exercises to your database and creating new entries for unknown exercises
- Delete individual log entries with confirmation

### 📖 Rehab & Recovery Guides
- **Jumper's Knee Protocol** — A full 4-stage interactive tracker based on Jake Tuura's patellar tendinopathy program:
  - Stage 1: Isometrics with detailed exercise options and progression rules
  - Stage 2: Lifting with 3-week periodized programming and day-by-day completion tracking
  - Stage 3: Store-and-Release (SAR) with 12 progressive plyometric workouts
  - Stage 4: Return to sport guidelines
  - Built-in pain log with 0–10 scale, context tagging (pre/post/general), and SVG line chart visualization
  - Pain-provocation gating — progression buttons are locked until next-morning pain ≤ 3/10
  - Embedded reference PDF viewer with page-level navigation
- **Ankle Recovery (CAI)** — Chronic Ankle Instability guide derived from E3 Rehab research:
  - Plyometrics, strength, dynamic balance, static balance, and ankle-specific progressions
  - Timestamped YouTube video links for every exercise demonstration
  - Example weekly plan and full video transcript
  - Zoomable reference images throughout
- **Posture Guide** — Foundational tips and routines (work in progress)
- Community guide creation planned for future releases

### ⌚ Apple Watch Integration
- Send heart rate data from Apple Health to FitTrack via iOS Shortcuts
- Step-by-step setup instructions with no code required
- Real-time heart rate display powered by Firebase Cloud Functions + Firestore listeners

### 🔧 Additional Features
- **Google Authentication** — secure sign-in with Firebase Auth
- **Real-time sync** — all data syncs instantly across devices via Firestore `onSnapshot` listeners
- **PWA support** — installable as a Progressive Web App with service worker caching (Workbox)
- **Responsive design** — works on desktop, tablet, and mobile with a collapsible sidebar
- **Feedback system** — built-in bug reporting and feature request submission

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS |
| Backend / Database | Firebase (Firestore, Auth, Hosting, Cloud Functions) |
| AI | Google Gemini API (`@google/generative-ai`) |
| Audio | Tone.js (metronome) |
| Drag & Drop | react-beautiful-dnd |
| PWA | Workbox (service worker, caching, offline support) |
| Export | JSZip, FileSaver.js |
| Hosting | Firebase Hosting |

---

## Project Structure

```
FitTrack/
├── workout-preview/          # React web app
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── AILogParserModal.js
│   │   │   ├── ExerciseCard.js
│   │   │   ├── ExerciseEditModal.js
│   │   │   ├── ExerciseHistoryModal.js
│   │   │   ├── ExerciseHomeModal.js
│   │   │   ├── GeminiExerciseGeneratorModal.js
│   │   │   ├── Metronome.js
│   │   │   ├── PainScale.js
│   │   │   ├── RestTimer.js
│   │   │   ├── SetList.js
│   │   │   ├── TargetsModal.js
│   │   │   └── ...
│   │   ├── views/            # Page-level views
│   │   │   ├── WorkoutsDashboard.js
│   │   │   ├── WorkoutSession.js
│   │   │   ├── ExerciseDatabaseView.js
│   │   │   ├── LogView.js
│   │   │   ├── JumpersKneeView.js
│   │   │   ├── AnkleRecoveryView.js
│   │   │   └── ...
│   │   ├── context/          # React Context (exercises, notifications)
│   │   ├── data/             # Static data (rehab protocols, transcripts)
│   │   └── firebase/         # Firebase config & API keys (env vars)
│   └── public/               # Static assets & rehab guide pages
├── not_code/                 # Sample workout data & exercise databases
└── firebase.json             # Firebase Hosting config
```

---

## Getting Started

### Prerequisites
- Node.js (v16+)
- A Firebase project with Firestore, Auth, and Hosting enabled
- A Google Gemini API key

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Adam-Kosicki/FitTrack.git
   cd FitTrack/workout-preview
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your Firebase and Gemini API credentials:
   ```env
   REACT_APP_GEMINI_API_KEY=your_gemini_api_key
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the dev server**
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000)

5. **Deploy to Firebase Hosting** (optional)
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

---

## Status

This is an active personal project. I use it every day for my own training. Features are added as I need them — which means it evolves based on real use, not hypothetical feature lists.

---

## Author

**Adam Kosicki** — Athlete, developer, and researcher at UT Austin.  
Built because no existing app had everything I needed, and I'd rather build it myself than settle.
