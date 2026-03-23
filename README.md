# FE Civil Study Tracker

An adaptive, offline-first study tracker for the **NCEES FE Civil Engineering exam**. Built with vanilla JavaScript — no frameworks, no build step. Open `index.html` and start studying.

---

## Overview

- **Exam target**: April 22, 2026
- **14 FE Civil subject areas** seeded from the NCEES exam specification
- **Adaptive scheduling** — adjusts to your weak areas and study history
- **Spaced repetition** — review queue based on forgetting curve intervals
- **Study plan generator** — phase-aware (normal → intense starting April 10)
- **Offline-capable PWA** — works without internet after first load
- **Optional Google Drive sync** — back up and restore across devices

---

## Quick Start

1. Clone or download the repository
2. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge)
3. No server required — runs entirely client-side

> **Note**: Service Worker requires a `localhost` or `https://` origin. For local development, use a simple static server:
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

---

## Project Structure

```
FE exams/
├── index.html                  # Single-page app shell (9 tabs)
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker (offline cache)
├── CLAUDE.md                   # Project intelligence for Claude Code
├── css/
│   └── styles.css              # Complete design system (dark/light themes)
├── js/
│   ├── app.js                  # Entry point: init, tab routing, event binding
│   ├── state.js                # Central in-memory STATE object
│   ├── storage.js              # localStorage persistence + backup/restore
│   ├── utils.js                # escapeHTML, date math, formatters, UUID
│   ├── data/
│   │   ├── subjects.js         # FE Civil syllabus: 14 subjects, topics, subtopics
│   │   └── baseline.js         # Prior exam scores (seeded weakness profile)
│   ├── engine/
│   │   ├── calculations.js     # All scoring formulas (mastery, weakness, priority)
│   │   ├── spacedRepetition.js # Review interval logic and queue management
│   │   ├── adaptive.js         # Smart recommendations and schedule recovery
│   │   └── scheduler.js        # Study plan generation and catch-up logic
│   └── ui/
│       ├── ui-dashboard.js     # Dashboard: KPIs, readiness, today's plan
│       ├── ui-plan.js          # Calendar view, day details, milestones
│       ├── ui-sessions.js      # Session logger with confidence/difficulty ratings
│       ├── ui-subjects.js      # Collapsible subject tree with mastery scores
│       ├── ui-revision.js      # Spaced repetition queue, mistake notebook
│       ├── ui-resources.js     # Videos, books, problem sets tracker
│       ├── ui-assessments.js   # Mock exam logger and score trends
│       ├── ui-analytics.js     # Heatmap, charts, readiness forecast
│       └── ui-settings.js      # Exam config, backup, theme, Drive sync
└── icons/
    └── icon.svg                # App icon
```

---

## Module Descriptions

### `js/data/subjects.js`
Full NCEES FE Civil syllabus organized into 14 subjects → topics → subtopics. Each entry carries:
- `examWeight` — proportion of exam score (sums to 1.0)
- `isFoundational` — flag for prerequisite subjects (Math, Statics, etc.)
- `dependsOn` — dependency chain for study ordering
- `color` / `icon` — visual identity per subject

### `js/data/baseline.js`
Prior exam score profile used to seed weakness at app start. Scores range from 5.1 (Mathematics — weakest) to 15.0 (Ethics — strongest). Each subject gets a `studyWeightMultiplier` that amplifies planning allocation for weak areas.

### `js/engine/calculations.js`
All scoring formulas as pure functions with no side effects.

### `js/engine/spacedRepetition.js`
Review queue using base intervals `[1, 3, 7, 14, 30]` days. Intervals shorten when performance is poor; reset to Day 1 on failure (accuracy < 40%).

### `js/engine/adaptive.js`
Generates ranked study recommendations from current state. Detects imbalances, slow question solving, and schedule deficits.

### `js/engine/scheduler.js`
Generates a day-by-day study plan from today to exam day. Handles phase switching, mock exam scheduling, and catch-up redistribution.

### `js/state.js`
Single source of truth. `STATE.computed` is recalculated after every mutation. No component reads from localStorage directly — they read from `STATE`.

### `js/storage.js`
All `fe_civil_*` localStorage keys in one place. Includes JSON backup export/import with schema version validation.

---

## Data Model

### Settings
```js
{
  examDate: "2026-04-22",
  intensePhaseDate: "2026-04-10",
  weekdayHours: 6,
  weekendHours: 12,
  intenseHours: 14,
  dailyHardCap: 14,
  revisionIntervals: [1, 3, 7, 14, 30],
  neglectDays: 14,
  finalSprintDays: 12
}
```

### Study Session
```js
{
  id, type, date, durationMinutes,
  subjectId, topicId, subtopicId,
  confidenceBefore, confidenceAfter,    // 1–5
  perceivedDifficulty, mentalFatigue,  // 1–5
  questionsAttempted, questionsCorrect,
  flaggedForReview, rewatchNeeded,
  notes, followUpDate
}
```

### Subject Node (per subtopic)
```js
{
  id, subjectId, topicId,
  examWeight, baselineScore,
  coverageStatus,          // "not_started" | "in_progress" | "complete"
  masteryScore,            // 0–100 (computed)
  weaknessScore,           // 0–100 (computed)
  priorityScore,           // 0–100 (computed)
  nextReviewDate, reviewCount, reviewInterval,
  avgConfidence, avgAccuracy, avgDifficulty,
  mistakeCount, lastStudiedDate
}
```

---

## Adaptive Logic

### Study Plan Generation
1. Available days = tomorrow → examDate
2. Phase assigned per day: normal / intense / sprint
3. Subjects sorted by `priorityScore` descending
4. Hours allocated proportional to `priorityScore × examWeight`
5. 20% of each day reserved for revision blocks
6. Mock exam day inserted every 14 days
7. Final 12 days: revision + mock + error review only

### Catch-up Logic
When actual hours fall behind planned hours, the deficit is spread evenly over the next 7 days, capped at `dailyHardCap`.

### Phase Switching
- **Normal phase**: weekday = 6h/day, weekend = 12h/day
- **Intense phase** (April 10+): 14h/day every day
- **Final sprint** (last 12 days): pure revision/mock mode

---

## Calculation Formulas

### Mastery Score (0–100)
```
masteryScore = (
  accuracy × 0.35 +
  (confidence / 5) × 0.25 +
  (1 − difficulty / 5) × 0.15 +
  coverageRatio × 0.15 +
  (1 − recencyDecay) × 0.10
) × 100

recencyDecay = clamp(daysSinceStudied / 30, 0, 1)
```

### Weakness Score (0–100)
```
weaknessScore = (
  (1 − accuracy) × 0.30 +
  (1 − confidence / 5) × 0.20 +
  (difficulty / 5) × 0.15 +
  recencyDecay × 0.15 +
  (mistakeCount / maxMistakes) × 0.10 +
  baselineWeakness × 0.10
) × 100

baselineWeakness = (10 − baselineScore) / 10
```

### Priority Score (0–100)
```
priorityScore = (
  weaknessScore × 0.40 +
  urgencyScore × 0.25 +
  examWeightScore × 0.15 +
  foundationalBonus × 0.10 +
  neglectScore × 0.10
)
```

### Readiness Score (0–100)
```
readinessScore = Σ(masteryScore[i] × examWeight[i])  for all subjects
```

### Review Interval (Spaced Repetition)
```
baseIntervals = [1, 3, 7, 14, 30]  // days

modifier = 1.0
if accuracy < 0.50: modifier × 0.5
if confidence ≤ 2:  modifier × 0.7
if difficulty ≥ 4:  modifier × 0.6
if mistakeCount > 2: modifier × 0.8

nextInterval = baseIntervals[reviewCount] × modifier
nextReviewDate = lastReviewDate + ⌈nextInterval⌉

// Failure: reset to start
if accuracy < 0.40: reviewCount = 0
```

---

## NCEES FE Civil Exam Weights

| Subject | Weight |
|---------|--------|
| Mathematics & Statistics | 7% |
| Ethics & Professional Practice | 7% |
| Engineering Economics | 7% |
| Statics | 9% |
| Dynamics | 7% |
| Mechanics of Materials | 9% |
| Materials | 5% |
| Fluid Mechanics | 9% |
| Surveying | 5% |
| Water Resources & Environmental | 9% |
| Structural Engineering | 9% |
| Geotechnical Engineering | 9% |
| Transportation Engineering | 5% |
| Construction Engineering | 3% |

---

## Customizing the Syllabus

Edit `js/data/subjects.js` to add, rename, or reweight subjects. The structure is:

```js
{
  id: 'my_subject',
  name: 'Subject Name',
  shortName: 'Short',
  examWeight: 0.07,          // proportion, all subjects should sum to ~1.0
  color: '#3b82f6',
  icon: '📐',
  isFoundational: false,
  dependsOn: [],             // array of subject IDs
  topics: [
    {
      id: 'topic_id',
      name: 'Topic Name',
      subtopics: [
        { id: 'subtopic_id', name: 'Subtopic Name' }
      ]
    }
  ]
}
```

After editing, clear localStorage to rebuild the subject tree from the new seed data.

---

## Google Drive Sync (Optional)

1. Create a Google Cloud project and enable the **Google Drive API**
2. Create an OAuth 2.0 Client ID (Web application type)
3. Add your domain to **Authorized JavaScript origins**
4. Open `js/app.js` and set:
   ```js
   const GDRIVE_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
   ```
5. Drive sync buttons will appear in the Settings tab

---

## Deployment

The app is a static site — deploy anywhere that serves HTML:

- **GitHub Pages**: push to `main`, enable Pages in repo settings
- **Netlify**: drag and drop the folder
- **Vercel**: `vercel --prod`
- **Local**: open `index.html` directly, or `npx serve .`

For PWA features (offline, install prompt), the site must be served over `https://` or `localhost`.

---

## Commit Convention

```
feat:   new feature
fix:    bug fix
data:   syllabus or seed data changes
engine: scheduler / spaced-rep / adaptive logic
ui:     tab or component changes
calc:   formula or calculation changes
docs:   README / CLAUDE.md updates
```

---

## License

Personal use. Not affiliated with NCEES.
